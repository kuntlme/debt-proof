import { Request, Response } from "express";
import prisma from "@repo/db";
import {
  createOrder as rzpCreateOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  parseWebhookEvent,
} from "@repo/payment";
import { recalculateCreditScore } from "../services/creditScore.service.js";
import { repayLoanOnChain } from "../services/loan.service.js";
import { transferTokens } from "../services/token.service.js";
import { getPrivateKeyForUser } from "../services/wallet.service.js";
import { getProvider } from "../services/blockchain.service.js";

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

  // Recalculate credit score — active loan slightly reduces the borrower's score
  try {
    await recalculateCreditScore(updated.borrower.id);
  } catch (e) {
    console.warn("[activateAndTransfer] credit score recalculation failed (non-fatal):", e);
  }

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

    // ── Build Razorpay Route transfer (if borrower has a real linked account) ──
    // A real Razorpay Route account ID always starts with "acc_".
    // Placeholder IDs ("bank_account_only:...") mean bank details exist in DB
    // but the Route API failed (e.g. test mode) — skip Route transfer in that case.
    const borrowerAccountId = loan.borrower.razorpayAccountId;
    const hasBorrowerBankDetails = !!loan.borrower.bankAccount; // true if bank record exists in DB
    const isRealRouteAccount = !!borrowerAccountId && borrowerAccountId.startsWith("acc_");

    // ── Guard: borrower must have bank details before payment can be initiated ──
    // Without bank details there is no way to route the loan amount to the borrower,
    // so we refuse the request rather than silently settling into the merchant account.
    if (!hasBorrowerBankDetails) {
      console.warn(
        `[payment/createOrder] Borrower ${loan.borrower.id} has no bank account on file — ` +
        `blocking order creation.`
      );
      return res.status(400).json({
        success: false,
        message:
          "The borrower has not added a bank account yet. " +
          "Ask them to go to Profile → Bank Account and save their details before you pay.",
        code: "BORROWER_NO_BANK_ACCOUNT",
      });
    }

    if (!isRealRouteAccount) {
      // Bank details exist but no live Razorpay Route account (common in test mode).
      // Log info only — payment proceeds and settles to the merchant account.
      console.info(
        `[payment/createOrder] Borrower ${loan.borrower.id} has bank details saved but no live ` +
        `Razorpay Route account (id="${borrowerAccountId}"). ` +
        `Payment goes to merchant account; bank details are on record.`
      );
    }

    const transfers = isRealRouteAccount
      ? [
          {
            account: borrowerAccountId!,
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
        transferMode: isRealRouteAccount ? "razorpay_route" : "bank_on_file_no_route",
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
      // hasBankAccount = true if borrower has bank details saved in DB (regardless of Route status)
      hasBankAccount: hasBorrowerBankDetails,
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
 * POST /payments/create-repay-order
 * Borrower creates a Razorpay order to repay the loan amount back to the lender.
 * After successful payment, the borrower's collateral is released.
 */
export const createRepayOrder = async (req: Request, res: Response) => {
  try {
    const { loanId } = req.body as { loanId: string };
    const borrower = req.user!;

    if (!loanId) {
      return res.status(400).json({ success: false, message: "loanId is required" });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: { select: { id: true, name: true, email: true } },
        lender: {
          select: {
            id: true,
            name: true,
            email: true,
            razorpayAccountId: true,
            bankAccount: {
              select: {
                accountHolderName: true,
                bankName: true,
                isVerified: true,
              },
            },
          },
        },
        collateralToken: { select: { tokenName: true, symbol: true } },
      },
    });

    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    if (loan.borrowerId !== borrower.id) {
      return res.status(403).json({ success: false, message: "Only the borrower can initiate repayment" });
    }
    if (loan.status !== "ACTIVE") {
      return res.status(400).json({ success: false, message: `Loan is not active (current status: ${loan.status})` });
    }

    const amountINR = Number(loan.amountINR);
    const amountPaise = Math.round(amountINR * 100);

    // ── Guard: lender must have bank details before repayment can be initiated ──
    // Without a destination account there is no way to route the repayment to the
    // lender, so we refuse rather than silently settling into the merchant account.
    const hasLenderBankDetails = !!loan.lender.bankAccount;
    const lenderAccountId = loan.lender.razorpayAccountId;
    const isRealRouteAccount = !!lenderAccountId && lenderAccountId.startsWith("acc_");

    if (!hasLenderBankDetails) {
      console.warn(
        `[payment/createRepayOrder] Lender ${loan.lenderId} has no bank account on file — ` +
        `blocking repayment order creation.`
      );
      return res.status(400).json({
        success: false,
        message:
          "The lender has not added a bank account yet. " +
          "They need to go to Profile → Bank Account and save their details before you can repay.",
        code: "LENDER_NO_BANK_ACCOUNT",
      });
    }

    if (!isRealRouteAccount) {
      // Bank details exist but no live Razorpay Route account (common in test mode).
      // Log info only — repayment order is still created and settles to the merchant account.
      console.info(
        `[payment/createRepayOrder] Lender ${loan.lenderId} has bank details saved but no live ` +
        `Razorpay Route account (id="${lenderAccountId}"). ` +
        `Repayment goes to merchant account; bank details are on record.`
      );
    }

    const transfers = isRealRouteAccount
      ? [
          {
            account: lenderAccountId!,
            amount: amountPaise,
            currency: "INR",
            notes: {
              loanId,
              purpose: "P2P loan repayment",
              lenderEmail: loan.lender.email ?? "",
            },
          },
        ]
      : undefined;

    const order = await rzpCreateOrder({
      amountINR,
      receipt: `repay_${loanId}`,
      transfers,
      notes: {
        loanId,
        type: "repayment",
        borrowerId: borrower.id,
        lenderId: loan.lenderId,
        collateralToken: loan.collateralToken.symbol,
        transferMode: isRealRouteAccount ? "razorpay_route" : "merchant_account",
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
    });
  } catch (error) {
    console.error("[payment/createRepayOrder]", error);
    return res.status(500).json({ success: false, message: "Failed to create repayment order" });
  }
};

/**
 * POST /payments/verify-and-repay
 * Called by the client after borrower's Razorpay repayment checkout succeeds.
 * Verifies HMAC signature, returns collateral to borrower, marks loan REPAID.
 */
export const verifyAndRepay = async (req: Request, res: Response) => {
  try {
    const { loanId, orderId, paymentId, signature } = req.body as {
      loanId: string;
      orderId: string;
      paymentId: string;
      signature: string;
    };
    const borrower = req.user!;

    if (!loanId || !orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, message: "Missing required fields: loanId, orderId, paymentId, signature" });
    }

    // Verify Razorpay HMAC signature
    const isValid = verifyPaymentSignature({ orderId, paymentId, signature });
    if (!isValid) {
      console.warn("[payment/verifyAndRepay] Invalid signature for orderId:", orderId);
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    // Load loan with collateral details
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { collateralToken: true },
    });
    if (!loan) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    if (loan.borrowerId !== borrower.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (loan.status !== "ACTIVE") {
      // Idempotency: already repaid is fine
      if (loan.status === "REPAID") {
        return res.json({ success: true, message: "Loan already repaid.", loan });
      }
      return res.status(400).json({ success: false, message: `Loan is not active (current: ${loan.status})` });
    }

    // ── On-chain settlement (non-fatal) ──────────────────────────────────────
    // Only attempt if the loan has a blockchain ID (i.e. was registered on-chain).
    let onChainTxHash: string | null = null;
    if (loan.blockchainLoanId != null) {
      try {
        const borrowerKey = await getPrivateKeyForUser(borrower.id);
        const borrowerRecord = await prisma.user.findUnique({
          where: { id: borrower.id },
          select: { walletAddress: true },
        });
        const lenderRecord = await prisma.user.findUnique({
          where: { id: loan.lenderId },
          select: { walletAddress: true },
        });

        if (!borrowerRecord?.walletAddress) throw new Error("Borrower has no wallet address");
        if (!lenderRecord?.walletAddress)  throw new Error("Lender has no wallet address");

        const provider = getProvider();
        const startNonce = await provider.getTransactionCount(borrowerRecord.walletAddress, "pending");

        // 1. ERC-20 transfer: borrower → lender (the token-repayment portion)
        await transferTokens(
          loan.collateralToken.contractAddress,
          borrowerKey,
          lenderRecord.walletAddress,
          loan.amountINR.toString(),
          startNonce
        );

        // 2. LoanManager.repayLoan() — releases collateral back to borrower on-chain
        onChainTxHash = await repayLoanOnChain(loan.blockchainLoanId, borrowerKey, startNonce + 1);

        console.log(`[verifyAndRepay] On-chain repayment succeeded. txHash=${onChainTxHash}`);
      } catch (e) {
        console.warn(
          "[verifyAndRepay] On-chain repayment failed (non-fatal — DB settlement still applied):",
          e
        );
      }
    } else {
      console.info(
        `[verifyAndRepay] Loan ${loanId} has no blockchainLoanId — ` +
        `skipping on-chain calls; DB-only settlement applied.`
      );
    }

    // ── DB token settlement ───────────────────────────────────────────────────
    // The lifecycle is:
    //   Activation : borrower.balance -= amountINR, lender.balance += amountINR
    //                (lender receives debt-tokens as proof of loan)
    //   Repayment  : lender.balance -= amountINR, borrower.balance += amountINR
    //                (lender gives back the held tokens — reverse of activation)
    //              + borrower.balance += collateralAmount
    //                (the collateral that was locked at loan creation is released)

    // 1. Deduct the held tokens from the lender's holding
    await prisma.tokenHolding.update({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.lenderId } },
      data: { balance: { decrement: loan.amountINR } },
    });

    // 2. Credit those tokens back to the borrower
    await prisma.tokenHolding.update({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.borrowerId } },
      data: { balance: { increment: loan.amountINR } },
    });

    // 3. Return the collateral that was locked at loan creation back to the borrower
    await prisma.tokenHolding.update({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.borrowerId } },
      data: { balance: { increment: loan.collateralAmount } },
    });

    // 4. Mark loan REPAID — prefer on-chain txHash, fall back to Razorpay paymentId
    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: "REPAID",
        repaidAt: new Date(),
        txHash: onChainTxHash ?? paymentId,
      },
      include: {
        borrower: { select: { id: true, name: true, email: true, walletAddress: true } },
        lender: { select: { id: true, name: true, email: true, walletAddress: true } },
        collateralToken: true,
      },
    });

    // Recalculate borrower's credit score after successful repayment
    let newCreditScore: number | null = null;
    try {
      newCreditScore = await recalculateCreditScore(borrower.id);
    } catch (e) {
      console.warn("[verifyAndRepay] credit score recalculation failed (non-fatal):", e);
    }

    return res.json({
      success: true,
      message: "Repayment verified. Collateral released and loan marked REPAID.",
      loan: updated,
      newCreditScore,
    });
  } catch (error) {
    console.error("[payment/verifyAndRepay]", error);
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
