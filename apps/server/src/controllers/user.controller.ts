import { Request, Response } from "express";
import prisma from "@repo/db";
import { generateWallet } from "../services/blockchain.service";
import jwt from "jsonwebtoken";

/**
 * POST /users
 * Register a user by generating them a wallet.
 * Called internally after OAuth login to initialize their wallet.
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.walletAddress) {
      return res.status(409).json({
        success: false,
        message: "Wallet already exists",
        walletAddress: user.walletAddress,
      });
    }

    // Generate a wallet. Password = userId (deterministic enough for demo; in prod use HSM)
    const encryptionPassword = process.env.WALLET_ENCRYPTION_SECRET || userId;
    const { address, encryptedJson } = await generateWallet(encryptionPassword);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: address,
        // Store encrypted keystore JSON in a new field (add to schema if needed)
      },
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
 * Return the authenticated user's profile including wallet address.
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
        walletAddress: true,
        createdAt: true,
        token: {
          select: {
            id: true,
            tokenName: true,
            symbol: true,
            contractAddress: true,
            totalSupply: true,
          },
        },
        _count: {
          select: {
            borrowedLoans: true,
            lentLoans: true,
          },
        },
      },
    });

    return res.json({ success: true, user: full });
  } catch (error) {
    console.error("[getUser]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /users/search?q=email
 * Search users by email/name (for loan creation — select lender)
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
        ],
        NOT: { id: req.user!.id }, // Exclude self
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        walletAddress: true,
        token: { select: { tokenName: true, symbol: true, contractAddress: true } },
      },
      take: 10,
    });

    return res.json({ success: true, users });
  } catch (error) {
    console.error("[searchUsers]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * POST /users/token
 * Issue a JWT for the authenticated user (for the Express API)
 */
export const issueToken = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not set");

    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "7d" });
    return res.json({ success: true, token });
  } catch (error) {
    console.error("[issueToken]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
