import { Request, Response } from "express";
import prisma from "@repo/db";
import { z } from "zod";

// ── Schemas ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  type: z.enum(["PUBLIC", "TARGETED"]),
  amountINR: z.number().positive().max(10_000_000),
  durationDays: z.number().int().min(1).max(3650),
  lenderIds: z.array(z.string()).optional(),
  note: z.string().max(500).optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /loan-requests
 * Create a new public or targeted loan request.
 */
export const createLoanRequest = async (req: Request, res: Response) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.flatten() });
    }

    const borrower = req.user!;
    const { type, amountINR, durationDays, lenderIds, note } = parsed.data;

    if (type === "TARGETED") {
      if (!lenderIds || lenderIds.length === 0) {
        return res.status(400).json({ success: false, message: "At least one lender is required for a targeted request" });
      }
      if (lenderIds.includes(borrower.id)) {
        return res.status(400).json({ success: false, message: "Cannot request a loan from yourself" });
      }
    }

    const request = await prisma.loanRequest.create({
      data: {
        borrowerId: borrower.id,
        type,
        amountINR,
        durationDays,
        note: note ?? null,
        ...(type === "TARGETED" && lenderIds && lenderIds.length > 0
          ? {
              targetedLenders: {
                create: lenderIds.map((lenderId) => ({ lenderId })),
              },
            }
          : {}),
      },
      include: {
        borrower: { select: { id: true, name: true, username: true, email: true, creditScore: true, image: true } },
        targetedLenders: {
          include: { lender: { select: { id: true, name: true, username: true, email: true } } },
        },
      },
    });

    return res.status(201).json({ success: true, request });
  } catch (error) {
    console.error("[createLoanRequest]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /loan-requests/notifications
 * Returns public and in-person (targeted) requests for the current user.
 *
 * Public requests:  all PENDING PUBLIC requests NOT from the current user.
 * In-person:        all LoanRequestLender rows where lenderId === currentUser.id.
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const [publicRequests, lenderRows] = await Promise.all([
      prisma.loanRequest.findMany({
        where: { type: "PUBLIC", status: "PENDING", borrowerId: { not: userId } },
        include: {
          borrower: {
            select: { id: true, name: true, username: true, email: true, image: true, creditScore: true, walletAddress: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      prisma.loanRequestLender.findMany({
        where: { lenderId: userId, status: "PENDING" },
        include: {
          loanRequest: {
            include: {
              borrower: {
                select: { id: true, name: true, username: true, email: true, image: true, creditScore: true, walletAddress: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // flatten lender rows to just the loan requests (add lenderRowId for decline)
    const inPersonRequests = lenderRows.map((row: { id: string; loanRequest: object }) => ({
      lenderRowId: row.id,
      ...row.loanRequest,
    }));

    // count pending notifications
    const pendingCount = publicRequests.length + inPersonRequests.length;

    return res.json({ success: true, publicRequests, inPersonRequests, pendingCount });
  } catch (error) {
    console.error("[getNotifications]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /loan-requests/:id
 * Full details of a single loan request (must be involved as borrower or targeted lender).
 */
export const getLoanRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const userId = req.user!.id;

    const request = await prisma.loanRequest.findUnique({
      where: { id },
      include: {
        borrower: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            image: true,
            creditScore: true,
            walletAddress: true,
            createdAt: true,
            _count: { select: { borrowedLoans: true, lentLoans: true } },
          },
        },
        targetedLenders: {
          include: { lender: { select: { id: true, name: true, username: true, email: true } } },
        },
      },
    });

    if (!request) return res.status(404).json({ success: false, message: "Loan request not found" });

    // Access control: borrower can always view; lender only if targeted or PUBLIC
    const isTargetedLender = request.targetedLenders.some((r: { lenderId: string }) => r.lenderId === userId);
    const isBorrower = request.borrowerId === userId;
    const canView = isBorrower || isTargetedLender || request.type === "PUBLIC";
    if (!canView) return res.status(403).json({ success: false, message: "Access denied" });

    return res.json({ success: true, request });
  } catch (error) {
    console.error("[getLoanRequest]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /loan-requests
 * Returns own (borrower) loan requests.
 */
export const getMyLoanRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const requests = await prisma.loanRequest.findMany({
      where: { borrowerId: userId },
      include: {
        targetedLenders: {
          include: { lender: { select: { id: true, name: true, username: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, requests });
  } catch (error) {
    console.error("[getMyLoanRequests]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * POST /loan-requests/:id/accept
 * Lender accepts a loan request → creates a Loan record and marks the request as ACCEPTED.
 */
export const acceptLoanRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const lender = req.user!;

    const request = await prisma.loanRequest.findUnique({
      where: { id },
      include: {
        borrower: { select: { id: true, walletAddress: true, token: { select: { id: true, contractAddress: true } } } },
        targetedLenders: true,
      },
    });

    if (!request) return res.status(404).json({ success: false, message: "Loan request not found" });
    if (request.status !== "PENDING") return res.status(400).json({ success: false, message: "Request is no longer pending" });
    if (request.borrowerId === lender.id) return res.status(400).json({ success: false, message: "Cannot accept your own request" });

    // For TARGETED: verify lender is in the list
    if (request.type === "TARGETED") {
      const isTargeted = request.targetedLenders.some((r: { lenderId: string }) => r.lenderId === lender.id);
      if (!isTargeted) return res.status(403).json({ success: false, message: "You were not targeted for this request" });
    }

    // Borrower must have a token to use as collateral
    const borrowerToken = request.borrower.token;
    if (!borrowerToken) {
      return res.status(400).json({ success: false, message: "Borrower has not initialized a token (no collateral available)" });
    }

    // Create the Loan record
    const loan = await prisma.loan.create({
      data: {
        borrowerId: request.borrowerId,
        lenderId: lender.id,
        amountINR: request.amountINR,
        collateralTokenId: borrowerToken.id,
        collateralAmount: 10, // default 10% of supply as collateral
        durationDays: request.durationDays,
        status: "ACTIVE",
      },
    });

    // Mark request + lenderRow accepted
    await prisma.$transaction([
      prisma.loanRequest.update({ where: { id }, data: { status: "ACCEPTED", loanId: loan.id } }),
      ...(request.type === "TARGETED"
        ? [
            prisma.loanRequestLender.updateMany({
              where: { loanRequestId: id, lenderId: lender.id },
              data: { status: "ACCEPTED" },
            }),
          ]
        : []),
    ]);

    const full = await prisma.loan.findUnique({
      where: { id: loan.id },
      include: {
        borrower: { select: { id: true, name: true, email: true, walletAddress: true } },
        lender: { select: { id: true, name: true, email: true, walletAddress: true } },
        collateralToken: true,
      },
    });

    return res.status(201).json({ success: true, loan: full });
  } catch (error) {
    console.error("[acceptLoanRequest]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * POST /loan-requests/:id/decline
 * Lender declines a targeted loan request.
 */
export const declineLoanRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const lender = req.user!;

    const request = await prisma.loanRequest.findUnique({
      where: { id },
      include: { targetedLenders: true },
    });

    if (!request) return res.status(404).json({ success: false, message: "Loan request not found" });
    if (request.status !== "PENDING") return res.status(400).json({ success: false, message: "Request is no longer pending" });

    if (request.type === "TARGETED") {
      const row = request.targetedLenders.find((r: { id: string; lenderId: string }) => r.lenderId === lender.id);
      if (!row) return res.status(403).json({ success: false, message: "You were not targeted for this request" });

      await prisma.loanRequestLender.update({ where: { id: row.id }, data: { status: "DECLINED" } });

      // If all targeted lenders declined, mark the whole request declined
      const remaining = await prisma.loanRequestLender.count({
        where: { loanRequestId: id, status: "PENDING" },
      });
      if (remaining === 0) {
        await prisma.loanRequest.update({ where: { id }, data: { status: "DECLINED" } });
      }
    }

    return res.json({ success: true, message: "Request declined" });
  } catch (error) {
    console.error("[declineLoanRequest]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * DELETE /loan-requests/:id
 * Borrower cancels their own pending request.
 */
export const cancelLoanRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const borrower = req.user!;

    const request = await prisma.loanRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ success: false, message: "Loan request not found" });
    if (request.borrowerId !== borrower.id) return res.status(403).json({ success: false, message: "Access denied" });
    if (request.status !== "PENDING") return res.status(400).json({ success: false, message: "Only PENDING requests can be cancelled" });

    await prisma.loanRequest.update({ where: { id }, data: { status: "CANCELLED" } });
    return res.json({ success: true, message: "Request cancelled" });
  } catch (error) {
    console.error("[cancelLoanRequest]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * GET /loan-requests/notifications/count
 * Returns pending count for notification badge.
 */
export const getNotificationCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const [publicCount, inPersonCount] = await Promise.all([
      prisma.loanRequest.count({ where: { type: "PUBLIC", status: "PENDING", borrowerId: { not: userId } } }),
      prisma.loanRequestLender.count({ where: { lenderId: userId, status: "PENDING" } }),
    ]);
    return res.json({ success: true, count: publicCount + inPersonCount });
  } catch (error) {
    console.error("[getNotificationCount]", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
