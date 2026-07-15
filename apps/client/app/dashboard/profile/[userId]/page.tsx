"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, User, Mail, Calendar, TrendingUp, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PublicProfile {
  id: string;
  name?: string;
  username?: string;
  image?: string;
  creditScore: number;
  walletAddress?: string;
  createdAt: string;
  token?: { tokenName: string; symbol: string; contractAddress: string; totalSupply: number };
  _count: { borrowedLoans: number; lentLoans: number };
  borrowedLoans: { id: string; amountINR: number; status: string; createdAt: string; repaidAt?: string; durationDays: number }[];
}

function creditRisk(score: number) {
  if (score >= 700) return { label: "Low Risk", color: "text-emerald-400", ring: "ring-emerald-500/30 border-emerald-500/20", bg: "bg-emerald-500/10" };
  if (score >= 500) return { label: "Medium Risk", color: "text-yellow-400", ring: "ring-yellow-500/30 border-yellow-500/20", bg: "bg-yellow-500/10" };
  return { label: "High Risk", color: "text-red-400", ring: "ring-red-500/30 border-red-500/20", bg: "bg-red-500/10" };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED: { label: "Pending", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock className="h-3 w-3" /> },
  ACTIVE: { label: "Active", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: <TrendingUp className="h-3 w-3" /> },
  REPAID: { label: "Repaid", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: <CheckCircle className="h-3 w-3" /> },
  DEFAULTED: { label: "Defaulted", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: <AlertTriangle className="h-3 w-3" /> },
  CANCELLED: { label: "Cancelled", color: "bg-muted text-muted-foreground border-border", icon: null },
};

async function getJwt(): Promise<string> {
  try {
    const res = await fetch("/api/auth/jwt");
    if (res.ok) { const d = await res.json(); return d.token || ""; }
  } catch { }
  return "";
}

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const jwt = await getJwt();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/profile`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
        } else {
          toast.error("Profile not found");
          router.back();
        }
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, router]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-6 lg:p-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) return null;

  const risk = creditRisk(profile.creditScore);
  const initials = profile.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 lg:p-8">
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Borrower Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Public information about this user</p>
      </div>

      {/* Avatar + stats */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-start gap-5 flex-wrap">
            <Avatar className="h-20 w-20 ring-2 ring-white/10 shrink-0">
              <AvatarImage src={profile.image ?? ""} />
              <AvatarFallback className="text-2xl bg-emerald-500/20 text-emerald-400 font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold">{profile.name || "Anonymous"}</p>
              {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">
                Member since {new Date(profile.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })}
              </p>
              <div className="flex gap-4 mt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-red-400">{profile._count.borrowedLoans}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Borrowed</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-400">{profile._count.lentLoans}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lent</p>
                </div>
              </div>
            </div>
            {/* Credit score */}
            <div className={cn("flex flex-col items-center rounded-xl border p-4 min-w-[96px]", risk.ring, risk.bg)}>
              <p className={cn("text-3xl font-bold", risk.color)}>{profile.creditScore}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Credit Score</p>
              <p className={cn("text-[10px] font-medium mt-0.5", risk.color)}>{risk.label}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token */}
      {profile.token && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Personal Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-sm font-bold">
                {profile.token.symbol.slice(0, 2)}
              </div>
              <div>
                <p className="font-semibold">{profile.token.tokenName} ({profile.token.symbol})</p>
                <p className="text-xs text-muted-foreground">Supply: {Number(profile.token.totalSupply).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground break-all">{profile.token.contractAddress}</p>
          </CardContent>
        </Card>
      )}

      {/* Recent loan history */}
      {profile.borrowedLoans.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Recent Loan History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profile.borrowedLoans.map((loan) => {
                const cfg = statusConfig[loan.status] || statusConfig.CANCELLED;
                return (
                  <div key={loan.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <p className="text-sm font-medium">₹{Number(loan.amountINR).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground">{loan.durationDays} days • {new Date(loan.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", cfg.color)}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
