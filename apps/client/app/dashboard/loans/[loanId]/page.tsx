"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Copy, CheckCircle, AlertTriangle,
  Clock, TrendingUp, ShieldCheck, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { toast } from "sonner";

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

  const userId = (session?.user as any)?.id;

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

  async function handleAction(action: "repay" | "default" | "cancel") {
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
      {loan.status === "ACTIVE" && isBorrower && (
        <Card className="border-emerald-500/20">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Borrower Actions</p>
            <Button
              className="w-full rounded-xl bg-emerald-500 text-black hover:bg-emerald-400"
              onClick={() => handleAction("repay")}
              disabled={!!actionLoading}
            >
              {actionLoading === "repay" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Mark as Repaid
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Confirming repayment will release your collateral tokens back to your wallet.
            </p>
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
