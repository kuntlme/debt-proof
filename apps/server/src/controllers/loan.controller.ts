import { Request, Response } from "express";
import prisma from "@repo/db";
import { z } from "zod";
import { ethers } from "ethers";
import {
  createLoanOnChain,
  activateLoanOnChain,
  repayLoanOnChain,
  defaultLoanOnChain,
  cancelLoanOnChain,
} from "../services/loan.service.js";
import { getPrivateKeyForUser } from "../services/wallet.service.js";
import { transferTokens } from "../services/token.service.js";
import { getProvider } from "../services/blockchain.service.js";

const createLoanSchema = z.object({
  lenderId: z.string().min(1),
  amountINR: z.number().positive().max(10_000_000),
  collateralTokenId: z.string().min(1),
  collateralAmount: z.number().positive(),
});

export const createLoan = async (req: Request, res: Response) => {
  try {
    const parsed = createLoanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten() });
    }
    const borrower = req.user!;
    const { lenderId, amountINR, collateralTokenId, collateralAmount } = parsed.data;

    if (borrower.id === lenderId) {
      return res.status(400).json({ success: false, message: "Cannot lend to yourself" });
    }
    if (!borrower.walletAddress) {
      return res.status(400).json({ success: false, message: "Borrower wallet not initialized" });
    }

    const lender = await prisma.user.findUnique({
      where: { id: lenderId },
      select: { id: true, walletAddress: true, name: true, email: true },
    });
    if (!lender?.walletAddress) {
      return res.status(404).json({ success: false, message: "Lender not found or has no wallet" });
    }

    const collateralToken = await prisma.personalToken.findUnique({ where: { id: collateralTokenId } });
    if (!collateralToken || collateralToken.ownerId !== borrower.id) {
      return res.status(403).json({ success: false, message: "Collateral token not owned by you" });
    }

    const holding = await prisma.tokenHolding.findUnique({
      where: { tokenId_holderId: { tokenId: collateralTokenId, holderId: borrower.id } },
    });
    if (!holding || Number(holding.balance) < collateralAmount) {
      return res.status(400).json({ success: false, message: "Insufficient collateral token balance" });
    }

    // Deduct collateral from borrower's holding
    await prisma.tokenHolding.update({
      where: { tokenId_holderId: { tokenId: collateralTokenId, holderId: borrower.id } },
      data: { balance: { decrement: collateralAmount } },
    });

    const loan = await prisma.loan.create({
      data: { borrowerId: borrower.id, lenderId, amountINR, collateralTokenId, collateralAmount, status: "REQUESTED" },
    });

    let txHash: string | null = null;
    try {
      const borrowerKey = process.env.DEMO_BORROWER_PRIVATE_KEY || "";
      if (borrowerKey) {
        const result = await createLoanOnChain({
          lenderAddress: lender.walletAddress!,
          amountINRPaise: Math.round(amountINR * 100),
          collateralTokenAddress: collateralToken.contractAddress,
          collateralAmountWei: ethers.parseUnits(collateralAmount.toString(), 18).toString(),
          offchainId: loan.id,
          borrowerPrivateKey: borrowerKey,
        });
        txHash = result.txHash;
      }
    } catch (e) {
      console.warn("[createLoan] blockchain call failed (non-fatal):", e);
    }

    if (txHash) {
      await prisma.loan.update({ where: { id: loan.id }, data: { txHash, status: "ACTIVE" } });
    }

    const full = await prisma.loan.findUnique({
      where: { id: loan.id },
      include: {
        borrower: { select: { id: true, name: true, email: true, walletAddress: true } },
        lender: { select: { id: true, name: true, email: true, walletAddress: true } },
        collateralToken: true,
      },
    });
    return res.status(201).json({ success: true, loan: full, txHash });
  } catch (error) {
    console.error("[createLoan]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getLoans = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { role, status } = req.query;

    const where: any = { OR: [{ borrowerId: user.id }, { lenderId: user.id }] };
    if (role === "borrower") where.OR = [{ borrowerId: user.id }];
    if (role === "lender") where.OR = [{ lenderId: user.id }];
    if (status) where.status = status as string;

    const loans = await prisma.loan.findMany({
      where,
      include: {
        borrower: { select: { id: true, name: true, email: true, image: true, walletAddress: true } },
        lender: { select: { id: true, name: true, email: true, image: true, walletAddress: true } },
        collateralToken: { select: { tokenName: true, symbol: true, contractAddress: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const stats = {
      totalBorrowed: (loans as any[]).filter((l) => l.borrowerId === user.id && l.status === "ACTIVE").reduce((s: number, l: any) => s + Number(l.amountINR), 0),
      totalLent: (loans as any[]).filter((l) => l.lenderId === user.id && l.status === "ACTIVE").reduce((s: number, l: any) => s + Number(l.amountINR), 0),
      activeLoans: (loans as any[]).filter((l) => l.status === "ACTIVE").length,
      repaidLoans: (loans as any[]).filter((l) => l.status === "REPAID").length,
    };

    return res.json({ success: true, loans, stats });
  } catch (error) {
    console.error("[getLoans]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getLoan = async (req: Request, res: Response) => {
  try {
    const { loanId } = req.params as any;
    const user = req.user!;
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: { select: { id: true, name: true, email: true, image: true, walletAddress: true } },
        lender: { select: { id: true, name: true, email: true, image: true, walletAddress: true } },
        collateralToken: true,
      },
    });
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });
    if (loan.borrowerId !== user.id && loan.lenderId !== user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    return res.json({ success: true, loan });
  } catch (error) {
    console.error("[getLoan]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const repayLoan = async (req: Request, res: Response) => {
  try {
    const { loanId } = req.params as any;
    const borrower = req.user!;
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        collateralToken: true,
      },
    });
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });
    if (loan.borrowerId !== borrower.id) return res.status(403).json({ success: false, message: "Only the borrower can repay" });
    if (loan.status !== "ACTIVE") return res.status(400).json({ success: false, message: "Loan is not active" });

    // Verify borrower has enough token balance for the repayment transfer
    const borrowerHolding = await prisma.tokenHolding.findUnique({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.borrowerId } },
    });
    if (!borrowerHolding || Number(borrowerHolding.balance) < Number(loan.amountINR)) {
      return res.status(400).json({ success: false, message: "Insufficient token balance to repay the loan" });
    }

    const lender = await prisma.user.findUnique({
      where: { id: loan.lenderId },
      select: { id: true, walletAddress: true },
    });
    if (!lender?.walletAddress) {
      return res.status(400).json({ success: false, message: "Lender has no wallet address" });
    }

    let txHash: string | null = null;
    // Call on-chain repayment (non-fatal)
    if (loan.blockchainLoanId != null) {
      try {
        const borrowerKey = await getPrivateKeyForUser(borrower.id);
        const borrowerRecord = await prisma.user.findUnique({
          where: { id: borrower.id },
          select: { walletAddress: true }
        });
        
        if (borrowerRecord?.walletAddress) {
          const provider = getProvider();
          const startNonce = await provider.getTransactionCount(borrowerRecord.walletAddress, "pending");

          // 1. Transfer repayment amount (loan.amountINR) from borrower to lender on-chain
          await transferTokens(
            loan.collateralToken.contractAddress,
            borrowerKey,
            lender.walletAddress,
            loan.amountINR.toString(),
            startNonce
          );

          // 2. Repay loan on-chain (releases collateral back to borrower)
          txHash = await repayLoanOnChain(loan.blockchainLoanId, borrowerKey, startNonce + 1);
        } else {
          throw new Error("Borrower has no wallet address");
        }
      } catch (e) {
        console.warn("[repayLoan] on-chain calls failed (non-fatal):", e);
      }
    }

    // 1. Deduct repayment amount from borrower's holding in DB
    await prisma.tokenHolding.update({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.borrowerId } },
      data: { balance: { decrement: loan.amountINR } },
    });

    // 2. Credit repayment amount to lender's holding in DB
    await prisma.tokenHolding.upsert({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.lenderId } },
      update: { balance: { increment: loan.amountINR } },
      create: {
        tokenId: loan.collateralTokenId,
        holderId: loan.lenderId,
        balance: loan.amountINR,
      },
    });

    // 3. Return collateral to borrower's holding in DB
    await prisma.tokenHolding.update({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.borrowerId } },
      data: { balance: { increment: loan.collateralAmount } },
    });

    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: "REPAID",
        repaidAt: new Date(),
        ...(txHash ? { txHash } : {}),
      },
      include: {
        borrower: { select: { id: true, name: true, email: true, walletAddress: true } },
        lender: { select: { id: true, name: true, email: true, walletAddress: true } },
        collateralToken: true,
      },
    });
    return res.json({ success: true, loan: updated });
  } catch (error) {
    console.error("[repayLoan]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const activateLoan = async (req: Request, res: Response) => {
  try {
    const { loanId } = req.params as any;
    const lender = req.user!;
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });
    if (loan.lenderId !== lender.id) return res.status(403).json({ success: false, message: "Only the lender can activate" });
    if (loan.status !== "REQUESTED") return res.status(400).json({ success: false, message: "Loan is not in REQUESTED state" });

    // Call on-chain activation (non-fatal)
    if (loan.blockchainLoanId != null) {
      try {
        const lenderKey = await getPrivateKeyForUser(lender.id);
        await activateLoanOnChain(loan.blockchainLoanId, lenderKey);
      } catch (e) {
        console.warn("[activateLoan] on-chain call failed (non-fatal):", e);
      }
    }

    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: { status: "ACTIVE" },
      include: {
        borrower: { select: { id: true, name: true, email: true, walletAddress: true } },
        lender: { select: { id: true, name: true, email: true, walletAddress: true } },
        collateralToken: true,
      },
    });
    return res.json({ success: true, loan: updated });
  } catch (error) {
    console.error("[activateLoan]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const defaultLoan = async (req: Request, res: Response) => {
  try {
    const { loanId } = req.params as any;
    const lender = req.user!;
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });
    if (loan.lenderId !== lender.id) return res.status(403).json({ success: false, message: "Only the lender can default" });
    if (loan.status !== "ACTIVE") return res.status(400).json({ success: false, message: "Loan is not active" });

    // Call on-chain default (non-fatal)
    if (loan.blockchainLoanId != null) {
      try {
        const lenderKey = await getPrivateKeyForUser(lender.id);
        await defaultLoanOnChain(loan.blockchainLoanId, lenderKey);
      } catch (e) {
        console.warn("[defaultLoan] on-chain call failed (non-fatal):", e);
      }
    }

    // Transfer collateral to lender's holding
    await prisma.tokenHolding.upsert({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.lenderId } },
      update: { balance: { increment: loan.collateralAmount } },
      create: {
        tokenId: loan.collateralTokenId,
        holderId: loan.lenderId,
        balance: loan.collateralAmount,
      },
    });

    const updated = await prisma.loan.update({
      where: { id: loanId },
      data: { status: "DEFAULTED" },
      include: {
        borrower: { select: { id: true, name: true, email: true, walletAddress: true } },
        lender: { select: { id: true, name: true, email: true, walletAddress: true } },
        collateralToken: true,
      },
    });
    return res.json({ success: true, loan: updated });
  } catch (error) {
    console.error("[defaultLoan]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const cancelLoan = async (req: Request, res: Response) => {
  try {
    const { loanId } = req.params as any;
    const borrower = req.user!;
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });
    if (loan.borrowerId !== borrower.id) return res.status(403).json({ success: false, message: "Only the borrower can cancel" });
    if (loan.status !== "REQUESTED") return res.status(400).json({ success: false, message: "Only REQUESTED loans can be cancelled" });

    // Call on-chain cancel (non-fatal)
    if (loan.blockchainLoanId != null) {
      try {
        const borrowerKey = await getPrivateKeyForUser(borrower.id);
        await cancelLoanOnChain(loan.blockchainLoanId, borrowerKey);
      } catch (e) {
        console.warn("[cancelLoan] on-chain call failed (non-fatal):", e);
      }
    }

    // Return collateral to borrower's holding
    await prisma.tokenHolding.update({
      where: { tokenId_holderId: { tokenId: loan.collateralTokenId, holderId: loan.borrowerId } },
      data: { balance: { increment: loan.collateralAmount } },
    });

    const updated = await prisma.loan.update({ where: { id: loanId }, data: { status: "CANCELLED" } });
    return res.json({ success: true, loan: updated });
  } catch (error) {
    console.error("[cancelLoan]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};