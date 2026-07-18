"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Coins,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Loan {
  id: string;
  amountINR: number;
  collateralAmount: number;
  status: string;
  borrower: { id: string; name: string; email: string };
  lender: { id: string; name: string; email: string };
  collateralToken: { tokenName: string; symbol: string; contractAddress: string };
}

interface BorrowerBankInfo {
  bankName: string;
  accountHolderName: string;
  isVerified: boolean;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    animation?: boolean;
  };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-sdk")) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Status states ─────────────────────────────────────────────────────────────

type CheckoutState = "idle" | "loading" | "processing" | "success" | "failed";

// ── Component ─────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const loanId = params.loanId as string;

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loanLoading, setLoanLoading] = useState(true);
  const [state, setState] = useState<CheckoutState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasBankAccount, setHasBankAccount] = useState<boolean | null>(null);
  const [borrowerBankInfo, setBorrowerBankInfo] = useState<BorrowerBankInfo | null>(null);

  const userId = (session?.user as any)?.id;

  // Load Razorpay script on mount
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  // Fetch loan details
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/auth/jwt`);
        if (!res.ok) return;
        const { token } = await res.json();

        const loanRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/loans/${loanId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (loanRes.ok) {
          const data = await loanRes.json();
          setLoan(data.loan);
        } else {
          toast.error("Loan not found");
          router.push("/dashboard/loans");
        }
      } catch {
        toast.error("Failed to load loan details");
      } finally {
        setLoanLoading(false);
      }
    }
    load();
  }, [loanId]);

  // Redirect if not the lender
  useEffect(() => {
    if (loan && userId && loan.lender.id !== userId) {
      toast.error("Only the lender can complete this payment");
      router.push(`/dashboard/loans/${loanId}`);
    }
    if (loan && loan.status !== "REQUESTED") {
      toast.error("This loan is no longer pending activation");
      router.push(`/dashboard/loans/${loanId}`);
    }
  }, [loan, userId]);

  const handleProceedToPay = useCallback(async () => {
    if (!loan) return;
    setState("loading");
    setErrorMsg(null);

    // Step 1: Ensure SDK is loaded
    const sdkLoaded = await loadRazorpayScript();
    if (!sdkLoaded || !window.Razorpay) {
      setState("failed");
      setErrorMsg("Failed to load Razorpay SDK. Please check your internet connection.");
      return;
    }

    // Step 2: Create Razorpay order via our proxy API
    let orderData: { order: { id: string; amount: number; currency: string }; keyId: string } | null = null;
    try {
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create payment order");
      }
      orderData = data;
      // Capture bank routing info for UI feedback
      setHasBankAccount(data.hasBankAccount ?? null);
      setBorrowerBankInfo(data.borrowerBankInfo ?? null);
    } catch (err: any) {
      setState("failed");
      setErrorMsg(err.message || "Could not initiate payment. Please try again.");
      return;
    }

    // Step 3: Open Razorpay checkout
    setState("idle"); // reset — Razorpay modal takes over
    const rzpOptions: RazorpayOptions = {
      key: orderData!.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
      amount: orderData!.order.amount,
      currency: orderData!.order.currency,
      name: "DebtProof",
      description: `Loan activation — ${loan.collateralToken.symbol} collateral`,
      order_id: orderData!.order.id,
      prefill: {
        name: session?.user?.name || "",
        email: session?.user?.email || "",
      },
      notes: {
        loanId,
        lenderId: loan.lender.id,
        borrowerId: loan.borrower.id,
      },
      theme: { color: "#10b981" }, // emerald-500
      handler: async (response) => {
        // Step 4: Verify signature + activate loan
        setState("processing");
        try {
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              loanId,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            throw new Error(verifyData.message || "Payment verification failed");
          }
          setState("success");
          toast.success("🎉 Payment successful! Loan is now active.");
          // Redirect to loan detail after a short delay
          setTimeout(() => {
            router.push(`/dashboard/loans/${loanId}`);
          }, 2500);
        } catch (err: any) {
          setState("failed");
          setErrorMsg(err.message || "Payment verification failed. Contact support.");
        }
      },
      modal: {
        ondismiss: () => {
          setState("idle");
          toast.info("Payment cancelled");
        },
        escape: false,
        animation: true,
      },
    };

    const rzp = new window.Razorpay(rzpOptions);
    rzp.open();
  }, [loan, loanId, session]);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loanLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!loan) return null;

  // ── Success State ─────────────────────────────────────────────────────────

  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/15 ring-4 ring-emerald-500/30">
            <CheckCircle className="h-12 w-12 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment Successful!</h1>
            <p className="text-sm text-muted-foreground mt-2">
              The loan is now <span className="text-emerald-400 font-semibold">ACTIVE</span>.
              Token transfer from borrower to lender is complete.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
              <span className="font-bold text-emerald-400">{formatINR(loan.amountINR)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tokens Transferred</span>
              <span className="font-semibold">{loan.amountINR} {loan.collateralToken.symbol}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Redirecting to loan details…</p>
        </div>
      </div>
    );
  }

  // ── Main Checkout UI ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-background to-background" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">

          {/* Back nav */}
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/loans/${loanId}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-sm font-bold">DebtProof</span>
            </div>
          </div>

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Loan Activation</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete payment to activate the loan and release funds to the borrower
            </p>
          </div>

          {/* Loan summary card */}
          <Card className="border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
            {/* Gradient accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Loan Amount</p>
                  <p className="text-3xl font-bold mt-1">{formatINR(loan.amountINR)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Borrower</p>
                  <p className="font-semibold truncate">{loan.borrower.name || loan.borrower.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Lender (you)</p>
                  <p className="font-semibold truncate text-emerald-400">{loan.lender.name || loan.lender.email}</p>
                </div>
              </div>

              <Separator />

              {/* What happens on payment */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  On Payment Success
                </p>
                {[
                  { icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />, text: "Payment verified via Razorpay HMAC signature" },
                  { icon: <Zap className="h-3.5 w-3.5 text-amber-400" />, text: `Loan status → ACTIVE instantly` },
                  { icon: <Coins className="h-3.5 w-3.5 text-blue-400" />, text: `${loan.amountINR} ${loan.collateralToken.symbol} tokens recorded on blockchain` },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">{icon}</div>
                    <p className="text-xs text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Bank routing status — shown after order created */}
              {hasBankAccount === false && (
                <div className="flex items-start gap-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-400">Borrower has no bank account linked</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Payment will go to the platform account. Ask the borrower to add their bank
                      details in their profile for direct P2P routing.
                    </p>
                  </div>
                </div>
              )}
              {hasBankAccount === true && borrowerBankInfo && (
                <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Direct bank transfer enabled</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Money goes directly to <strong>{borrowerBankInfo.accountHolderName}</strong>'s{" "}
                      {borrowerBankInfo.bankName} account via Razorpay Route.
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Collateral info */}
              <div className="flex items-center justify-between rounded-lg bg-accent/50 p-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Collateral Locked</span>
                </div>
                <span className="text-xs font-semibold">
                  {loan.collateralAmount} {loan.collateralToken.symbol}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Error state */}
          {state === "failed" && errorMsg && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">Payment Failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* CTA Button */}
          <Button
            id="proceed-to-pay-btn"
            className="w-full h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-bold text-base hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            onClick={handleProceedToPay}
            disabled={state === "loading" || state === "processing"}
          >
            {state === "loading" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Creating Payment Order…
              </>
            ) : state === "processing" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Verifying & Activating Loan…
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 mr-2" />
                Proceed to Pay {formatINR(loan.amountINR)}
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/60">
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              <span>256-bit SSL</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Razorpay secured</span>
            </div>
            <div className="h-3 w-px bg-border" />
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              <span>PCI DSS compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
