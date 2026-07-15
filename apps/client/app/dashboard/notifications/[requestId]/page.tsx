"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, IndianRupee, Clock, User, ExternalLink,
  AlertTriangle, CheckCircle2, Loader2, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Borrower {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  image?: string;
  creditScore: number;
  walletAddress?: string;
  createdAt: string;
  _count: { borrowedLoans: number; lentLoans: number };
}

interface LoanRequestDetail {
  id: string;
  type: "PUBLIC" | "TARGETED";
  amountINR: number;
  durationDays: number;
  status: string;
  note?: string;
  createdAt: string;
  borrower: Borrower;
}

// ── Credit score gauge ────────────────────────────────────────────────────────

function CreditGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, ((score - 300) / 550) * 100));
  const risk = score >= 700 ? { label: "Low Risk", color: "text-emerald-400", ring: "ring-emerald-500/40", bg: "bg-emerald-500" }
    : score >= 500 ? { label: "Medium Risk", color: "text-yellow-400", ring: "ring-yellow-500/40", bg: "bg-yellow-500" }
    : { label: "High Risk", color: "text-red-400", ring: "ring-red-500/40", bg: "bg-red-500" };

  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-5 ring-1", risk.ring)}>
      <div className={cn("flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/10 mb-3 relative")}>
        <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="14" fill="none"
            stroke={score >= 700 ? "#10b981" : score >= 500 ? "#eab308" : "#ef4444"}
            strokeWidth="3"
            strokeDasharray={`${pct * 0.879} 100`}
            strokeLinecap="round"
          />
        </svg>
        <p className={cn("text-2xl font-bold relative z-10", risk.color)}>{score}</p>
      </div>
      <p className="text-xs font-medium text-white">Credit Score</p>
      <p className={cn("text-[10px] mt-0.5", risk.color)}>{risk.label}</p>
    </div>
  );
}

// ── Terms text ────────────────────────────────────────────────────────────────

const TERMS = `By accepting this loan request, you ("Lender") agree to lend the specified amount to the Borrower under the following conditions:

1. The Lender agrees to disburse the agreed amount in INR equivalent.
2. The Borrower's personal token held as collateral may be liquidated upon default.
3. The loan period begins from the date of acceptance and expires after the agreed duration.
4. All transactions are recorded on the Ethereum Sepolia testnet and are immutable.
5. DebtProof acts only as a platform facilitator and bears no liability for defaults.
6. Both parties agree to resolve disputes amicably before escalating.`;

async function getJwt(): Promise<string> {
  try {
    const res = await fetch("/api/auth/jwt");
    if (res.ok) { const d = await res.json(); return d.token || ""; }
  } catch { }
  return "";
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LoanRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();

  const [request, setRequest] = useState<LoanRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [processing, setProcessing] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const jwt = await getJwt();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loan-requests/${requestId}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRequest(data.request);
        } else {
          toast.error("Loan request not found");
          router.back();
        }
      } catch {
        toast.error("Failed to load request");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [requestId, router]);

  async function handleAccept() {
    if (!termsAccepted) { toast.error("Please accept the terms and conditions first"); return; }
    setProcessing("accept");
    try {
      const jwt = await getJwt();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loan-requests/${requestId}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Loan accepted! The borrower has been notified.");
        router.push(data.loan?.id ? `/dashboard/loans/${data.loan.id}` : "/dashboard/loans");
      } else {
        toast.error(data.message || "Failed to accept loan");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  }

  async function handleDecline() {
    setProcessing("decline");
    try {
      const jwt = await getJwt();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loan-requests/${requestId}/decline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Request declined.");
        router.push("/dashboard/notifications");
      } else {
        toast.error(data.message || "Failed to decline");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-6 lg:p-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!request) return null;

  const b = request.borrower;

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 lg:p-8">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back to Notifications
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loan Request Details</h1>
        <p className="text-sm text-muted-foreground mt-1">Review before deciding</p>
      </div>

      {/* Borrower + Credit Score */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        {/* Borrower card */}
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-14 w-14 ring-2 ring-white/10">
                <AvatarImage src={b.image ?? ""} />
                <AvatarFallback className="text-lg bg-emerald-500/20 text-emerald-400">
                  {b.name?.[0] || b.email?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-bold">{b.name || "Anonymous"}</p>
                {b.username && <p className="text-sm text-muted-foreground">@{b.username}</p>}
                <p className="text-xs text-muted-foreground">{b.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-accent/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Borrowed</p>
                <p className="text-base font-bold text-red-400">{b._count.borrowedLoans}</p>
                <p className="text-[10px] text-muted-foreground">loans taken</p>
              </div>
              <div className="rounded-lg bg-accent/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Lent</p>
                <p className="text-base font-bold text-emerald-400">{b._count.lentLoans}</p>
                <p className="text-[10px] text-muted-foreground">loans given</p>
              </div>
            </div>

            <div className="mt-3">
              <Link href={`/dashboard/profile/${b.id}`}>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground w-full">
                  <ExternalLink className="h-3 w-3" /> View Full Borrower Profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Credit score gauge */}
        <CreditGauge score={b.creditScore} />
      </div>

      {/* Loan details */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Loan Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Borrower Name", value: b.name || b.email || "—", icon: <User className="h-3.5 w-3.5" /> },
            { label: "Amount Requested", value: `₹${Number(request.amountINR).toLocaleString("en-IN")}`, icon: <IndianRupee className="h-3.5 w-3.5" /> },
            { label: "Loan Duration", value: `${request.durationDays} days`, icon: <Clock className="h-3.5 w-3.5" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-xs">{label}</span>
              </div>
              <span className="text-sm font-semibold">{value}</span>
            </div>
          ))}

          {request.type === "PUBLIC" && (
            <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-xs">
              Public Request
            </Badge>
          )}

          {request.note && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Note from borrower</p>
              <p className="text-sm italic text-muted-foreground">"{request.note}"</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Terms & Conditions
          </p>

          <div className={cn("text-xs text-muted-foreground leading-relaxed overflow-hidden transition-all duration-300", termsExpanded ? "max-h-none" : "max-h-20")}>
            <pre className="whitespace-pre-wrap font-sans">{TERMS}</pre>
          </div>

          <button
            className="text-xs text-emerald-400 hover:underline"
            onClick={() => setTermsExpanded(!termsExpanded)}
          >
            {termsExpanded ? "Show less ▲" : "Read full terms ▼"}
          </button>

          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <Checkbox
              id="terms-check"
              checked={termsAccepted}
              onCheckedChange={(v) => setTermsAccepted(v === true)}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
            <label htmlFor="terms-check" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
              I hereby accept the terms and conditions of this loan agreement and understand the risks involved.
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          id="proceed-to-pay"
          onClick={handleAccept}
          disabled={!termsAccepted || !!processing}
          className="flex-1 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 h-11 gap-2 disabled:opacity-50"
        >
          {processing === "accept" ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : <><CheckCircle2 className="h-4 w-4" /> Proceed to Pay</>}
        </Button>
        <Button
          id="decline-request"
          onClick={handleDecline}
          disabled={!!processing}
          variant="outline"
          className="flex-1 rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 h-11"
        >
          {processing === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
        </Button>
      </div>
    </div>
  );
}
