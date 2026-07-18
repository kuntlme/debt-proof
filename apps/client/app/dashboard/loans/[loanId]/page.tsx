"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Copy, CheckCircle, AlertTriangle,
  Clock, TrendingUp, ShieldCheck, Loader2, CreditCard,
  Lock, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { toast } from "sonner";

// ── Razorpay Types ──────────────────────────────────────────────────────────
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void; escape?: boolean; animation?: boolean };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-sdk")) { resolve(true); return; }
    const script = document.createElement("script");
    script.id = "razorpay-sdk";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

type LoanStatus = "REQUESTED" | "ACTIVE" | "REPAID" | "DEFAULTED" | "CANCELLED";

interface Loan {
  id: string;
  amountINR: number;
  collateralAmount: number;
  status: LoanStatus;
  createdAt: string;
  repaidAt?: string;
  txHash?: string;
  borrower: { id: string; name: string; email: string; walletAddress?: string };
  lender: { id: string; name: string; email: string; walletAddress?: string };
  collateralToken: { tokenName: string; symbol: string; contractAddress: string };
}

const statusConfig: Record<LoanStatus, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED: { label: "Pending Confirmation", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock className="h-3.5 w-3.5" /> },
  ACTIVE: { label: "Active", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  REPAID: { label: "Repaid", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  DEFAULTED: { label: "Defaulted", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  CANCELLED: { label: "Cancelled", color: "bg-muted text-muted-foreground border-border", icon: null },
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function LoanDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const loanId = params.loanId as string;

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [repayState, setRepayState] = useState<"idle" | "creating" | "processing">("idle");
  const [repayError, setRepayError] = useState<string | null>(null);

  const userId = (session?.user as any)?.id;

  // Preload Razorpay SDK
  useEffect(() => { loadRazorpayScript(); }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans/${loanId}`, {
          headers: { Authorization: `Bearer ${await getJwt()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLoan(data.loan);
        } else {
          toast.error("Loan not found");
          router.push("/dashboard/loans");
        }
      } catch {
        toast.error("Failed to load loan");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [loanId]);

  async function handleAction(action: "default" | "cancel" | "activate") {
    setActionLoading(action);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans/${loanId}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await getJwt()}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Loan ${action}ed successfully`);
        setLoan(data.loan);
      } else {
        toast.error(data.message || "Action failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Razorpay repayment flow ─────────────────────────────────────────────
  const handleRepay = useCallback(async () => {
    if (!loan) return;
    setRepayState("creating");

    const sdkLoaded = await loadRazorpayScript();
    if (!sdkLoaded || !window.Razorpay) {
      toast.error("Failed to load Razorpay. Check your connection and try again.");
      setRepayState("idle");
      return;
    }

    // Step 1: Create repayment order
    let orderData: { order: { id: string; amount: number; currency: string }; keyId: string } | null = null;
    try {
      const res = await fetch("/api/payment/create-repay-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Special handling for lender missing bank account — show persistent in-card error
        if (data.code === "LENDER_NO_BANK_ACCOUNT") {
          setRepayError(data.message);
          setRepayState("idle");
          return;
        }
        throw new Error(data.message || "Failed to create repayment order");
      }
      setRepayError(null); // clear any previous error
      orderData = data;
    } catch (err: any) {
      toast.error(err.message || "Could not initiate repayment. Please try again.");
      setRepayState("idle");
      return;
    }

    // Step 2: Open Razorpay checkout
    setRepayState("idle"); // Razorpay modal takes over UI
    const rzpOptions: RazorpayOptions = {
      key: orderData!.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
      amount: orderData!.order.amount,
      currency: orderData!.order.currency,
      name: "DebtProof",
      description: `Loan repayment — ${loan.collateralToken.symbol}`,
      order_id: orderData!.order.id,
      prefill: {
        name: session?.user?.name || "",
        email: session?.user?.email || "",
      },
      notes: { loanId, type: "repayment" },
      theme: { color: "#10b981" },
      handler: async (response) => {
        // Step 3: Verify & finalize repayment
        setRepayState("processing");
        try {
          const verifyRes = await fetch("/api/payment/verify-repay", {
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
            throw new Error(verifyData.message || "Repayment verification failed");
          }
          toast.success("🎉 Repayment successful! Collateral released.");
          setLoan(verifyData.loan);
        } catch (err: any) {
          toast.error(err.message || "Repayment verification failed. Contact support.");
        } finally {
          setRepayState("idle");
        }
      },
      modal: {
        ondismiss: () => {
          setRepayState("idle");
          toast.info("Repayment cancelled");
        },
        escape: false,
        animation: true,
      },
    };

    const rzp = new window.Razorpay(rzpOptions);
    rzp.open();
  }, [loan, loanId, session]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!loan) return null;

  const isBorrower = loan.borrower.id === userId;
  const isLender = loan.lender.id === userId;
  const cfg = statusConfig[loan.status];

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/loans">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Loan Details</h1>
          <p className="text-xs text-muted-foreground font-mono">{loan.id}</p>
        </div>
      </div>

      {/* Status banner */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${cfg.color}`}>
        {cfg.icon}
        <div>
          <p className="text-sm font-semibold">{cfg.label}</p>
          <p className="text-xs opacity-70">
            Created {new Date(loan.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}
            {loan.repaidAt && ` • Settled ${new Date(loan.repaidAt).toLocaleDateString("en-IN", { dateStyle: "long" })}`}
          </p>
        </div>
      </div>

      {/* Main card */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">IOU Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Loan Amount</span>
            <span className="text-2xl font-bold text-emerald-400">{formatINR(loan.amountINR)}</span>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Borrower</p>
              <p className="font-semibold">{loan.borrower.name || loan.borrower.email}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {loan.borrower.walletAddress?.slice(0, 12)}...
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Lender</p>
              <p className="font-semibold">{loan.lender.name || loan.lender.email}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {loan.lender.walletAddress?.slice(0, 12)}...
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Collateral Locked</span>
            <span className="font-semibold">
              {loan.collateralAmount} {loan.collateralToken?.symbol}
              <span className="text-xs text-muted-foreground ml-1">({loan.collateralToken?.tokenName})</span>
            </span>
          </div>

          {/* Blockchain info */}
          {loan.txHash ? (
            <div className="rounded-xl border border-border/60 bg-accent/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Recorded on Blockchain
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono text-muted-foreground truncate flex-1">
                  {loan.txHash.slice(0, 30)}...
                </p>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => { navigator.clipboard.writeText(loan.txHash!); toast.success("Tx hash copied"); }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <a href={`https://sepolia.etherscan.io/tx/${loan.txHash}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground text-center">
              Not yet recorded on-chain (blockchain unavailable during creation)
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {loan.status === "REQUESTED" && isLender && (
        <Card className="border-amber-500/20 overflow-hidden">
          <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Lender Actions</p>
            <Button
              id="activate-loan-btn"
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-bold hover:from-emerald-400 hover:to-teal-400 shadow-md shadow-emerald-500/20"
              onClick={() => router.push(`/dashboard/loans/${loanId}/checkout`)}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Proceed to Pay — Activate Loan
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              You'll be redirected to a secure Razorpay checkout. On payment, the loan activates and tokens transfer automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {loan.status === "ACTIVE" && isBorrower && (
        <Card className="border-emerald-500/20 overflow-hidden">
          <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Repay Loan</p>

            {/* Lender no-bank-account blocking banner */}
            {repayError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-400">Cannot process repayment</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{repayError}</p>
                </div>
              </div>
            )}

            {!repayError && (
              <div className="rounded-lg border border-border/60 bg-accent/30 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You will pay (via Razorpay)</span>
                  <span className="font-semibold text-emerald-400">{formatINR(loan.amountINR)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collateral returned to you</span>
                  <span className="font-semibold">{loan.collateralAmount} {loan.collateralToken?.symbol}</span>
                </div>
              </div>
            )}

            <Button
              id="repay-loan-btn"
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-bold hover:from-emerald-400 hover:to-teal-400 shadow-md shadow-emerald-500/20 disabled:opacity-60"
              onClick={handleRepay}
              disabled={repayState !== "idle" || !!repayError}
            >
              {repayState === "creating" ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating Repayment Order…</>
              ) : repayState === "processing" ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying Repayment…</>
              ) : (
                <><CreditCard className="h-4 w-4 mr-2" />Repay {formatINR(loan.amountINR)} via Razorpay<ArrowRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
            {!repayError && (
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" /> Secured payment • Collateral released after verification
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {loan.status === "ACTIVE" && isLender && (
        <Card className="border-red-500/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Lender Actions</p>
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              onClick={() => handleAction("default")}
              disabled={!!actionLoading}
            >
              {actionLoading === "default" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
              Mark as Defaulted
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Marking as defaulted will transfer the borrower's collateral to your wallet.
            </p>
          </CardContent>
        </Card>
      )}

      {loan.status === "REQUESTED" && isBorrower && (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => handleAction("cancel")}
              disabled={!!actionLoading}
            >
              {actionLoading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cancel Loan Request
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function getJwt(): Promise<string> {
  try {
    const res = await fetch("/api/auth/jwt");
    if (res.ok) { const d = await res.json(); return d.token || ""; }
  } catch {}
  return "";
}
