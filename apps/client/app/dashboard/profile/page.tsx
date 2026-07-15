"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Copy, ExternalLink, User, Mail, Calendar, ShieldCheck, Loader2,
  ArrowDownLeft, ArrowUpRight, Clock, TrendingUp, CheckCircle, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  name?: string;
  email: string;
  image?: string;
  username?: string;
  phone?: string;
  creditScore?: number;
  walletAddress?: string;
  createdAt: string;
  token?: {
    tokenName: string;
    symbol: string;
    contractAddress: string;
    totalSupply: number;
  };
  _count: { borrowedLoans: number; lentLoans: number };
}

interface Loan {
  id: string;
  amountINR: number;
  status: string;
  createdAt: string;
  repaidAt?: string;
  borrower: { id: string; name?: string; email: string };
  lender: { id: string; name?: string; email: string };
  collateralToken: { symbol: string };
}

type ActivityRow = {
  id: string;
  type: "received" | "paid" | "requested" | "declined";
  counterparty: string;
  amount: number;
  date: string;
  status: string;
};

function buildActivity(loans: Loan[], userId: string): ActivityRow[] {
  return loans.map((loan) => {
    const isLender = loan.lender.id === userId;
    const counterparty = isLender
      ? loan.borrower.name || loan.borrower.email
      : loan.lender.name || loan.lender.email;

    let type: ActivityRow["type"] = "requested";
    if (loan.status === "REPAID" && isLender) type = "received";
    else if (loan.status === "REPAID" && !isLender) type = "paid";
    else if (loan.status === "CANCELLED" || loan.status === "DEFAULTED") type = "declined";
    else if (loan.status === "REQUESTED" && !isLender) type = "requested";

    return { id: loan.id, type, counterparty, amount: Number(loan.amountINR), date: loan.createdAt, status: loan.status };
  });
}

const activityConfig = {
  received:  { label: "Payment Received",  icon: <ArrowDownLeft className="h-3.5 w-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  paid:      { label: "Payment Made",      icon: <ArrowUpRight className="h-3.5 w-3.5" />,  color: "text-red-400",     bg: "bg-red-500/10" },
  requested: { label: "Request Sent",      icon: <Clock className="h-3.5 w-3.5" />,          color: "text-yellow-400",  bg: "bg-yellow-500/10" },
  declined:  { label: "Declined/Defaulted",icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-muted-foreground", bg: "bg-muted" },
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializingWallet, setInitializingWallet] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const jwt = await getJwt();
        const [profileRes, loansRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, { headers: { Authorization: `Bearer ${jwt}` } }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans`, { headers: { Authorization: `Bearer ${jwt}` } }),
        ]);
        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data.user);
        }
        if (loansRes.ok) {
          const data = await loansRes.json();
          setLoans(data.loans || []);
        }
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function initWallet() {
    setInitializingWallet(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: (session?.user as any)?.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Wallet initialized successfully!");
        setProfile((p) => p ? { ...p, walletAddress: data.user.walletAddress } : null);
      } else {
        toast.error(data.message || "Failed to initialize wallet");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setInitializingWallet(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-6 lg:p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const user = profile;
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "DP";

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your account details and blockchain identity</p>
      </div>

      {/* Avatar card */}
      <Card className="border-border/60">
        <CardContent className="flex items-center gap-4 p-5">
          <Avatar className="h-16 w-16 ring-2 ring-emerald-500/30">
            <AvatarImage src={user?.image ?? ""} />
            <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xl font-bold">{user?.name || "Anonymous"}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex gap-4 mt-2">
              <div className="text-center">
                <p className="text-base font-bold text-emerald-400">{user?._count?.borrowedLoans || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Borrowed</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-blue-400">{user?._count?.lentLoans || 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lent</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account details */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { icon: <User className="h-4 w-4" />, label: "Full Name", value: user?.name || "—" },
            { icon: <Mail className="h-4 w-4" />, label: "Email", value: user?.email || "—" },
            { icon: <Calendar className="h-4 w-4" />, label: "Joined", value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" }) : "—" },
          ].map(({ icon, label, value }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-muted-foreground">
                {icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value}</p>
              </div>
            </div>
          ))}
          {/* Credit score */}
          {user?.creditScore !== undefined && (
            <div className="flex items-center justify-between rounded-xl bg-accent/50 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Credit Score</p>
                <p className={cn("text-xl font-bold", user.creditScore >= 700 ? "text-emerald-400" : user.creditScore >= 500 ? "text-yellow-400" : "text-red-400")}>
                  {user.creditScore}
                </p>
              </div>
              <Badge variant="outline" className={cn("text-xs", user.creditScore >= 700 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : user.creditScore >= 500 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" : "bg-red-500/15 text-red-400 border-red-500/20")}>
                {user.creditScore >= 700 ? "Low Risk" : user.creditScore >= 500 ? "Medium Risk" : "High Risk"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet */}
      <Card className={`border-${user?.walletAddress ? "emerald-500/20" : "yellow-500/20"}`}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Blockchain Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.walletAddress ? (
            <>
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
                <p className="text-xs text-muted-foreground mb-1">Wallet Address (Ethereum)</p>
                <p className="font-mono text-sm font-semibold break-all text-emerald-400">
                  {user.walletAddress}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl border-emerald-500/30 text-emerald-400"
                  onClick={() => { navigator.clipboard.writeText(user.walletAddress!); toast.success("Address copied!"); }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Address
                </Button>
                <Button variant="outline" size="sm" className="flex-1 rounded-xl" asChild>
                  <a href={`https://sepolia.etherscan.io/address/${user.walletAddress}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> View on Etherscan
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You don't have a wallet yet. Initialize one to start borrowing and lending.
              </p>
              <Button
                className="w-full rounded-xl bg-emerald-500 text-black hover:bg-emerald-400"
                onClick={initWallet}
                disabled={initializingWallet}
              >
                {initializingWallet ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating wallet...</>
                ) : (
                  "Initialize Wallet"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token info */}
      {user?.token && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">My Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold">
                {user.token.symbol.slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold">{user.token.tokenName} ({user.token.symbol})</p>
                <p className="text-xs text-muted-foreground">Supply: {Number(user.token.totalSupply).toLocaleString()} tokens</p>
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">Contract</p>
            <p className="text-xs font-mono break-all text-muted-foreground">{user.token.contractAddress}</p>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Type", "Counterparty", "Amount", "Date", "Status"].map((h) => (
                      <th key={h} className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider pb-2 pr-4 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildActivity(loans, profile?.id || "").map((row) => {
                    const cfg = activityConfig[row.type];
                    return (
                      <tr key={row.id} className="border-b border-border/20 last:border-0 hover:bg-accent/30 transition-colors">
                        <td className="py-3 pr-4">
                          <div className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium", cfg.bg, cfg.color)}>
                            {cfg.icon} {cfg.label}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-sm truncate max-w-[120px]">{row.counterparty}</td>
                        <td className="py-3 pr-4 font-semibold">₹{row.amount.toLocaleString("en-IN")}</td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{new Date(row.date).toLocaleDateString("en-IN")}</td>
                        <td className="py-3">
                          <span className="text-xs text-muted-foreground">{row.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
