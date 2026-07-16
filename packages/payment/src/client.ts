import Razorpay from "razorpay";

// ── Singleton Razorpay client ─────────────────────────────────────────────────
// Fails fast at module load time if credentials are missing.

const keyId = process.env["RAZORPAY_KEY_ID"];
const keySecret = process.env["RAZORPAY_KEY_SECRET"];

if (!keyId || !keySecret) {
  throw new Error(
    "[payment] RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables."
  );
}

export const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});
