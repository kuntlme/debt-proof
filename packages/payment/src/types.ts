// ── Razorpay Entity Types ─────────────────────────────────────────────────────

export interface RazorpayOrder {
  id: string;
  entity: "order";
  amount: number;          // in paise
  amount_paid: number;
  amount_due: number;
  currency: string;        // "INR"
  receipt: string;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: "payment";
  amount: number;          // in paise
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string;
  invoice_id: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: "null" | "partial" | "full" | null;
  captured: boolean;
  description: string;
  email: string;
  contact: string;
  fee: number | null;
  tax: number | null;
  created_at: number;
}

export interface RazorpayRefund {
  id: string;
  entity: "refund";
  amount: number;          // in paise
  currency: string;
  payment_id: string;
  notes: Record<string, string>;
  receipt: string | null;
  acquirer_data: Record<string, string>;
  created_at: number;
  batch_id: string | null;
  status: "pending" | "processed" | "failed";
  speed_processed: string;
  speed_requested: string;
}

// ── Input Option Types ────────────────────────────────────────────────────────

// ── Razorpay Route (Transfer) Types ──────────────────────────────────────────

/**
 * A single transfer entry for Razorpay Route.
 * Specifies a linked account that will receive a portion of the payment.
 */
export interface RazorpayTransfer {
  /** Razorpay Linked Account ID (e.g. "acc_xxxxxxxxxx") */
  account: string;
  /** Amount to transfer in paise (100 paise = 1 INR) */
  amount: number;
  /** Currency code, usually "INR" */
  currency: string;
  /** Optional notes for the transfer */
  notes?: Record<string, string>;
  /** Whether to put funds on hold before settling to linked account */
  on_hold?: 0 | 1;
}

export interface CreateOrderOptions {
  /** Loan repayment amount in Indian Rupees (INR) */
  amountINR: number;
  /** Unique receipt identifier — use the loan ID */
  receipt: string;
  /** Optional key-value notes attached to the Razorpay order */
  notes?: Record<string, string>;
  /** ISO 4217 currency code. Defaults to "INR" */
  currency?: string;
  /**
   * Razorpay Route transfers — routes payment directly to borrower's
   * linked account (sub-merchant) after the order is paid.
   * Each entry specifies an account and the amount to transfer (in paise).
   */
  transfers?: RazorpayTransfer[];
}

export interface VerifyPaymentOptions {
  /** Razorpay order ID (returned by createOrder) */
  orderId: string;
  /** Razorpay payment ID (returned by checkout) */
  paymentId: string;
  /** HMAC signature returned by Razorpay checkout */
  signature: string;
}

export interface CapturePaymentOptions {
  paymentId: string;
  /** Amount to capture in INR */
  amountINR: number;
  currency?: string;
}

export interface CreateRefundOptions {
  paymentId: string;
  /** Partial refund amount in INR. Omit for full refund. */
  amountINR?: number;
  notes?: Record<string, string>;
  /** "normal" | "optimum". Defaults to "optimum" */
  speed?: "normal" | "optimum";
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export interface WebhookPaymentEntity {
  entity: RazorpayPayment;
}

export interface WebhookEvent {
  entity: "event";
  account_id: string;
  event: string;           // e.g. "payment.captured", "refund.processed"
  contains: string[];
  payload: {
    payment?: WebhookPaymentEntity;
    refund?: { entity: RazorpayRefund };
    order?: { entity: RazorpayOrder };
  };
  created_at: number;
}
