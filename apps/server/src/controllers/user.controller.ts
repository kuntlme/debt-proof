import { Request, Response } from "express";
import prisma from "@repo/db";
import { generateWallet, getDeployer, ethers, ensureGasFunds } from "../services/blockchain.service.js";
import { deployDebtToken } from "../services/token.service.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { recalculateCreditScore, getCreditTier, MIN_BORROW_CREDIT_SCORE, CREDIT_SCORE_MIN, CREDIT_SCORE_MAX } from "../services/creditScore.service.js";


// ── Helpers ──────────────────────────────────────────────────────────────────

function encryptSecret(text: string): string {
  const key = (process.env.WALLET_ENCRYPTION_SECRET || "default-key-32-bytes-exactly!!!!").slice(0, 32).padEnd(32, "0");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /users/check-username?username=xxx
 * Public — check if a username is still available.
 */
export const checkUsername = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;
    if (!username || typeof username !== "string" || username.length < 3) {
      return res.status(400).json({ success: false, message: "Username must be at least 3 characters" });
    }
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const existing = await prisma.user.findUnique({ where: { username: clean } });
    return res.json({ success: true, available: !existing, username: clean });
  } catch (error) {
    console.error("[checkUsername]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * POST /users/onboarding
 * Complete first-time onboarding:
 *   1. Save name, username, phone on the User record
 *   2. Generate Ethereum wallet (returns mnemonic + private key ONE TIME)
 *   3. Deploy personal DebtToken
 *   4. Mark onboardingComplete = true
 * Body: { userId, name, username, phone }
 */
export const completeOnboarding = async (req: Request, res: Response) => {
  try {
    const { userId, name, username, phone, skipToken } = req.body;
    if (!userId || !name || !username || !phone) {
      return res.status(400).json({ success: false, message: "userId, name, username and phone are required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.onboardingComplete) {
      return res.status(409).json({ success: false, message: "Onboarding already completed" });
    }

    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const taken = await prisma.user.findFirst({ where: { username: cleanUsername, NOT: { id: userId } } });
    if (taken) return res.status(409).json({ success: false, message: "Username already taken" });

    // 1. Generate wallet
    const encryptionPassword = process.env.WALLET_ENCRYPTION_SECRET || userId;
    const { address, encryptedJson, mnemonic, privateKey } = await generateWallet(encryptionPassword);

    // 1b. Fund the new wallet with ETH for gas (non-fatal)
    await ensureGasFunds(address);

    // 2. Store the encrypted JSON keystore (used by wallet.service to decrypt later)
    //    We store encryptedJson directly — decryptWallet(encryptedJson, password) recovers the key
    const encryptedSeedPhrase = encryptedJson;

    // 3. Deploy personal token (symbol derived from username, e.g. RAJ)
    const symbol = cleanUsername.slice(0, 4).toUpperCase();
    const tokenName = `${name.split(" ")[0]}'s Token`;
    let tokenData: { contractAddress: string; id: string; tokenName: string; symbol: string; totalSupply: number } | null = null;

    if (!skipToken) {
      try {
        const { contractAddress } = await deployDebtToken(address, tokenName, symbol, 10000);
        const dbToken = await prisma.personalToken.create({
          data: { ownerId: userId, tokenName, symbol, contractAddress, totalSupply: 10000 },
        });
        await prisma.tokenHolding.create({ data: { tokenId: dbToken.id, holderId: userId, balance: 10000 } });
        tokenData = { ...dbToken, totalSupply: 10000 };
      } catch (e) {
        console.warn("[completeOnboarding] token deploy failed (non-fatal):", e);
      }
    }

    // 4. Update user
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        username: cleanUsername,
        phone,
        walletAddress: address,
        encryptedSeedPhrase,
        onboardingComplete: true,
      },
      select: { id: true, name: true, email: true, username: true, walletAddress: true, onboardingComplete: true },
    });

    // Return mnemonic + privateKey only once — never stored in plain text again
    return res.status(201).json({
      success: true,
      user: updated,
      wallet: { address, mnemonic, privateKey },
      token: tokenData,
    });
  } catch (error) {
    console.error("[completeOnboarding]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * POST /users
 * Legacy: Register a user by generating them a wallet (kept for backward compat).
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.walletAddress) {
      return res.status(409).json({ success: false, message: "Wallet already exists", walletAddress: user.walletAddress });
    }

    const encryptionPassword = process.env.WALLET_ENCRYPTION_SECRET || userId;
    const { address } = await generateWallet(encryptionPassword);

    // Fund with gas (airdrop)
    await ensureGasFunds(address);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { walletAddress: address },
      select: { id: true, name: true, email: true, walletAddress: true },
    });

    return res.status(201).json({ success: true, user: updated });
  } catch (error) {
    console.error("[createUser]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /users/me
 * Return the authenticated user's full profile.
 */
export const getUser = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        username: true,
        phone: true,
        creditScore: true,
        walletAddress: true,
        onboardingComplete: true,
        createdAt: true,
        token: { select: { id: true, tokenName: true, symbol: true, contractAddress: true, totalSupply: true } },
        _count: { select: { borrowedLoans: true, lentLoans: true } },
      },
    });
    return res.json({ success: true, user: full });
  } catch (error) {
    console.error("[getUser]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /users/:userId/profile
 * Public profile — visible to all authenticated users.
 */
export const getPublicProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as any;
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        creditScore: true,
        walletAddress: true,
        createdAt: true,
        token: { select: { tokenName: true, symbol: true, contractAddress: true, totalSupply: true } },
        _count: { select: { borrowedLoans: true, lentLoans: true } },
        borrowedLoans: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, amountINR: true, status: true, createdAt: true, repaidAt: true, durationDays: true },
        },
      },
    });
    if (!profile) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, profile });
  } catch (error) {
    console.error("[getPublicProfile]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /users/search?q=email
 * Search users by email/name/username for loan request targeting.
 */
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string" || q.length < 2) {
      return res.status(400).json({ success: false, message: "Query must be at least 2 characters" });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { username: { contains: q, mode: "insensitive" } },
        ],
        NOT: { id: req.user!.id },
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        image: true,
        creditScore: true,
        walletAddress: true,
        token: { select: { tokenName: true, symbol: true, contractAddress: true } },
      },
      take: 15,
    });

    return res.json({ success: true, users });
  } catch (error) {
    console.error("[searchUsers]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * POST /users/token
 * Issue a JWT for the authenticated user (called from Next.js after OAuth).
 */
export const issueToken = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not set");

    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "7d" });
    return res.json({ success: true, token });
  } catch (error) {
    console.error("[issueToken]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /users/me/credit-score
 * Returns the current user's credit score, tier, loan breakdown, and enforced limits.
 * Also re-calculates the score from the latest loan history before responding.
 */
export const getCreditScore = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Always recalculate to make sure it's fresh
    const score = await recalculateCreditScore(userId);
    const tier = getCreditTier(score);

    // Build a breakdown of loans for context
    const loans = await prisma.loan.findMany({
      where: { borrowerId: userId },
      select: { status: true, amountINR: true, createdAt: true, repaidAt: true, durationDays: true },
      orderBy: { createdAt: "desc" },
    });

    const breakdown = {
      repaid:    loans.filter((l) => l.status === "REPAID").length,
      defaulted: loans.filter((l) => l.status === "DEFAULTED").length,
      active:    loans.filter((l) => l.status === "ACTIVE").length,
      cancelled: loans.filter((l) => l.status === "CANCELLED").length,
    };

    return res.json({
      success: true,
      creditScore: score,
      tier,
      breakdown,
      limits: {
        minRequired: MIN_BORROW_CREDIT_SCORE,
        min: CREDIT_SCORE_MIN,
        max: CREDIT_SCORE_MAX,
        canBorrow: tier.canBorrow,
      },
    });
  } catch (error) {
    console.error("[getCreditScore]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
