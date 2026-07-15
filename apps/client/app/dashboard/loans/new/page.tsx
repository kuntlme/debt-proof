"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, Globe, Users, ChevronRight,
  Loader2, X, ArrowRight, IndianRupee, Clock, Coins, AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SearchUser {
  id: string;
  name?: string;
  email?: string;
  username?: string;
  image?: string;
  creditScore: number;
  walletAddress?: string;
  token?: { tokenName: string; symbol: string };
}

type Step = 1 | 2;

function creditRisk(score: number) {
  if (score >= 700) return { label: "Low Risk", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
  if (score >= 500) return { label: "Medium Risk", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" };
  return { label: "High Risk", color: "bg-red-500/15 text-red-400 border-red-500/20" };
}

function toDays(n: number, unit: "days" | "weeks" | "months") {
  if (unit === "weeks") return n * 7;
  if (unit === "months") return n * 30;
  return n;
}

async function getJwt(): Promise<string> {
  try {
    const res = await fetch("/api/auth/jwt");
    if (res.ok) { const d = await res.json(); return d.token || ""; }
  } catch { }
  return "";
}

export default function NewLoanRequestPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [isPublic, setIsPublic] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("");
  const [durationUnit, setDurationUnit] = useState<"days" | "weeks" | "months">("days");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── token gate ──────────────────────────────────────────────────────────────
  const [tokenStatus, setTokenStatus] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    async function checkToken() {
      try {
        const jwt = await getJwt();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/me`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        setTokenStatus(res.ok ? "ok" : "missing");
      } catch {
        setTokenStatus("missing");
      }
    }
    checkToken();
  }, []);
  // ───────────────────────────────────────────────────────────────────────────



  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const jwt = await getJwt();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) { const data = await res.json(); setResults(data.users || []); }
    } catch { } finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(query), 400);
  }, [query, doSearch]);

  function toggleSelect(user: SearchUser) {
    setSelected((prev) =>
      prev.find((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user]
    );
  }

  async function handleSubmit() {
    const amountNum = parseFloat(amount);
    const durationNum = parseInt(duration);
    if (!amount || isNaN(amountNum) || amountNum <= 0) { toast.error("Enter a valid loan amount"); return; }
    if (!duration || isNaN(durationNum) || durationNum <= 0) { toast.error("Enter a valid loan duration"); return; }
    if (!isPublic && selected.length === 0) { toast.error("Select at least one lender or enable Public Post"); return; }

    setSubmitting(true);
    try {
      const jwt = await getJwt();
      const body = {
        type: isPublic ? "PUBLIC" : "TARGETED",
        amountINR: amountNum,
        durationDays: toDays(durationNum, durationUnit),
        lenderIds: isPublic ? [] : selected.map((u) => u.id),
        note: note || undefined,
      };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loan-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(isPublic ? "Loan request posted publicly!" : `Request sent to ${selected.length} lender(s)!`);
        router.push("/dashboard/notifications");
      } else {
        toast.error(data.message || "Failed to send request");
      }
    } catch { toast.error("Something went wrong"); } finally { setSubmitting(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Loan Request</h1>
        <div className="flex items-center gap-2 mt-3">
          {[{ n: 1, label: "Select Lenders" }, { n: 2, label: "Loan Details" }].map(({ n, label }, i) => (
            <div key={n} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              <div className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all",
                step === n ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20" : "bg-white/5 text-muted-foreground"
              )}>
                <span>{n}</span> {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Token gate banner ── */}
      {tokenStatus === "loading" && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Checking token status…</p>
        </div>
      )}

      {tokenStatus === "missing" && (
        <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/5 p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500/10 shrink-0">
              <AlertCircle className="h-4.5 w-4.5 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-yellow-300">Token required to request a loan</p>
              <p className="text-xs text-yellow-400/70 mt-0.5 max-w-sm">
                You need a personal token in your account before you can request a loan — it's used as on-chain collateral.
              </p>
            </div>
          </div>
          <Button
            id="go-create-token"
            size="sm"
            onClick={() => router.push("/dashboard/token")}
            className="rounded-xl bg-yellow-400 text-black font-semibold hover:bg-yellow-300 shrink-0 h-9 gap-1.5"
          >
            <Coins className="h-3.5 w-3.5" />
            Create Token
          </Button>
        </div>
      )}

      {/* ── Form (dimmed when token missing) ── */}
      <div className={cn(tokenStatus === "missing" ? "opacity-40 pointer-events-none select-none" : "")}>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="space-y-5 animate-in fade-in duration-400">

          {/* Public toggle */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", isPublic ? "bg-emerald-500/15" : "bg-white/5")}>
                <Globe className={cn("h-4 w-4", isPublic ? "text-emerald-400" : "text-muted-foreground")} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Public Post</p>
                <p className="text-xs text-muted-foreground">Visible to all users on the platform</p>
              </div>
            </div>
            <button
              id="toggle-public"
              onClick={() => { setIsPublic(!isPublic); if (!isPublic) setSelected([]); }}
              className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", isPublic ? "bg-emerald-500" : "bg-white/10")}
            >
              <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", isPublic ? "translate-x-6" : "translate-x-1")} />
            </button>
          </div>

          {/* Search */}
          {!isPublic && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                <Input
                  id="lender-search"
                  placeholder="Search by name, @username or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl focus:border-emerald-500/50"
                />
              </div>

              {results.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 border-b border-white/5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span>User</span><span>@Username</span><span>Credit Score</span><span>Select</span>
                  </div>
                  {results.map((user) => {
                    const isSelected = !!selected.find((u) => u.id === user.id);
                    const risk = creditRisk(user.creditScore);
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleSelect(user)}
                        className={cn("grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3 cursor-pointer transition-colors border-b border-white/5 last:border-0 hover:bg-white/5", isSelected && "bg-emerald-500/5")}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={user.image ?? ""} />
                            <AvatarFallback className="text-[10px] bg-emerald-500/20 text-emerald-400">
                              {user.name?.[0] || user.email?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate text-white">{user.name || user.email}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">@{user.username || "—"}</span>
                        <span className={cn("text-[10px] font-medium border px-2 py-0.5 rounded-full", risk.color)}>{user.creditScore}</span>
                        <Checkbox
                          checked={isSelected}
                          className="border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          onCheckedChange={() => toggleSelect(user)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {query.length >= 2 && !searching && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No users found for "{query}"</p>
              )}

              {selected.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Selected ({selected.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.map((u) => (
                      <div key={u.id} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
                        <span className="text-xs text-emerald-400">{u.name || u.email}</span>
                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(u); }} className="text-emerald-400/60 hover:text-emerald-400">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isPublic && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
              <Users className="h-4 w-4 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-300">Your request will be visible to all registered lenders on the platform.</p>
            </div>
          )}

          <Button
            id="step1-next"
            onClick={() => setStep(2)}
            disabled={!isPublic && selected.length === 0}
            className="w-full rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 h-11 gap-2 disabled:opacity-50"
          >
            Next: Loan Details <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-5 animate-in fade-in duration-400">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2" onClick={() => setStep(1)}>
            ← Back to Lenders
          </Button>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Loan Amount (INR)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="loan-amount"
                  type="number"
                  placeholder="5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Loan Period</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="loan-duration"
                    type="number"
                    placeholder="30"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl focus:border-emerald-500/50"
                  />
                </div>
                <select
                  id="duration-unit"
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as "days" | "weeks" | "months")}
                  className="rounded-xl border border-white/10 bg-[#0a0a0a] text-white text-sm px-3 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Note (optional)</Label>
            <textarea
              id="loan-note"
              placeholder="Add a short message to the lender…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-muted-foreground/50 text-sm px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Summary</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline" className={cn("text-xs", isPublic ? "bg-blue-500/15 text-blue-400 border-blue-500/20" : "bg-purple-500/15 text-purple-400 border-purple-500/20")}>
                {isPublic ? "Public" : `Targeted — ${selected.length} lender(s)`}
              </Badge>
            </div>
            {amount && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-semibold">₹{parseFloat(amount).toLocaleString("en-IN")}</span></div>}
            {duration && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Duration</span><span className="font-semibold">{toDays(parseInt(duration), durationUnit)} days</span></div>}
          </div>

          <Button
            id="submit-loan-request"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 h-11 gap-2 disabled:opacity-60"
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : isPublic ? "Post Public Request" : `Send to ${selected.length} Lender(s)`}
          </Button>
        </div>
      )}
      </div>{/* end token-gate wrapper */}
    </div>
  );
}
