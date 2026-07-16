import { Request, Response } from "express";
import prisma from "@repo/db";
import {
  createOrder as rzpCreateOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  parseWebhookEvent,
} from "@repo/payment";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Activate a loan and transfer tokens from borrower → lender in DB.
 * This is idempotent — it short-circuits if loan is already ACTIVE.
 */
async function activateAndTransfer(loanId: string, razorpayPaymentId?: string) {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { collateralToken: true },
  });

  if (!loan) throw new Error(`Loan ${loanId} not found`);
  // Idempotency guard — don't double-activate
  if (loan.status !== "REQUESTED") return loan;

  // Transfer loan.amountINR tokens from borrower → lender
  // 1. Deduct from borrower
  await prisma.tokenHolding.update({
    where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.borrowerId } },
    data: { balance: { decrement: loan.amountINR } },
  });

  // 2. Credit to lender
  await prisma.tokenHolding.upsert({
    where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.lenderId } },
    update: { balance: { increment: loan.amountINR } },
    create: {
      tokenId: loan.collateralTokenId,
      holderId: loan.lenderId,
      balance: loan.amountINR,
    },
  });

  // 3. Mark loan ACTIVE
  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: {
      status: "ACTIVE",
      ...(razorpayPaymentId ? { txHash: razorpayPaymentId } : {}),
    },
    include: {
      borrower: { select: { id: true, name: true, email: true, walletAddress: true } },
      lender: { select: { id: true, name: true, email: true, walletAddress: true } },
      collateralToken: true,
    },
  });

  return updated;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /payments/create-order
 * Lender creates a Razorpay order to "pay" the loan activation fee
 * (i.e., the loan amount is tracked, and Razorpay acts as the payment proof mechanism).
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { loanId } = req.body as { loanId: string };
    const lender = req.user!;

    if (!loanId) {
      return res.status(400).json({ success: false, message: "loanId is required" });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: {
          select: {
            id: true,
            name: true,
            email: true,
            razorpayAccountId: true,
            bankAccount: {
              select: {
                accountHolderName: true,
                bankName: true,
                upiId: true,
                isVerified: true,
              },
            },
          },
        },
        lender: { select: { id: true, name: true, email: true } },
        collateralToken: { select: { tokenName: true, symbol: true } },
      },
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    if (loan.lenderId !== lender.id) {
      return res.status(403).json({ success: false, message: "Only the lender can initiate payment" });
    }
    if (loan.status !== "REQUESTED") {
      return res.status(400).json({ success: false, message: `Loan is already ${loan.status}` });
    }

    const amountINR = Number(loan.amountINR);
    const amountPaise = Math.round(amountINR * 100);

    // ── Build Razorpay Route transfer (if borrower has a linked account) ──────
    // This routes the loan amount directly to the borrower's bank account.
    const borrowerAccountId = loan.borrower.razorpayAccountId;
    const transfers = borrowerAccountId
      ? [
          {
            account: borrowerAccountId,
            amount: amountPaise,          // full loan amount goes to borrower
            currency: "INR",
            notes: {
              loanId,
              purpose: "P2P loan disbursement",
              borrowerEmail: loan.borrower.email ?? "",
            },
          },
        ]
      : undefined;

    if (!borrowerAccountId) {
      console.warn(
        `[payment/createOrder] Borrower ${loan.borrower.id} has no razorpayAccountId — ` +
        `payment will go to merchant account (borrower must add bank details).`
      );
    }

    const order = await rzpCreateOrder({
      amountINR,
      receipt: loanId,
      transfers,
      notes: {
        loanId,
        lenderId: lender.id,
        borrowerId: loan.borrowerId,
        borrowerName: (loan.borrower.name || loan.borrower.email) as string,
        collateralToken: loan.collateralToken.symbol,
        transferMode: borrowerAccountId ? "razorpay_route" : "merchant_account",
      } as Record<string, string>,
    });

    return res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      loan,
      keyId: process.env["RAZORPAY_KEY_ID"],
      // Let the UI know whether the borrower has bank details set up
      hasBankAccount: !!borrowerAccountId,
      borrowerBankInfo: loan.borrower.bankAccount
        ? {
            bankName: loan.borrower.bankAccount.bankName,
            accountHolderName: loan.borrower.bankAccount.accountHolderName,
            isVerified: loan.borrower.bankAccount.isVerified,
          }
        : null,
    });
  } catch (error) {
    console.error("[payment/createOrder]", error);
    return res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
};

/**
 * POST /payments/verify-and-activate
 * Called by the client after Razorpay checkout succeeds.
 * Verifies HMAC signature, activates loan, and transfers tokens.
 */
export const verifyAndActivate = async (req: Request, res: Response) => {
  try {
    const { loanId, orderId, paymentId, signature } = req.body as {
      loanId: string;
      orderId: string;
      paymentId: string;
      signature: string;
    };
    const lender = req.user!;

    if (!loanId || !orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, message: "Missing required fields: loanId, orderId, paymentId, signature" });
    }

    // Verify signature — this is the security-critical step
    const isValid = verifyPaymentSignature({ orderId, paymentId, signature });
    if (!isValid) {
      console.warn("[payment/verifyAndActivate] Invalid signature for orderId:", orderId);
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    // Verify the lender owns this loan
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    if (loan.lenderId !== lender.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const updatedLoan = await activateAndTransfer(loanId, paymentId);

    return res.json({
      success: true,
      message: "Payment verified. Loan activated and tokens transferred.",
      loan: updatedLoan,
    });
  } catch (error) {
    console.error("[payment/verifyAndActivate]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * POST /payments/webhook
 * Razorpay webhook endpoint — acts as a backup/confirmation mechanism.
 * IMPORTANT: body must be raw (not JSON-parsed) for signature verification.
 */
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"];
    if (!webhookSecret) {
      console.error("[payment/webhook] RAZORPAY_WEBHOOK_SECRET not configured");
      return res.status(500).send("Webhook secret not configured");
    }

    const rawBody = req.body.toString();
    const signature = req.headers["x-razorpay-signature"] as string;

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.warn("[payment/webhook] Invalid webhook signature");
      return res.status(400).send("Invalid signature");
    }

    const event = parseWebhookEvent(rawBody);
    console.log(`[payment/webhook] Event: ${event.event}`);

    // Handle payment.captured — backup activation
    if (event.event === "payment.captured" || event.event === "payment.authorized") {
      const payment = event.payload.payment?.entity;
      const order = event.payload.order?.entity;

      const loanId = payment?.description || order?.receipt || payment?.order_id;
      // Prefer receipt from order notes
      const notesLoanId = (order?.notes as any)?.loanId || (payment as any)?.notes?.loanId;
      const resolvedLoanId = notesLoanId || loanId;

      if (resolvedLoanId) {
        try {
          await activateAndTransfer(resolvedLoanId, payment?.id);
          console.log(`[payment/webhook] Loan ${resolvedLoanId} activated via webhook`);
        } catch (e) {
          console.warn("[payment/webhook] activateAndTransfer failed:", e);
        }
      } else {
        console.warn("[payment/webhook] Could not resolve loanId from payment event");
      }
    }

    // Always respond 200 quickly so Razorpay doesn't retry
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[payment/webhook]", error);
    return res.status(500).send("Webhook processing failed");
  }
};
