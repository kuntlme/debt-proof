import { razorpay } from "./client.js";
import type { CreateOrderOptions, RazorpayOrder } from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert INR (rupees) → paise (Razorpay always works in the smallest currency unit) */
function inrToPaise(inr: number): number {
  return Math.round(inr * 100);
}

// ── Order API ─────────────────────────────────────────────────────────────────

/**
 * Create a new Razorpay order.
 *
 * @example
 * const order = await createOrder({ amountINR: 5000, receipt: loan.id });
 * // → { id: "order_xxx", amount: 500000, currency: "INR", status: "created", ... }
 */
export async function createOrder(opts: CreateOrderOptions): Promise<RazorpayOrder> {
  const { amountINR, receipt, notes = {}, currency = "INR", transfers } = opts;

  if (amountINR <= 0) {
    throw new Error(`[payment] createOrder: amountINR must be positive, got ${amountINR}`);
  }

  const orderPayload: Record<string, unknown> = {
    amount: inrToPaise(amountINR),
    currency,
    receipt,
    notes,
  };

  // If transfers are specified (Razorpay Route), attach them.
  // This routes the payment directly from lender → borrower's linked bank account.
  if (transfers && transfers.length > 0) {
    orderPayload["transfers"] = transfers;
  }

  const order = await razorpay.orders.create(orderPayload as any);

  return order as unknown as RazorpayOrder;
}

/**
 * Fetch an existing Razorpay order by its ID.
 */
export async function fetchOrder(orderId: string): Promise<RazorpayOrder> {
  if (!orderId) throw new Error("[payment] fetchOrder: orderId is required");
  const order = await razorpay.orders.fetch(orderId);
  return order as unknown as RazorpayOrder;
}

/**
 * Fetch all payments for a given order.
 * Useful to verify payment status server-side after checkout redirect.
 */
export async function fetchOrderPayments(orderId: string) {
  if (!orderId) throw new Error("[payment] fetchOrderPayments: orderId is required");
  return razorpay.orders.fetchPayments(orderId);
}
