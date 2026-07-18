import prisma from "@repo/db";

// ── Credit Score Constants ────────────────────────────────────────────────────
export const CREDIT_SCORE_MIN = 300;
export const CREDIT_SCORE_MAX = 850;
export const CREDIT_SCORE_DEFAULT = 500;

/**
 * Minimum credit score a borrower must have to:
 *  - Create a new loan request
 *  - Have a lender accept their request
 */
export const MIN_BORROW_CREDIT_SCORE = 200;

// Points awarded / deducted per event
const POINTS = {
  REPAID: +80,          // Loan fully repaid → positive behaviour
  DEFAULTED: -150,      // Loan defaulted → very negative
  ACTIVE_LOAN: -10,     // Each current active loan reduces score (outstanding debt)
  CANCELLED_LOAN: -5,   // Cancelled loans (borrower backed out)
  REQUESTED_LOAN: -2,   // Pending requests show intent to take on more debt (small penalty)
  NEW_USER_BONUS: 0,    // No bonus; default 500 is neutral
} as const;

/**
 * Recalculate a user's credit score from scratch based on their full loan history
 * and persist the new value to the database.
 *
 * Algorithm:
 *   score = DEFAULT
 *         + (repaidCount × POINTS.REPAID)
 *         + (defaultedCount × POINTS.DEFAULTED)
 *         + (activeCount × POINTS.ACTIVE_LOAN)
 *         + (cancelledCount × POINTS.CANCELLED_LOAN)
 *         + (pendingRequestCount × POINTS.REQUESTED_LOAN)
 *   score = clamp(score, MIN, MAX)
 *
 * @param userId - The user's database ID (borrower perspective)
 * @returns The newly computed and persisted credit score
 */
export async function recalculateCreditScore(userId: string): Promise<number> {
  // Fetch all loan statuses where this user was the BORROWER
  const [loans, pendingRequests] = await Promise.all([
    prisma.loan.findMany({
      where: { borrowerId: userId },
      select: { status: true },
    }),
    prisma.loanRequest.count({
      where: { borrowerId: userId, status: "PENDING" },
    }),
  ]);

  const repaidCount    = loans.filter((l) => l.status === "REPAID").length;
  const defaultedCount = loans.filter((l) => l.status === "DEFAULTED").length;
  const activeCount    = loans.filter((l) => l.status === "ACTIVE").length;
  const cancelledCount = loans.filter((l) => l.status === "CANCELLED").length;

  const raw =
    CREDIT_SCORE_DEFAULT +
    repaidCount    * POINTS.REPAID +
    defaultedCount * POINTS.DEFAULTED +
    activeCount    * POINTS.ACTIVE_LOAN +
    cancelledCount * POINTS.CANCELLED_LOAN +
    pendingRequests * POINTS.REQUESTED_LOAN;

  const clamped = Math.max(CREDIT_SCORE_MIN, Math.min(CREDIT_SCORE_MAX, Math.round(raw)));

  await prisma.user.update({
    where: { id: userId },
    data: { creditScore: clamped },
  });

  console.log(
    `[creditScore] User ${userId}: repaid=${repaidCount} defaulted=${defaultedCount} ` +
    `active=${activeCount} cancelled=${cancelledCount} pending=${pendingRequests} → score=${clamped}`
  );

  return clamped;
}

/**
 * Returns a human-readable credit tier label for display purposes.
 */
export function getCreditTier(score: number): {
  label: string;
  color: string;
  canBorrow: boolean;
} {
  if (score >= 750) return { label: "Excellent", color: "emerald", canBorrow: true };
  if (score >= 650) return { label: "Good",      color: "green",   canBorrow: true };
  if (score >= 550) return { label: "Fair",      color: "yellow",  canBorrow: true };
  if (score >= MIN_BORROW_CREDIT_SCORE) return { label: "Poor", color: "orange", canBorrow: true };
  return                { label: "Very Poor", color: "red",    canBorrow: false };
}
