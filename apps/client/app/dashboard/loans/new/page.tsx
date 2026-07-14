"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Info, Coins, IndianRupee, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface UserResult {
  id: string;
  name?: string;
  email: string;
  image?: string;
  walletAddress?: string;
  token?: { tokenName: string; symbol: string; contractAddress: string };
}

export default function NewLoanPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLender, setSelectedLender] = useState<UserResult | null>(null);
  const [amount, setAmount] = useState("");
  const [collateralAmount, setCollateralAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSearch() {
    if (searchQuery.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/search?q=${encodeURIComponent(searchQuery)}`,
        { headers: { Authorization: `Bearer ${await getJwt()}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit() {
    if (!selectedLender || !amount || !collateralAmount) {
      toast.error("Please fill all fields");
      return;
    }

    setSubmitting(true);
    try {
      // First get user's token
      const tokenRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/me`, {
        headers: { Authorization: `Bearer ${await getJwt()}` },
      });
      if (!tokenRes.ok) {
        toast.error("You need a personal token to create a loan. Create one first.");
        router.push("/dashboard/token");
        return;
      }
      const { token } = await tokenRes.json();

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getJwt()}`,
        },
        body: JSON.stringify({
          lenderId: selectedLender.id,
          amountINR: parseFloat(amount),
          collateralTokenId: token.id,
          collateralAmount: parseFloat(collateralAmount),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("IOU created successfully!", {
          description: data.txHash ? `Tx: ${data.txHash.slice(0, 18)}...` : "Recorded off-chain",
        });
        router.push(`/dashboard/loans/${data.loan.id}`);
      } else {
        toast.error(data.message || "Failed to create loan");
      }
    } catch (e) {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create a Loan IOU</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Borrow money from another user and record it immutably on the blockchain.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3">
        {[
          { n: 1, label: "Select Lender" },
          { n: 2, label: "Loan Details" },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                step >= n
                  ? "bg-emerald-500 text-black"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {n}
            </div>
            <span className={`text-sm ${step >= n ? "font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i === 0 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Lender */}
      {step === 1 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Who are you borrowing from?</CardTitle>
            <CardDescription>Search by name or email address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9 rounded-xl bg-card border-border/60"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={searching || searchQuery.length < 2}
                className="rounded-xl bg-emerald-500 text-black hover:bg-emerald-400"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => { setSelectedLender(u); setStep(2); }}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5 ${
                      selectedLender?.id === u.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/60"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.image} />
                      <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                        {(u.name || u.email).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{u.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      {u.token && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-400">
                          <Coins className="h-3 w-3" /> {u.token.tokenName} ({u.token.symbol})
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {u.walletAddress ? `${u.walletAddress.slice(0, 6)}...${u.walletAddress.slice(-4)}` : "No wallet"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Loan Details */}
      {step === 2 && selectedLender && (
        <div className="space-y-4">
          {/* Selected lender recap */}
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedLender.image} />
                <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                  {(selectedLender.name || selectedLender.email).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-semibold">Lender: {selectedLender.name || selectedLender.email}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {selectedLender.walletAddress?.slice(0, 18)}...
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedLender(null); setStep(1); }}
                className="text-xs text-muted-foreground"
              >
                Change
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Loan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Loan Amount (₹ INR)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-9 rounded-xl bg-card border-border/60"
                    min="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Collateral Amount (your tokens)</Label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="e.g. 10"
                    value={collateralAmount}
                    onChange={(e) => setCollateralAmount(e.target.value)}
                    className="pl-9 rounded-xl bg-card border-border/60"
                    min="0.01"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Your tokens will be locked as collateral on the blockchain until repayment.
                </p>
              </div>

              {/* IOU Preview */}
              {amount && collateralAmount && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">IOU Preview</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{(session?.user as any)?.name || "You"}</span> will borrow{" "}
                    <span className="font-bold text-emerald-400">
                      ₹{parseFloat(amount).toLocaleString("en-IN")}
                    </span>{" "}
                    from{" "}
                    <span className="font-semibold text-foreground">{selectedLender.name || selectedLender.email}</span>,
                    locking{" "}
                    <span className="font-bold text-emerald-400">{collateralAmount} tokens</span> as collateral on the blockchain.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400"
                  onClick={handleSubmit}
                  disabled={submitting || !amount || !collateralAmount}
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting...</>
                  ) : (
                    "Create IOU on Blockchain"
                  )}
                </Button>
              </div>
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
