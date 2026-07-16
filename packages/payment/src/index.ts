// ── @repo/payment ─────────────────────────────────────────────────────────────
// Public API for the Razorpay payment integration package.
// Import from "@repo/payment" in any app or package within this monorepo.

// Razorpay client instance (advanced usage / direct SDK access)
export { razorpay as client } from "./client.js";

// Types
export type {
  RazorpayOrder,
  RazorpayPayment,
  RazorpayRefund,
  WebhookEvent,
  CreateOrderOptions,
  VerifyPaymentOptions,
  CapturePaymentOptions,
  CreateRefundOptions,
} from "./types.js";

// Orders
export { createOrder, fetchOrder, fetchOrderPayments } from "./order.js";

// Payments
export { fetchPayment, capturePayment, verifyPaymentSignature } from "./payment.js";

// Refunds
export { createRefund, fetchRefund } from "./refund.js";

// Webhooks
export { verifyWebhookSignature, parseWebhookEvent } from "./webhook.js";
