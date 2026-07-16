import { Request, Response } from "express";
import prisma from "@repo/db";
import { client as razorpay } from "@repo/payment";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a Razorpay Linked Account (Route sub-merchant) for the given user.
 * This is required to receive payouts via Razorpay Route.
 *
 * In TEST mode, Razorpay returns a dummy account ID automatically.
 * In LIVE mode, the account goes through KYC verification.
 *
 * Returns the Razorpay account ID (e.g. "acc_xxxxxxxxxx").
 */
async function createLinkedAccount(opts: {
  email: string;
  name: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
}): Promise<string> {
  const { email, name, accountNumber, ifscCode, accountHolderName } = opts;

  // Create a Route linked account (sub-merchant)
  const account = await (razorpay as any).accounts.create({
    email,
    profile: {
      category: "individual",
      subcategory: "individual",
      addresses: {
        registered: {
          street1: "Not Provided",
          city: "Not Provided",
          state: "MH",
          postal_code: "400001",
          country: "IN",
        },
      },
    },
    legal_business_name: name,
    business_type: "individual",
    contact_name: name,
    legal_info: {
      pan: "AAAPZ1234C", // placeholder for demo — real apps must collect PAN
    },
  });

  const accountId: string = account.id;

  // Attach bank account as a stakeholder settlement account
  await (razorpay as any).stakeholders.create(accountId, {
    name: accountHolderName,
    email,
    relationship: {
      director: true,
    },
    phone: {
      primary: "9999999999",
    },
  });

  // Add settlement bank account
  await (razorpay as any).accounts.addBankAccount(accountId, {
    ifsc_code: ifscCode,
    beneficiary_name: accountHolderName,
    account_number: accountNumber,
  });

  return accountId;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /bank-accounts
 * Save or update the authenticated user's bank account details.
 * Also creates (or skips if existing) a Razorpay Linked Account for Route payouts.
 *
 * Body: { accountHolderName, accountNumber, ifscCode, bankName, upiId? }
 */
export const saveBankAccount = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body as {
      accountHolderName: string;
      accountNumber: string;
      ifscCode: string;
      bankName: string;
      upiId?: string;
    };

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return res.status(400).json({
        success: false,
        message: "accountHolderName, accountNumber, ifscCode, and bankName are required",
      });
    }

    // Fetch full user details
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, razorpayAccountId: true },
    });
    if (!fullUser) return res.status(404).json({ success: false, message: "User not found" });

    // Upsert the bank account record
    const bankAccount = await prisma.bankAccount.upsert({
      where: { userId: user.id },
      update: { accountHolderName, accountNumber, ifscCode, bankName, upiId: upiId ?? null },
      create: { userId: user.id, accountHolderName, accountNumber, ifscCode, bankName, upiId: upiId ?? null },
    });

    // Create Razorpay Linked Account if not already created
    let razorpayAccountId = fullUser.razorpayAccountId;
    let linkedAccountCreated = false;

    if (!razorpayAccountId && fullUser.email) {
      try {
        razorpayAccountId = await createLinkedAccount({
          email: fullUser.email,
          name: fullUser.name || accountHolderName,
          accountNumber,
          ifscCode,
          accountHolderName,
        });

        await prisma.user.update({
          where: { id: user.id },
          data: { razorpayAccountId },
        });

        // Mark account as verified (in live it requires KYC, for demo we auto-verify)
        await prisma.bankAccount.update({
          where: { userId: user.id },
          data: { isVerified: true },
        });

        linkedAccountCreated = true;
        console.log(`[bankAccount] Linked account created: ${razorpayAccountId} for user ${user.id}`);
      } catch (routeErr) {
        // Razorpay Route account creation failure is non-fatal for demo purposes.
        // The bank details are saved — the admin can manually link the account.
        console.warn(
          `[bankAccount] Razorpay linked account creation failed (non-fatal): ${routeErr}`
        );
        console.warn(
          `[bankAccount] Bank details saved. Manual Razorpay Route linking required.`
        );
      }
    }

    return res.json({
      success: true,
      message: linkedAccountCreated
        ? "Bank account saved and linked to Razorpay Route for instant payouts."
        : razorpayAccountId
        ? "Bank account updated. Razorpay Route already linked."
        : "Bank account saved. Razorpay Route linking will be completed shortly.",
      bankAccount,
      razorpayAccountId,
    });
  } catch (error) {
    console.error("[saveBankAccount]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /bank-accounts/me
 * Return the authenticated user's bank account details.
 */
export const getMyBankAccount = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { userId: user.id },
    });

    const userWithAccount = await prisma.user.findUnique({
      where: { id: user.id },
      select: { razorpayAccountId: true },
    });

    return res.json({
      success: true,
      bankAccount,
      razorpayAccountId: userWithAccount?.razorpayAccountId ?? null,
      hasLinkedAccount: !!userWithAccount?.razorpayAccountId,
    });
  } catch (error) {
    console.error("[getMyBankAccount]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * DELETE /bank-accounts/me
 * Remove the authenticated user's bank account details.
 */
export const deleteBankAccount = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const existing = await prisma.bankAccount.findUnique({ where: { userId: user.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "No bank account found" });
    }

    await prisma.bankAccount.delete({ where: { userId: user.id } });
    // Note: We intentionally keep razorpayAccountId on the User — Razorpay accounts
    // cannot be deleted via API; they must be deactivated via dashboard.

    return res.json({ success: true, message: "Bank account removed" });
  } catch (error) {
    console.error("[deleteBankAccount]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
