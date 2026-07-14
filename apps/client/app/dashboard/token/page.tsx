"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Coins, Plus, Copy, ExternalLink, Users, Loader2, ShieldCheck, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Token {
  id: string;
  tokenName: string;
  symbol: string;
  contractAddress: string;
  totalSupply: number;
  tokenHoldings: Array<{
    id: string;
    balance: number;
    holder: { id: string; name?: string; email: string; walletAddress?: string };
  }>;
}

export default function TokenPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/me`, {
          headers: { Authorization: `Bearer ${await getJwt()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
        } else if (res.status === 404) {
          setShowCreate(true);
        }
      } catch {
        toast.error("Failed to load token");
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getJwt()}`,
        },
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Token</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal ERC-20 trust token used as collateral in loans.
        </p>
      </div>

      {/* No token — Create form */}
      {!token && showCreate && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4 text-emerald-400" /> Deploy Your Personal Token
            </CardTitle>
            <CardDescription>
              Each user gets one ERC-20 token. It is deployed to the blockchain and used as
              collateral when you borrow money.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 flex items-start gap-2 text-xs text-yellow-400">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Make sure you have initialized your wallet before creating a token.
            </div>

            <div className="space-y-2">
              <Label>Token Name</Label>
              <Input
                placeholder="e.g. Kuntal Token"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                className="rounded-xl bg-card border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol (Ticker)</Label>
              <Input
                placeholder="e.g. KT"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                maxLength={10}
                className="rounded-xl bg-card border-border/60 uppercase"
              />
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">What happens when you create a token?</p>
              <p>• A new ERC-20 smart contract is deployed to the blockchain</p>
              <p>• 100 tokens are minted and sent to your wallet</p>
              <p>• You can use these tokens as collateral when borrowing</p>
            </div>

            <Button
              className="w-full rounded-xl bg-emerald-500 text-black hover:bg-emerald-400"
              onClick={handleCreate}
              disabled={creating || !tokenName || !symbol}
            >
              {creating ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deploying to blockchain...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" /> Deploy Token</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Token exists */}
      {token && (
        <div className="space-y-4">
          {/* Token card */}
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-500/30 text-xl font-bold text-emerald-400">
                  {token.symbol.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-bold">{token.tokenName}</p>
                  <p className="text-sm text-muted-foreground">{token.symbol} • ERC-20</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      On-chain
                    </div>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">Supply: {Number(token.totalSupply).toLocaleString()} tokens</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="flex-1 rounded-xl bg-background/50 border border-border/50 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Contract Address</p>
                  <p className="text-xs font-mono truncate">{token.contractAddress}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-emerald-500/30 text-emerald-400"
                    onClick={() => { navigator.clipboard.writeText(token.contractAddress); toast.success("Contract address copied!"); }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl" asChild>
                    <a href={`https://sepolia.etherscan.io/token/${token.contractAddress}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Holders */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Token Holders ({token.tokenHoldings?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!token.tokenHoldings?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">No holders yet</p>
              ) : (
                <div className="space-y-3">
                  {token.tokenHoldings.map((h) => (
                    <div key={h.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                          {(h.holder.name || h.holder.email).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{h.holder.name || h.holder.email}</p>
                        <p className="text-xs font-mono text-muted-foreground truncate">
                          {h.holder.walletAddress?.slice(0, 20)}...
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-400">{Number(h.balance).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{token.symbol}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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
