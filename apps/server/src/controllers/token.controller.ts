import { Request, Response } from "express";
import prisma from "@repo/db";
import { createTokenSchema } from "../schemas/token.schema";
import { deployDebtToken, getTokenBalance, getTokenInfo } from "../services/token.service";

/**
 * POST /tokens/create
 * Deploy a new DebtToken ERC-20 for the authenticated user.
 * Each user can only have one personal token.
 */
export const createToken = async (req: Request, res: Response) => {
  try {
    const parsed = createTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten() });
    }

    const user = req.user!;

    if (!user.walletAddress) {
      return res.status(400).json({
        success: false,
        message: "You must initialize a wallet before creating a token",
      });
    }

    const existingToken = await prisma.personalToken.findUnique({
      where: { ownerId: user.id },
    });
    if (existingToken) {
      return res.status(409).json({ success: false, message: "Token already exists" });
    }

    // Deploy ERC-20 on blockchain
    const { contractAddress, txHash } = await deployDebtToken(
      user.walletAddress,
      parsed.data.tokenName,
      parsed.data.symbol,
      100
    );

    // Save to DB
    const token = await prisma.personalToken.create({
      data: {
        ownerId: user.id,
        tokenName: parsed.data.tokenName,
        symbol: parsed.data.symbol,
        contractAddress,
        totalSupply: 100,
      },
    });

    // Create initial holding record (owner holds all 100)
    await prisma.tokenHolding.create({
      data: {
        tokenId: token.id,
        holderId: user.id,
        balance: 100,
      },
    });

    return res.status(201).json({ success: true, token, txHash });
  } catch (error) {
    console.error("[createToken]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /tokens/me
 * Return the authenticated user's own token with live on-chain data.
 */
export const getToken = async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const token = await prisma.personalToken.findUnique({
      where: { ownerId: user.id },
      include: {
        tokenHoldings: {
          include: {
            holder: { select: { id: true, name: true, email: true, walletAddress: true } },
          },
        },
      },
    });

    if (!token) {
      return res.status(404).json({ success: false, message: "No token found. Create one first." });
    }

    // Optionally enrich with live on-chain data
    let onChainInfo = null;
    try {
      onChainInfo = await getTokenInfo(token.contractAddress);
    } catch (_) {
      // Blockchain not available — return DB data only
    }

    return res.json({ success: true, token, onChainInfo });
  } catch (error) {
    console.error("[getToken]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /tokens/:tokenId/holders
 * Return all holders of a given token.
 */
export const getTokenHolder = async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;

    const token = await prisma.personalToken.findUnique({
      where: { id: tokenId },
      include: {
        tokenHoldings: {
          include: {
            holder: { select: { id: true, name: true, email: true, walletAddress: true } },
          },
          orderBy: { balance: "desc" },
        },
      },
    });

    if (!token) {
      return res.status(404).json({ success: false, message: "Token not found" });
    }

    return res.json({ success: true, token });
  } catch (error) {
    console.error("[getTokenHolder]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /tokens/portfolio
 * Return all tokens the authenticated user holds (across all tokens).
 */
export const getPortfolio = async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    const holdings = await prisma.tokenHolding.findMany({
      where: { holderId: user.id, balance: { gt: 0 } },
      include: {
        token: {
          include: {
            owner: { select: { id: true, name: true, email: true, walletAddress: true } },
          },
        },
      },
      orderBy: { balance: "desc" },
    });

    const totalTokens = holdings.length;
    const totalBalance = (holdings as any[]).reduce((sum: number, h: any) => sum + Number(h.balance), 0);

    return res.json({ success: true, holdings, totalTokens, totalBalance });
  } catch (error) {
    console.error("[getPortfolio]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
