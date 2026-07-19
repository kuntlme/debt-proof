"use client";

import { useEffect, useState } from "react";
import {
  Globe, Users, Clock, IndianRupee, ChevronRight,
  Bell, Loader2, RefreshCw, Shield, Sparkles, AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
}

interface LoanRequest {
  id: string;
  lenderRowId?: string; // only for targeted
  amountINR: number;
  durationDays: number;
  status: string;
  note?: string;
  createdAt: string;
  borrower: Borrower;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function creditColor(score: number) {
  if (score >= 700) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (score >= 500) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
  return "bg-red-500/15 text-red-400 border-red-500/20";
}

async function getJwt(): Promise<string> {
  try {
    const res = await fetch("/api/auth/jwt");
    if (res.ok) { const d = await res.json(); return d.token || ""; }
  } catch { }
  return "";
}

// ── Request Card ──────────────────────────────────────────────────────────────

function RequestCard({ req, isPublic }: { req: LoanRequest; isPublic: boolean }) {
  const b = req.borrower;
  
  return (
    <Card className="relative overflow-hidden border border-border/40 bg-card/30 backdrop-blur-md hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_-10px_rgba(16,185,129,0.15)] group">
      {/* Visual Accent Glow */}
      <div className={cn(
        "absolute top-0 left-0 w-full h-[2px] opacity-70 transition-opacity group-hover:opacity-100",
        isPublic ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"
      )} />

      <CardContent className="p-5 space-y-4">
        {/* Header: Avatar, Name, Trust Score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-emerald-500/10">
              <AvatarImage src={b.image ?? ""} />
              <AvatarFallback className="text-xs font-semibold bg-emerald-500/20 text-emerald-400">
                {b.name?.[0] || b.email?.[0] || "?"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {b.name || b.email || "Unknown Borrower"}
              </p>
              {b.username ? (
                <span className="text-xs text-muted-foreground">@{b.username}</span>
              ) : (
                <span className="text-[10px] text-muted-foreground truncate block max-w-[120px]">{b.email}</span>
              )}
            </div>
          </div>

          <Badge variant="outline" className={cn("text-[10px] font-medium px-2 py-0.5 shrink-0", creditColor(b.creditScore))}>
            Score: {b.creditScore}
          </Badge>
        </div>

        {/* Borrower Trust Scale progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Reputation Score</span>
            <span className="font-semibold text-foreground">{b.creditScore}/850</span>
          </div>
          <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden relative">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                b.creditScore >= 700 ? "bg-emerald-500" : b.creditScore >= 500 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${Math.min(100, Math.max(10, (b.creditScore / 850) * 100))}%` }}
            />
          </div>
        </div>

        {/* Loan Details Box */}
        <div className="grid grid-cols-2 gap-4 bg-accent/20 border border-border/20 rounded-2xl p-4 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Amount</span>
            <span className="font-bold text-foreground text-sm flex items-center gap-0.5">
              <IndianRupee className="h-3 w-3 text-emerald-400" />
              <span className="text-base font-extrabold text-emerald-400">{Number(req.amountINR).toLocaleString("en-IN")}</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Duration</span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-sm font-bold">{req.durationDays} days</span>
            </span>
          </div>
        </div>

        {/* Note blockquote */}
        {req.note ? (
          <div className="rounded-xl bg-accent/30 border-l-2 border-emerald-500/50 p-2.5 text-xs text-muted-foreground italic leading-relaxed">
            "{req.note}"
          </div>
        ) : (
          <div className="h-2" />
        )}

        {/* Actions & Tag */}
        <div className="flex items-center justify-between pt-3 border-t border-border/35">
          <div className="text-[10px] text-muted-foreground">
            {new Date(req.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
          </div>

          <Link href={`/dashboard/notifications/${req.id}`}>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-xl gap-1.5 px-4 text-xs font-semibold border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
              id={`check-details-${req.id}`}
            >
              Verify Terms <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyPanel({ message, title, icon: Icon }: { message: string; title: string; icon: any }) {
  return (
    <Card className="relative overflow-hidden border border-border/40 bg-card/25 py-20 px-6 text-center backdrop-blur-xl rounded-2xl max-w-xl mx-auto shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
      <CardContent className="flex flex-col items-center justify-center relative z-10">
        <div className="rounded-2xl bg-emerald-500/10 p-4 mb-5 ring-1 ring-emerald-500/20 shadow-inner">
          <Icon className="h-10 w-10 text-emerald-400 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold tracking-tight text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground/80 mt-3 max-w-sm leading-relaxed">
          {message}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [publicRequests, setPublicRequests] = useState<LoanRequest[]>([]);
  const [inPersonRequests, setInPersonRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const jwt = await getJwt();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loan-requests/notifications`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPublicRequests(data.publicRequests || []);
        setInPersonRequests(data.inPersonRequests || []);
      } else {
        toast.error("Failed to load notifications");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/30 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-emerald-400" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage peer-to-peer loan requests awaiting your verify actions.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 self-start sm:self-auto border-border/80 h-9 font-medium"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Tabs Interface */}
      <Tabs defaultValue="direct" className="w-full space-y-6">
        <TabsList className="bg-muted/30 border border-border/40 rounded-xl p-1 h-12 w-full max-w-md">
          <TabsTrigger value="direct" className="rounded-lg h-10 gap-2 font-medium flex-1">
            <Users className="h-4 w-4" />
            <span>Direct Offers</span>
            {!loading && inPersonRequests.length > 0 && (
              <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[9px] bg-emerald-500 text-black border-transparent flex items-center justify-center font-bold">
                {inPersonRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="public" className="rounded-lg h-10 gap-2 font-medium flex-1">
            <Globe className="h-4 w-4" />
            <span>Marketplace Pools</span>
            {!loading && publicRequests.length > 0 && (
              <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[9px] bg-blue-500 text-white border-transparent flex items-center justify-center font-bold">
                {publicRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Direct Proposals Content */}
        <TabsContent value="direct" className="space-y-4 outline-none">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-[280px] w-full rounded-2xl" />
              ))}
            </div>
          ) : inPersonRequests.length === 0 ? (
            <EmptyPanel 
              title="No direct proposals yet" 
              message="When borrowers send peer-to-peer loan requests targeting your wallet directly, they will appear here." 
              icon={Users} 
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {inPersonRequests.map((req) => (
                <RequestCard key={req.id} req={req} isPublic={false} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Public Proposals Content */}
        <TabsContent value="public" className="space-y-4 outline-none">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-[280px] w-full rounded-2xl" />
              ))}
            </div>
          ) : publicRequests.length === 0 ? (
            <EmptyPanel 
              title="Marketplace pool is empty" 
              message="No public loan verification requests are currently active. Check back later or create a loan offer." 
              icon={Globe} 
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {publicRequests.map((req) => (
                <RequestCard key={req.id} req={req} isPublic />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
