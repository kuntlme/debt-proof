import crypto from "crypto";
import { razorpay } from "./client.js";
import type {
  CapturePaymentOptions,
  RazorpayPayment,
  VerifyPaymentOptions,
} from "./types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function inrToPaise(inr: number): number {
  return Math.round(inr * 100);
}

// ── Payment API ───────────────────────────────────────────────────────────────

/**
 * Fetch a payment's details by its Razorpay payment ID.
 * Use this for server-side status checks.
 */
export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!paymentId) throw new Error("[payment] fetchPayment: paymentId is required");
  const payment = await razorpay.payments.fetch(paymentId);
  return payment as unknown as RazorpayPayment;
}

/**
 * Capture an authorized payment.
 *
 * Razorpay payments must be captured within 5 days of authorization
 * (unless auto-capture is enabled in the dashboard).
 *
 * @example
 * await capturePayment({ paymentId: "pay_xxx", amountINR: 5000 });
 */
export async function capturePayment(opts: CapturePaymentOptions): Promise<RazorpayPayment> {
  const { paymentId, amountINR, currency = "INR" } = opts;
  if (!paymentId) throw new Error("[payment] capturePayment: paymentId is required");
  if (amountINR <= 0) throw new Error(`[payment] capturePayment: amountINR must be positive, got ${amountINR}`);

  const payment = await razorpay.payments.capture(
    paymentId,
    inrToPaise(amountINR),
    currency
  );
  return payment as unknown as RazorpayPayment;
}

/**
 * Verify the HMAC-SHA256 signature that Razorpay sends to the client
 * after a successful checkout.
 *
 * Must be called **server-side** before marking a loan as REPAID.
 *
 * Returns `true` if the signature is valid, `false` otherwise.
 *
 * @example
 * const valid = verifyPaymentSignature({ orderId, paymentId, signature });
 * if (!valid) return res.status(400).json({ error: "Invalid payment signature" });
 */
export function verifyPaymentSignature(opts: VerifyPaymentOptions): boolean {
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keySecret) {
    throw new Error("[payment] verifyPaymentSignature: RAZORPAY_KEY_SECRET is not set");
  }

  const { orderId, paymentId, signature } = opts;

  // Razorpay signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(signature, "hex");

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}
