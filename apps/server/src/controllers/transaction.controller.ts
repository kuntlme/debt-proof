import { Request, Response } from "express";
import prisma from "@repo/db";

/**
 * GET /transactions
 * Return paginated loan activity (all status changes) for the authenticated user.
 */
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where: { OR: [{ borrowerId: user.id }, { lenderId: user.id }] },
        include: {
          borrower: { select: { id: true, name: true, email: true, image: true, walletAddress: true } },
          lender: { select: { id: true, name: true, email: true, image: true, walletAddress: true } },
          collateralToken: { select: { tokenName: true, symbol: true, contractAddress: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.loan.count({
        where: { OR: [{ borrowerId: user.id }, { lenderId: user.id }] },
      }),
    ]);

    return res.json({
      success: true,
      transactions: loans,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[getTransactions]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};