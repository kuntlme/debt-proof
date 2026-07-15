"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Coins, Plus, Copy, ExternalLink, Loader2, AlertCircle,
  ShieldCheck, Wallet, TrendingUp, ChevronRight, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Holding {
  id: string;
  balance: number;
  holder: { id: string; name?: string; email: string; walletAddress?: string };
}

interface Token {
  id: string;
  tokenName: string;
  symbol: string;
  contractAddress: string;
  totalSupply: number;
  tokenHoldings: Holding[];
}

// ── helpers ────────────────────────────────────────────────────────────────────

async function getJwt(): Promise<string> {
  try {
    const res = await fetch("/api/auth/jwt");
    if (res.ok) { const d = await res.json(); return d.token || ""; }
  } catch {}
  return "";
}

function shortAddr(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatBalance(n: number) {
  return n.toLocaleString("en-IN");
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function TokenPage() {
  const router = useRouter();

  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const jwt = await getJwt();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/me`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (res.ok) {
          const data = await res.json();
          setToken(data.token ?? null);
        }
        // any non-ok (404, 500, etc.) → show create form
      } catch {
        toast.error("Could not reach server — check your connection");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleCreate() {
    if (!tokenName || !symbol) { toast.error("Fill all fields"); return; }
    if (symbol.length < 2 || symbol.length > 10) { toast.error("Symbol must be 2–10 characters"); return; }

    setCreating(true);
    try {
      const jwt = await getJwt();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ tokenName, symbol: symbol.toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Token deployed to blockchain!", {
          description: data.txHash ? `Tx: ${data.txHash.slice(0, 18)}...` : undefined,
        });
        setToken(data.token);
        setShowCreate(false);
      } else {
        toast.error(data.message || "Failed to create token");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  function copyId() {
    if (!token) return;
    navigator.clipboard.writeText(token.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  function copyAddr() {
    if (!token) return;
    navigator.clipboard.writeText(token.contractAddress);
    setCopiedAddr(true);
    toast.success("Contract address copied!");
    setTimeout(() => setCopiedAddr(false), 2000);
  }

  // ── loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 p-6 lg:p-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  // ── create form — show whenever there's no token ─────────────────────────────
  if (!token) {
    return (
      <div className="max-w-2xl mx-auto p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Token</h1>
          <p className="text-sm text-muted-foreground mt-1">Your personal ERC-20 trust token used as collateral in loans.</p>
        </div>

        {/* No-token banner */}
        <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/5 px-5 py-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-300">Token required to request loans</p>
            <p className="text-xs text-yellow-400/70 mt-0.5">
              You need a personal token before you can create a loan request — it acts as on-chain collateral.
            </p>
          </div>
        </div>

        {/* Deploy card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <Coins className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-white">Deploy Your Personal Token</p>
              <p className="text-xs text-muted-foreground">One ERC-20 per account • 10,000 tokens minted to you</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Token Name</Label>
              <Input
                id="token-name"
                placeholder="e.g. Kuntal Token"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 focus:border-emerald-500/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Symbol (Ticker)</Label>
              <Input
                id="token-symbol"
                placeholder="e.g. KT"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                maxLength={10}
                className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 focus:border-emerald-500/50 uppercase"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-white/70 mb-1">What happens when you deploy?</p>
            <p>• A new ERC-20 smart contract is deployed to the blockchain</p>
            <p>• <span className="text-emerald-400 font-medium">10,000 tokens</span> are minted and credited to your account</p>
            <p>• These tokens act as collateral when you borrow</p>
          </div>

          <Button
            id="deploy-token-btn"
            className="w-full rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 h-11 gap-2 disabled:opacity-60"
            onClick={handleCreate}
            disabled={creating || !tokenName || !symbol}
          >
            {creating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Deploying to blockchain…</>
            ) : (
              <><Plus className="h-4 w-4" /> Deploy Token</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ── token exists — main view ────────────────────────────────────────────────
  if (!token) return null;

  const ownBalance = token.tokenHoldings.find((h) => true)?.balance ?? token.totalSupply;
  const otherHolders = token.tokenHoldings.filter((h, i) => i > 0); // non-owner holders

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Token</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal ERC-20 trust token used as collateral in loans.</p>
      </div>

      {/* ── CARD ── inspired by your wireframe ── */}
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden border border-emerald-500/20",
          "bg-gradient-to-br from-[#0d1a14] via-[#0a120e] to-[#070d0a]",
          "shadow-[0_0_60px_-15px_rgba(52,211,153,0.15)]",
          "p-6"
        )}
      >
        {/* Decorative glow circle */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-emerald-400/5 blur-2xl" />

        {/* Top row — token identity */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-medium text-emerald-400/60 uppercase tracking-widest mb-1">Personal Token</p>
            <p className="text-xl font-bold text-white">{token.tokenName}</p>
            <p className="text-sm text-emerald-400/80">{token.symbol} · ERC-20</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30 text-lg font-black text-emerald-400 shrink-0">
            {token.symbol.slice(0, 2)}
          </div>
        </div>

        {/* Balance — big number */}
        <div className="mb-5">
          <p className="text-xs text-emerald-400/50 uppercase tracking-widest mb-1">Your Balance</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-white tabular-nums">
              {formatBalance(Number(ownBalance))}
            </span>
            <span className="text-lg font-semibold text-emerald-400 mb-1">{token.symbol}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total supply: {formatBalance(Number(token.totalSupply))} · On-chain
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.07] my-4" />

        {/* Token ID + Contract Address row */}
        <div className="space-y-3">
          {/* Token ID */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Token ID</p>
              <p className="text-xs font-mono text-white/70 truncate">{token.id}</p>
            </div>
            <button
              id="copy-token-id"
              onClick={copyId}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all shrink-0",
                copiedId
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-white hover:border-white/20"
              )}
            >
              {copiedId ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedId ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Contract Address */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Contract Address</p>
              <p className="text-xs font-mono text-white/70 truncate">{token.contractAddress}</p>
            </div>
            <button
              id="copy-contract-addr"
              onClick={copyAddr}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all shrink-0",
                copiedAddr
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : "border-white/10 bg-white/[0.04] text-muted-foreground hover:text-white hover:border-white/20"
              )}
            >
              {copiedAddr ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedAddr ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 mt-4">
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
            <ShieldCheck className="h-3 w-3" /> On-chain
          </span>
          <a
            href={`https://sepolia.etherscan.io/token/${token.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground border border-white/10 rounded-full px-2.5 py-1 hover:text-white hover:border-white/20 transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> Etherscan
          </a>
        </div>
      </div>

      {/* ── Holders list ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-white">Token Holders</p>
            <span className="text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
              {token.tokenHoldings.length}
            </span>
          </div>
          <TrendingUp className="h-4 w-4 text-emerald-400/50" />
        </div>

        {/* Rows */}
        {!token.tokenHoldings.length ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">No holders yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {token.tokenHoldings.map((h, idx) => {
              const displayName = h.holder.name || h.holder.email;
              const pct = ((Number(h.balance) / Number(token.totalSupply)) * 100).toFixed(1);
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Rank */}
                  <span className="text-xs font-bold text-muted-foreground/40 w-4 shrink-0">{idx + 1}</span>

                  {/* Avatar */}
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + address */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{displayName}</p>
                    <p className="text-xs font-mono text-muted-foreground/60 truncate">
                      {shortAddr(h.holder.walletAddress)}
                    </p>
                  </div>

                  {/* Balance */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-emerald-400 tabular-nums">
                      {formatBalance(Number(h.balance))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{pct}% · {token.symbol}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick-action CTA */}
      <button
        onClick={() => router.push("/dashboard/loans/new")}
        className="w-full flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4 hover:bg-white/[0.04] hover:border-emerald-500/20 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/15 transition-colors">
            <Coins className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Request a Loan</p>
            <p className="text-xs text-muted-foreground">Use your token as collateral</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
      </button>
    </div>
  );
}
