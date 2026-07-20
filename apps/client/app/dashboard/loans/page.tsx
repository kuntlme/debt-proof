"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, TrendingUp, Clock,
  CheckCircle, AlertTriangle, Filter, Plus, Search, Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { toast } from "sonner";

type LoanStatus = "REQUESTED" | "ACTIVE" | "REPAID" | "DEFAULTED" | "CANCELLED";

interface Loan {
  id: string;
  amountINR: number;
  status: LoanStatus;
  createdAt: string;
  repaidAt?: string;
  txHash?: string;
  borrower: { id: string; name: string; email: string; image?: string; walletAddress?: string };
  lender: { id: string; name: string; email: string; image?: string; walletAddress?: string };
  collateralToken: { tokenName: string; symbol: string };
  collateralAmount: number;
}

const statusConfig: Record<LoanStatus, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED: { label: "Pending", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock className="h-3 w-3" /> },
  ACTIVE: { label: "Active", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: <TrendingUp className="h-3 w-3" /> },
  REPAID: { label: "Repaid", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: <CheckCircle className="h-3 w-3" /> },
  DEFAULTED: { label: "Defaulted", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: <AlertTriangle className="h-3 w-3" /> },
  CANCELLED: { label: "Cancelled", color: "bg-muted text-muted-foreground border-border", icon: null },
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function LoansPage() {
  const { data: session } = useSession();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (role !== "all") params.set("role", role);
        if (status !== "all") params.set("status", status);

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans?${params}`, {
          headers: { Authorization: `Bearer ${await getJwt()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setLoans(data.loans || []);
        }
      } catch (e) {
        toast.error("Failed to load loans");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [role, status]);

  const userId = (session?.user as any)?.id;

  const filtered = loans.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.borrower.name?.toLowerCase().includes(q) ||
      l.borrower.email?.toLowerCase().includes(q) ||
      l.lender.name?.toLowerCase().includes(q) ||
      l.lender.email?.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all your borrowing and lending IOUs
          </p>
        </div>
        <Link href="/dashboard/loans/new">
          <Button className="rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 gap-2">
            <Plus className="h-4 w-4" /> New Loan
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or loan ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl bg-card border-border/60"
          />
        </div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-full sm:w-40 rounded-xl bg-card border-border/60">
            <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="borrower">Borrowing</SelectItem>
            <SelectItem value="lender">Lending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40 rounded-xl bg-card border-border/60">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="REQUESTED">Pending</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="REPAID">Repaid</SelectItem>
            <SelectItem value="DEFAULTED">Defaulted</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loans table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowUpRight className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-medium text-muted-foreground">No loans found</p>
            <p className="text-sm text-muted-foreground/60 mt-1 mb-5">
              {search ? "Try a different search term" : "Create your first IOU to get started"}
            </p>
            {!search && (
              <Link href="/dashboard/loans/new">
                <Button size="sm" className="rounded-xl bg-emerald-500 text-black hover:bg-emerald-400">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create Loan
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((loan) => {
            const isLender = loan.lender.id === userId;
            const cfg = statusConfig[loan.status];
            const counterparty = isLender ? loan.borrower : loan.lender;
            return (
              <Card key={loan.id} className="border-border/60 transition-all hover:border-emerald-500/20 hover:bg-accent/20">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`rounded-xl p-2.5 shrink-0 ${isLender ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                    {isLender
                      ? <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                      : <ArrowDownLeft className="h-5 w-5 text-red-400" />}
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{isLender ? "Borrower" : "Lender"}</p>
                      <p className="text-sm font-semibold truncate">{counterparty.name || counterparty.email}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Collateral</p>
                      <p className="text-sm font-medium">{loan.collateralAmount} {loan.collateralToken?.symbol}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm">{new Date(loan.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                    <p className="text-base font-bold">{formatINR(loan.amountINR)}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  <Link href={`/dashboard/loans/${loan.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 ml-1">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

async function getJwt(): Promise<string> {
  try {
    const res = await fetch("/api/auth/jwt");
    if (res.ok) { const d = await res.json(); return d.token || ""; }
  } catch { }
  return "";
}
