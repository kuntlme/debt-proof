import { razorpay } from "./client.js";
import type { CreateRefundOptions, RazorpayRefund } from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function inrToPaise(inr: number): number {
  return Math.round(inr * 100);
}

// ── Refund API ────────────────────────────────────────────────────────────────

/**
 * Create a refund for a captured payment.
 *
 * - Full refund: omit `amountINR` or pass the total payment amount.
 * - Partial refund: pass a smaller `amountINR`.
 *
 * @example
 * // Full refund
 * const refund = await createRefund({ paymentId: "pay_xxx" });
 *
 * // Partial refund of ₹200
 * const refund = await createRefund({ paymentId: "pay_xxx", amountINR: 200 });
 */
export async function createRefund(opts: CreateRefundOptions): Promise<RazorpayRefund> {
  const { paymentId, amountINR, notes = {}, speed = "optimum" } = opts;

  if (!paymentId) throw new Error("[payment] createRefund: paymentId is required");

  const body: Record<string, unknown> = { speed, notes };
  if (amountINR !== undefined) {
    if (amountINR <= 0) {
      throw new Error(`[payment] createRefund: amountINR must be positive, got ${amountINR}`);
    }
    body["amount"] = inrToPaise(amountINR);
  }

  const refund = await razorpay.payments.refund(paymentId, body as any);
  return refund as unknown as RazorpayRefund;
}

/**
 * Fetch a specific refund by its refund ID and the parent payment ID.
 */
export async function fetchRefund(
  paymentId: string,
  refundId: string
): Promise<RazorpayRefund> {
  if (!paymentId) throw new Error("[payment] fetchRefund: paymentId is required");
  if (!refundId) throw new Error("[payment] fetchRefund: refundId is required");

  const refund = await razorpay.payments.fetchRefund(paymentId, refundId);
  return refund as unknown as RazorpayRefund;
}
