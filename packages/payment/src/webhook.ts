import crypto from "crypto";
import type { WebhookEvent } from "./types.js";

// ── Webhook Signature Verification ───────────────────────────────────────────

/**
 * Verify that an incoming Razorpay webhook request is genuine.
 *
 * Razorpay signs the raw request body with HMAC-SHA256 using your
 * webhook secret and sends it in the `X-Razorpay-Signature` header.
 *
 * **Important**: parse the body as raw `Buffer` / `string` — do NOT
 * parse it as JSON before verifying, as JSON serialization may change
 * key order and break the signature.
 *
 * @param rawBody   The raw request body string (before JSON.parse)
 * @param signature The value of `X-Razorpay-Signature` header
 * @param webhookSecret  Your Razorpay webhook secret (from dashboard)
 * @returns `true` if valid, `false` otherwise. Never throws.
 *
 * @example
 * app.post("/webhooks/razorpay", express.raw({ type: "*\/*" }), (req, res) => {
 *   const valid = verifyWebhookSignature(
 *     req.body.toString(),
 *     req.headers["x-razorpay-signature"] as string,
 *     process.env.RAZORPAY_WEBHOOK_SECRET!
 *   );
 *   if (!valid) return res.status(400).send("Invalid signature");
 *   const event = JSON.parse(req.body.toString()) as WebhookEvent;
 *   // handle event...
 * });
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): boolean {
  try {
    if (!rawBody || !signature || !webhookSecret) return false;

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const expected = Buffer.from(expectedSignature, "hex");
    const received = Buffer.from(signature, "hex");

    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

/**
 * Parse a verified webhook body into a typed WebhookEvent.
 * Always call `verifyWebhookSignature` first before parsing.
 */
export function parseWebhookEvent(rawBody: string): WebhookEvent {
  return JSON.parse(rawBody) as WebhookEvent;
}
