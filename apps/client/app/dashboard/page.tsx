"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  Plus,
  ArrowRight,
  Coins,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type LoanStatus = "REQUESTED" | "ACTIVE" | "REPAID" | "DEFAULTED" | "CANCELLED";

interface Loan {
  id: string;
  amountINR: number;
  status: LoanStatus;
  createdAt: string;
  txHash?: string;
  borrower: { id: string; name: string; email: string; walletAddress?: string };
  lender: { id: string; name: string; email: string; walletAddress?: string };
  collateralToken: { tokenName: string; symbol: string };
}

interface Stats {
  totalBorrowed: number;
  totalLent: number;
  activeLoans: number;
  repaidLoans: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function truncateAddr(addr?: string) {
  if (!addr) return "No wallet";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const statusConfig: Record<LoanStatus, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED: { label: "Pending", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock className="h-3 w-3" /> },
  ACTIVE: { label: "Active", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: <TrendingUp className="h-3 w-3" /> },
  REPAID: { label: "Repaid", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: <CheckCircle className="h-3 w-3" /> },
  DEFAULTED: { label: "Defaulted", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: <AlertTriangle className="h-3 w-3" /> },
  CANCELLED: { label: "Cancelled", color: "bg-muted text-muted-foreground border-border", icon: null },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [airdropping, setAirdropping] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = session?.user ? await getJwt() : null;
        if (!token) { setLoading(false); return; }

        const [loansRes, profileRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (loansRes.ok) {
          const data = await loansRes.json();
          setLoans(data.loans?.slice(0, 5) || []);
          setStats(data.stats || null);
        }

        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data.user || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [session]);

  const user = session?.user;
  const walletAddress = profile?.walletAddress || (user as any)?.walletAddress;

  function copyWallet() {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success("Wallet address copied!");
    }
  }

  async function requestAirdrop() {
    setAirdropping(true);
    try {
      const token = await getJwt();
      if (!token) {
        toast.error("Authentication token not found.");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/airdrop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Airdrop completed successfully!");
      } else {
        toast.error(data.message || "Airdrop failed.");
      }
    } catch (e) {
      toast.error("Failed to request airdrop. Please ensure the local blockchain node is running.");
    } finally {
      setAirdropping(false);
    }
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Good morning, {user?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's an overview of your lending activity.
          </p>
        </div>
        <Link href="/dashboard/loans/new">
          <Button className="rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 gap-2">
            <Plus className="h-4 w-4" />
            New Loan IOU
          </Button>
        </Link>
      </div>

      {/* ── Wallet card ── */}
      <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card">
        <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Your Wallet Address
            </p>
            <div className="font-mono text-sm font-semibold text-emerald-400 min-h-[20px] flex items-center">
              {status === "loading" || loading ? (
                <Skeleton className="h-4 w-32 bg-emerald-500/20" />
              ) : walletAddress ? (
                truncateAddr(walletAddress)
              ) : (
                "Wallet not initialized"
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={copyWallet}
              disabled={loading || !walletAddress}
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
            {walletAddress && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={requestAirdrop}
                  disabled={airdropping}
                >
                  {airdropping ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Coins className="h-3.5 w-3.5" />
                  )}
                  {airdropping ? "Airdropping..." : "Request Airdrop"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl border-border"
                  asChild
                >
                  <a
                    href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Etherscan
                  </a>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Stats grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Borrowed",
            value: loading ? null : formatINR(stats?.totalBorrowed || 0),
            icon: <ArrowDownLeft className="h-4 w-4 text-red-400" />,
            bg: "bg-red-500/10",
            color: "text-red-400",
          },
          {
            label: "Total Lent",
            value: loading ? null : formatINR(stats?.totalLent || 0),
            icon: <ArrowUpRight className="h-4 w-4 text-emerald-400" />,
            bg: "bg-emerald-500/10",
            color: "text-emerald-400",
          },
          {
            label: "Active Loans",
            value: loading ? null : String(stats?.activeLoans || 0),
            icon: <TrendingUp className="h-4 w-4 text-blue-400" />,
            bg: "bg-blue-500/10",
            color: "text-blue-400",
          },
          {
            label: "Settled Loans",
            value: loading ? null : String(stats?.repaidLoans || 0),
            icon: <CheckCircle className="h-4 w-4 text-purple-400" />,
            bg: "bg-purple-500/10",
            color: "text-purple-400",
          },
        ].map(({ label, value, icon, bg, color }) => (
          <Card key={label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
              <div className={`rounded-lg p-2 ${bg}`}>{icon}</div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Recent activity ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <Link href="/dashboard/loans">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : loans.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ArrowLeftRight className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No loans yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
                Create your first IOU to get started
              </p>
              <Link href="/dashboard/loans/new">
                <Button size="sm" className="rounded-xl bg-emerald-500 text-black hover:bg-emerald-400">
                  <Plus className="h-3.5 w-3.5 mr-1" /> New Loan
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {loans.map((loan) => {
              const isLender = loan.lender.id === user?.id;
              const cfg = statusConfig[loan.status];
              return (
                <Link key={loan.id} href={`/dashboard/loans/${loan.id}`}>
                  <Card className="cursor-pointer border-border/60 transition-all hover:border-emerald-500/30 hover:bg-accent/30">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className={`rounded-xl p-2.5 ${isLender ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                        {isLender
                          ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                          : <ArrowDownLeft className="h-4 w-4 text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {isLender ? `Lent to ${loan.borrower.name || loan.borrower.email}` : `Borrowed from ${loan.lender.name || loan.lender.email}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Collateral: {loan.collateralToken?.symbol} •{" "}
                          {new Date(loan.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{formatINR(loan.amountINR)}</p>
                        <span className={`inline-flex items-center gap-1 mt-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Placeholder — replace with actual JWT fetch from server
async function getJwt(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/jwt");
    if (res.ok) {
      const data = await res.json();
      return data.token;
    }
  } catch {}
  return null;
}