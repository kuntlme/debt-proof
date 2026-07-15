"use client";

import { useEffect, useState } from "react";
import {
  Globe, Users, Clock, IndianRupee, ChevronRight,
  Bell, Loader2, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    <Card className="border-border/60 hover:border-emerald-500/20 transition-all hover:bg-accent/20 group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-white/10">
            <AvatarImage src={b.image ?? ""} />
            <AvatarFallback className="text-xs bg-emerald-500/20 text-emerald-400">
              {b.name?.[0] || b.email?.[0] || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">{b.name || b.email || "Unknown"}</p>
              {b.username && <span className="text-xs text-muted-foreground">@{b.username}</span>}
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 ml-auto shrink-0", creditColor(b.creditScore))}>
                Score: {b.creditScore}
              </Badge>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />
                <strong className="text-foreground text-sm">₹{Number(req.amountINR).toLocaleString("en-IN")}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {req.durationDays} days
              </span>
              <span>{new Date(req.createdAt).toLocaleDateString("en-IN")}</span>
            </div>

            {req.note && (
              <p className="text-xs text-muted-foreground mt-1.5 italic truncate">"{req.note}"</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Link href={`/dashboard/notifications/${req.id}`}>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-lg gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              id={`check-details-${req.id}`}
            >
              Check Details <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      <Bell className="h-10 w-10 mb-3 opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
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
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-emerald-400" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Loan requests awaiting your response</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 self-start sm:self-auto"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Split panel */}
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        {/* Left — Public Requests */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-foreground">Public Requests</h2>
            {!loading && publicRequests.length > 0 && (
              <Badge className="h-5 rounded-full px-1.5 text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/20 ml-auto">
                {publicRequests.length}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : publicRequests.length === 0 ? (
            <EmptyPanel message="No public requests at the moment" />
          ) : (
            <div className="space-y-3">
              {publicRequests.map((req) => (
                <RequestCard key={req.id} req={req} isPublic />
              ))}
            </div>
          )}
        </div>

        {/* Right — In-Person (Targeted) Requests */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-foreground">Requests Sent to You</h2>
            {!loading && inPersonRequests.length > 0 && (
              <Badge className="h-5 rounded-full px-1.5 text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/20 ml-auto">
                {inPersonRequests.length}
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : inPersonRequests.length === 0 ? (
            <EmptyPanel message="No personal requests for you yet" />
          ) : (
            <div className="space-y-3">
              {inPersonRequests.map((req) => (
                <RequestCard key={req.id} req={req} isPublic={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
