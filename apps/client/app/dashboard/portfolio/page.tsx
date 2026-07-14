"use client";

import { useEffect, useState } from "react";
import { BarChart3, Coins, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";

interface Holding {
  id: string;
  balance: number;
  token: {
    id: string;
    tokenName: string;
    symbol: string;
    contractAddress: string;
    owner: { name?: string; email: string };
  };
}

const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899",
  "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4",
];

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/portfolio`, {
          headers: { Authorization: `Bearer ${await getJwt()}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHoldings(data.holdings || []);
          setTotalBalance(data.totalBalance || 0);
        }
      } catch {
        toast.error("Failed to load portfolio");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chartData = holdings.map((h, i) => ({
    name: h.token.symbol,
    value: Number(h.balance),
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All trust tokens you hold across the platform
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : holdings.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-medium text-muted-foreground">No token holdings yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Receive tokens from others as part of lending agreements.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chart */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" /> Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [`${v} tokens`, ""]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center mt-2">
                <p className="text-2xl font-bold text-emerald-400">{totalBalance.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total tokens held</p>
              </div>
            </CardContent>
          </Card>

          {/* Holdings list */}
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" /> Holdings ({holdings.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {holdings.map((h, i) => {
                const pct = totalBalance > 0 ? ((Number(h.balance) / totalBalance) * 100).toFixed(1) : "0";
                return (
                  <div key={h.id} className="flex items-center gap-3">
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: `${COLORS[i % COLORS.length]}22`, color: COLORS[i % COLORS.length] }}
                    >
                      {h.token.symbol.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{h.token.tokenName}</p>
                        <p className="text-sm font-bold" style={{ color: COLORS[i % COLORS.length] }}>
                          {Number(h.balance).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">by {h.token.owner.name || h.token.owner.email}</p>
                        <p className="text-xs text-muted-foreground">{pct}%</p>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
                        <div
                          className="h-1 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
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
