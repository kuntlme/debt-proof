"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Copy, ExternalLink, User, Mail, Calendar, ShieldCheck, Loader2,
  ArrowDownLeft, ArrowUpRight, Clock, AlertTriangle, Building2,
  CheckCircle2, PlusCircle, Banknote, TrendingUp, TrendingDown, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Bank Account Types ────────────────────────────────────────────────────────
interface BankAccount {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId?: string;
  isVerified: boolean;
}

// ── Bank Account Form Component ───────────────────────────────────────────────
function BankAccountSection() {
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [hasLinkedAccount, setHasLinkedAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    upiId: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const jwt = await getJwt();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bank-accounts/me`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setBankAccount(data.bankAccount);
          setHasLinkedAccount(data.hasLinkedAccount);
          if (data.bankAccount) {
            setForm({
              accountHolderName: data.bankAccount.accountHolderName,
              accountNumber: data.bankAccount.accountNumber,
              ifscCode: data.bankAccount.ifscCode,
              bankName: data.bankAccount.bankName,
              upiId: data.bankAccount.upiId || "",
            });
          }
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleSave() {
    if (!form.accountHolderName || !form.accountNumber || !form.ifscCode || !form.bankName) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const jwt = await getJwt();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bank-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Bank account saved!");
        setBankAccount(data.bankAccount);
        setHasLinkedAccount(!!data.razorpayAccountId);
        setShowForm(false);
      } else {
        toast.error(data.message || "Failed to save bank account");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-32 w-full rounded-xl" />;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="h-4 w-4 text-blue-400" />
          Bank Account (For Loan Disbursement)
          {hasLinkedAccount && (
            <Badge className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />Linked
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info banner */}
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3 text-xs text-blue-300">
          <strong>Why is this needed?</strong> When a lender pays you via Razorpay, the money is
          automatically routed to this bank account using <strong>Razorpay Route</strong> — so you
          receive the loan amount directly in your bank/UPI.
        </div>

        {bankAccount && !showForm ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-accent/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Holder</span>
                <span className="font-semibold">{bankAccount.accountHolderName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-semibold">{bankAccount.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account No.</span>
                <span className="font-mono font-semibold">
                  {"•".repeat(bankAccount.accountNumber.length - 4) + bankAccount.accountNumber.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IFSC</span>
                <span className="font-mono font-semibold">{bankAccount.ifscCode}</span>
              </div>
              {bankAccount.upiId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UPI ID</span>
                  <span className="font-semibold">{bankAccount.upiId}</span>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl"
              onClick={() => setShowForm(true)}
            >
              Update Bank Details
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {!bankAccount && !showForm && (
              <div className="text-center py-4">
                <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No bank account added yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add your bank details so lenders can pay you directly.
                </p>
                <Button
                  className="mt-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white gap-2"
                  onClick={() => setShowForm(true)}
                >
                  <PlusCircle className="h-4 w-4" /> Add Bank Account
                </Button>
              </div>
            )}

            {showForm && (
              <div className="space-y-3">
                {[
                  { key: "accountHolderName", label: "Account Holder Name *", placeholder: "As per bank records" },
                  { key: "accountNumber", label: "Account Number *", placeholder: "Enter account number" },
                  { key: "ifscCode", label: "IFSC Code *", placeholder: "e.g. SBIN0001234" },
                  { key: "bankName", label: "Bank Name *", placeholder: "e.g. State Bank of India" },
                  { key: "upiId", label: "UPI ID (optional)", placeholder: "e.g. name@upi" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
                    <Input
                      value={(form as any)[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="rounded-xl bg-accent/30 border-border/60"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : "Save Account"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  const [creditData, setCreditData] = useState<{
    creditScore: number;
    tier: { label: string; color: string; canBorrow: boolean };
    breakdown: { repaid: number; defaulted: number; active: number; cancelled: number };
    limits: { minRequired: number; min: number; max: number; canBorrow: boolean };
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const jwt = await getJwt();
        const [profileRes, loansRes, creditRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, { headers: { Authorization: `Bearer ${jwt}` } }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/loans`, { headers: { Authorization: `Bearer ${jwt}` } }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/credit-score`, { headers: { Authorization: `Bearer ${jwt}` } }),
        ]);
        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data.user);
        }
        if (loansRes.ok) {
          const data = await loansRes.json();
          setLoans(data.loans || []);
        }
        if (creditRes.ok) {
          const data = await creditRes.json();
          setCreditData(data);
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
          {/* Credit score — use live recalculated data */}
          {creditData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-accent/50 px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Credit Score</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    creditData.creditScore >= 700 ? "text-emerald-400" :
                    creditData.creditScore >= 550 ? "text-yellow-400" :
                    creditData.creditScore >= 400 ? "text-orange-400" : "text-red-400"
                  )}>
                    {creditData.creditScore}
                    <span className="text-sm text-muted-foreground font-normal ml-1">/ 850</span>
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={cn(
                    "text-xs mb-1",
                    creditData.creditScore >= 750 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                    creditData.creditScore >= 650 ? "bg-green-500/15 text-green-400 border-green-500/20" :
                    creditData.creditScore >= 550 ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" :
                    creditData.creditScore >= 400 ? "bg-orange-500/15 text-orange-400 border-orange-500/20" :
                    "bg-red-500/15 text-red-400 border-red-500/20"
                  )}>
                    {creditData.tier.label}
                  </Badge>
                  {!creditData.limits.canBorrow && (
                    <p className="text-[10px] text-red-400 mt-0.5">Cannot Borrow</p>
                  )}
                </div>
              </div>

              {/* Score progress bar */}
              <div className="px-1">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>300</span><span>Minimum: {creditData.limits.minRequired}</span><span>850</span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-accent overflow-hidden">
                  {/* Minimum borrow threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-orange-400/60 z-10"
                    style={{ left: `${((creditData.limits.minRequired - 300) / 550) * 100}%` }}
                  />
                  {/* Score fill */}
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      creditData.creditScore >= 700 ? "bg-emerald-400" :
                      creditData.creditScore >= 550 ? "bg-yellow-400" :
                      creditData.creditScore >= 400 ? "bg-orange-400" : "bg-red-400"
                    )}
                    style={{ width: `${Math.max(2, ((creditData.creditScore - 300) / 550) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <p className="text-sm font-bold text-emerald-400">{creditData.breakdown.repaid}</p>
                  <p className="text-[10px] text-muted-foreground">Repaid</p>
                </div>
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <p className="text-sm font-bold text-blue-400">{creditData.breakdown.active}</p>
                  <p className="text-[10px] text-muted-foreground">Active</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-2">
                  <p className="text-sm font-bold text-red-400">{creditData.breakdown.defaulted}</p>
                  <p className="text-[10px] text-muted-foreground">Defaulted</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-sm font-bold text-muted-foreground">{creditData.breakdown.cancelled}</p>
                  <p className="text-[10px] text-muted-foreground">Cancelled</p>
                </div>
              </div>

              {/* Cannot-borrow warning */}
              {!creditData.limits.canBorrow && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <span>
                    Your credit score is <strong>below {creditData.limits.minRequired}</strong>. You cannot borrow money
                    and lenders cannot accept your loan requests until your score improves.
                    Repay existing loans on time to recover your score.
                  </span>
                </div>
              )}
            </div>
          ) : user?.creditScore !== undefined ? (
            <div className="flex items-center justify-between rounded-xl bg-accent/50 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Credit Score</p>
                <p className={cn("text-xl font-bold", user.creditScore >= 700 ? "text-emerald-400" : user.creditScore >= 500 ? "text-yellow-400" : "text-red-400")}>
                  {user.creditScore}
                </p>
              </div>
            </div>
          ) : null}
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

      {/* Bank Account for Razorpay Route payouts */}
      <BankAccountSection />

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
