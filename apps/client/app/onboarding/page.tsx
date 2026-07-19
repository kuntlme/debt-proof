"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Wallet, Key, Loader2, CheckCircle2, Eye, EyeOff,
  Download, ShieldCheck, Coins, PartyPopper, ChevronRight, User, Phone, AtSign,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "profile" | "wallet-init" | "keys-reveal" | "token-init" | "done";

interface WalletData {
  address: string;
  mnemonic: string;
  privateKey: string;
}

interface TokenData {
  tokenName: string;
  symbol: string;
  contractAddress: string;
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS: { id: Step; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "wallet-init", label: "Wallet" },
  { id: "keys-reveal", label: "Backup Keys" },
  { id: "token-init", label: "Token" },
];

function StepDots({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={cn(
              "flex items-center justify-center rounded-full text-xs font-bold transition-all duration-500",
              i < idx
                ? "h-7 w-7 bg-emerald-500 text-black"
                : i === idx
                ? "h-8 w-8 bg-emerald-500/20 ring-2 ring-emerald-500 text-emerald-400"
                : "h-7 w-7 bg-white/5 text-muted-foreground"
            )}
          >
            {i < idx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-0.5 w-8 rounded-full transition-all duration-500", i < idx ? "bg-emerald-500" : "bg-white/10")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Animated init step ────────────────────────────────────────────────────────

function InitStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 text-sm transition-all duration-500", done ? "text-emerald-400" : active ? "text-white" : "text-muted-foreground/40")}>
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
      ) : active ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-400" />
      ) : (
        <div className="h-4 w-4 shrink-0 rounded-full border border-white/20" />
      )}
      {label}
    </div>
  );
}

// ── Seed phrase grid ──────────────────────────────────────────────────────────

function SeedGrid({ words, revealed }: { words: string[]; revealed: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {words.map((word, i) => (
        <div key={i} className={cn("flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2", revealed ? "" : "blur-[3px] select-none")}>
          <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
          <span className="text-sm font-mono font-medium text-white">{word}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ── Step state ──
  const [step, setStep] = useState<Step>("profile");

  // ── Profile step ──
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [profileError, setProfileError] = useState("");

  // ── Wallet step ──
  const [walletSteps, setWalletSteps] = useState([false, false, false]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [token, setToken] = useState<TokenData | null>(null);

  // ── Keys step ──
  const [showSeed, setShowSeed] = useState(false);
  const [showPrivKey, setShowPrivKey] = useState(false);
  const [savedChecked, setSavedChecked] = useState(false);

  // ── Token step ──
  const [tokenSteps, setTokenSteps] = useState([false, false, false]);

  // Redirect if already onboarded
  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user as any;
      if (user?.onboardingComplete) {
        router.replace("/dashboard");
      } else {
        // Pre-fill name from OAuth
        if (user?.name) setName(user.name);
      }
    } else if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, session, router]);

  // ── Username uniqueness check (debounced) ──
  const checkUsername = useCallback(async (val: string) => {
    if (val.length < 3) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/check-username?username=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUsernameStatus(data.available ? "available" : "taken");
        setProfileError("");
      } else {
        setUsernameStatus("idle");
        setProfileError(data.message || "Failed to check username availability");
      }
    } catch {
      setUsernameStatus("idle");
      setProfileError("Could not connect to authentication server");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => checkUsername(username), 500);
    return () => clearTimeout(t);
  }, [username, checkUsername]);

  // ── Step 1: submit profile ──
  async function handleProfileSubmit() {
    setProfileError("");
    if (!name.trim()) { setProfileError("Name is required"); return; }
    if (!username.trim() || username.length < 3) { setProfileError("Username must be at least 3 characters"); return; }
    if (usernameStatus === "taken") { setProfileError("Username is already taken"); return; }
    if (!phone.trim() || phone.length < 10) { setProfileError("Enter a valid phone number"); return; }
    setStep("wallet-init");
    await runWalletInit();
  }

  // ── Step 2: wallet initialization ──
  async function runWalletInit() {
    const userId = (session?.user as any)?.id;
    if (!userId) return;

    // Animate steps
    await delay(600); setWalletSteps([true, false, false]);
    await delay(1200); setWalletSteps([true, true, false]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name, username, phone, skipToken: true }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.message || "Onboarding failed");
        setStep("profile");
        return;
      }

      setWalletSteps([true, true, true]);
      await delay(800);
      setWallet(data.wallet);
      setStep("keys-reveal");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setStep("profile");
    }
  }

  // ── Step 3: proceed after saving keys ──
  function handleKeysProceed() {
    if (!savedChecked) { toast.error("Please confirm you've saved your recovery phrase"); return; }
    setStep("token-init");
    runTokenInit();
  }

  function handleKeysSkip() {
    if (!savedChecked) { toast.error("Please confirm you've saved your recovery phrase"); return; }
    setStep("done");
  }

  // ── Step 4: token animation ──
  async function runTokenInit() {
    try {
      // 1. Start compile animation
      setTokenSteps([true, false, false]);
      await delay(800);

      // 2. Start deploy animation and call endpoint
      setTokenSteps([true, true, false]);

      const jwtRes = await fetch("/api/auth/jwt");
      if (!jwtRes.ok) {
        throw new Error("Failed to authenticate session");
      }
      const { token: jwt } = await jwtRes.json();

      const symbol = username.slice(0, 4).toUpperCase();
      const tokenName = `${name.split(" ")[0]}'s Token`;

      const deployRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify({ tokenName, symbol }),
      });

      const deployData = await deployRes.json();
      if (!deployRes.ok || !deployData.success) {
        throw new Error(deployData.message || "Token deployment failed");
      }

      setToken({
        tokenName: deployData.token.tokenName,
        symbol: deployData.token.symbol,
        contractAddress: deployData.token.contractAddress,
      });

      // 3. Complete animation
      setTokenSteps([true, true, true]);
      await delay(800);
      setStep("done");
    } catch (err: any) {
      toast.error(err.message || "Token initialization failed. You can initialize it later from your dashboard.");
      await delay(1000);
      setStep("done");
    }
  }

  // ── Step 5: done → dashboard ──
  function handleEnterDashboard() {
    router.push("/dashboard");
  }

  // ── Download keys ──
  function downloadKeys() {
    if (!wallet) return;
    const content = [
      "DebtProof — Your Wallet Recovery Keys",
      "=".repeat(40),
      "",
      "⚠️  WARNING: Keep this file safe and OFFLINE.",
      "   Never share these keys with anyone.",
      "",
      `Recovery Phrase (BIP-39 Mnemonic):`,
      wallet.mnemonic,
      "",
      `Private Key:`,
      wallet.privateKey,
      "",
      `Wallet Address:`,
      wallet.address,
      "",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debtproof-recovery-keys.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Keys downloaded successfully!");
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-950/30 via-black to-black pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-white">DebtProof</p>
            <p className="text-[10px] text-muted-foreground">Blockchain P2P Lending</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl">
          <StepDots current={step} />

          {/* ── STEP 1: Profile ── */}
          {step === "profile" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-white">Welcome to DebtProof</h1>
                <p className="text-sm text-muted-foreground mt-2">Set up your profile to get started</p>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="onboarding-name"
                      placeholder="Rahul Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="onboarding-username"
                      placeholder="rahul123"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      className={cn(
                        "pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl focus:border-emerald-500/50",
                        usernameStatus === "available" && "border-emerald-500/50",
                        usernameStatus === "taken" && "border-red-500/50"
                      )}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium">
                      {usernameStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      {usernameStatus === "available" && <span className="text-emerald-400">✓</span>}
                      {usernameStatus === "taken" && <span className="text-red-400">✗</span>}
                    </div>
                  </div>
                  {usernameStatus === "taken" && (
                    <p className="text-xs text-red-400">This username is already taken</p>
                  )}
                  {usernameStatus === "available" && (
                    <p className="text-xs text-emerald-400">Username is available!</p>
                  )}
                </div>

                {/* Email (read-only) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                  <Input
                    id="onboarding-email"
                    value={(session?.user?.email) || ""}
                    readOnly
                    className="bg-white/5 border-white/10 text-muted-foreground rounded-xl cursor-not-allowed"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="onboarding-phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/50 rounded-xl focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              {profileError && (
                <p className="text-sm text-red-400 text-center">{profileError}</p>
              )}

              <Button
                id="onboarding-proceed"
                onClick={handleProfileSubmit}
                disabled={usernameStatus === "taken" || usernameStatus === "checking"}
                className="w-full rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 h-11 gap-2"
              >
                Proceed <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ── STEP 2: Wallet Initialization ── */}
          {step === "wallet-init" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 mx-auto mb-4">
                  <Wallet className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Initializing Your Wallet</h2>
                <p className="text-sm text-muted-foreground mt-2">Generating your secure Ethereum identity…</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <InitStep label="Generating cryptographic key pair…" done={walletSteps[0]} active={!walletSteps[0]} />
                <InitStep label="Deriving wallet address on Ethereum Sepolia…" done={walletSteps[1]} active={walletSteps[0] && !walletSteps[1]} />
                <InitStep label="Setting up your account…" done={walletSteps[2]} active={walletSteps[1] && !walletSteps[2]} />
              </div>

              <div className="flex justify-center">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-1 w-1 rounded-full bg-emerald-500/40 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Keys Reveal ── */}
          {step === "keys-reveal" && wallet && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500/10 ring-1 ring-yellow-500/20 mx-auto mb-4">
                  <Key className="h-8 w-8 text-yellow-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Save Your Recovery Keys</h2>
              </div>

              {/* Warning */}
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                <p className="text-xs text-yellow-300 font-medium">
                  ⚠️ These keys are shown <strong>only once</strong>. Store them offline in a safe place. Anyone with these keys has full access to your wallet.
                </p>
              </div>

              {/* Seed phrase */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">12-Word Recovery Phrase</p>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => setShowSeed(!showSeed)}>
                    {showSeed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showSeed ? "Hide" : "Reveal"}
                  </Button>
                </div>
                <SeedGrid words={wallet.mnemonic.split(" ")} revealed={showSeed} />
              </div>

              {/* Private key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Private Key</p>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => setShowPrivKey(!showPrivKey)}>
                    {showPrivKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {showPrivKey ? "Hide" : "Reveal"}
                  </Button>
                </div>
                <div className={cn("rounded-lg border border-white/10 bg-white/5 p-3", !showPrivKey && "blur-[3px] select-none")}>
                  <p className="text-xs font-mono break-all text-emerald-300">{wallet.privateKey}</p>
                </div>
              </div>

              {/* Download */}
              <Button
                id="download-keys"
                variant="outline"
                className="w-full rounded-xl border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-2"
                onClick={downloadKeys}
              >
                <Download className="h-4 w-4" /> Download as .txt file
              </Button>

              {/* Checkbox */}
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <Checkbox
                  id="saved-checkbox"
                  checked={savedChecked}
                  onCheckedChange={(v) => setSavedChecked(v === true)}
                  className="mt-0.5 border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <Label htmlFor="saved-checkbox" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                  I have securely saved my recovery phrase and private key in a safe, offline location.
                </Label>
              </div>

              <div className="flex gap-3">
                <Button
                  id="keys-skip"
                  variant="outline"
                  onClick={handleKeysSkip}
                  disabled={!savedChecked}
                  className="flex-1 rounded-xl border-white/10 text-white hover:bg-white/5 h-11 disabled:opacity-50"
                >
                  Skip Token
                </Button>
                <Button
                  id="keys-proceed"
                  onClick={handleKeysProceed}
                  disabled={!savedChecked}
                  className="flex-1 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 h-11 gap-2 disabled:opacity-50"
                >
                  Create Token <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Token Initialization ── */}
          {step === "token-init" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 ring-1 ring-purple-500/20 mx-auto mb-4">
                  <Coins className="h-8 w-8 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Initializing Your Token</h2>
                <p className="text-sm text-muted-foreground mt-2">Deploying your personal collateral token…</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <InitStep label="Compiling smart contract…" done={tokenSteps[0]} active={!tokenSteps[0]} />
                <InitStep label={`Deploying ${token?.tokenName || "your token"} (${token?.symbol || "???"}) on-chain…`} done={tokenSteps[1]} active={tokenSteps[0] && !tokenSteps[1]} />
                <InitStep label="10,000 tokens credited to your wallet!" done={tokenSteps[2]} active={tokenSteps[1] && !tokenSteps[2]} />
              </div>

              <div className="flex justify-center">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-1 w-1 rounded-full bg-purple-500/40 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: Done ── */}
          {step === "done" && (
            <div className="space-y-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 ring-2 ring-emerald-500/30 mx-auto mb-4">
                  <PartyPopper className="h-10 w-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">You're all set! 🎉</h2>
                <p className="text-sm text-muted-foreground mt-2">Your wallet and personal token have been created.</p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Wallet created at <span className="font-mono text-emerald-400 truncate">{wallet?.address?.slice(0, 20)}…</span>
                </div>
                {token && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    Token <strong className="text-white">{token.tokenName} ({token.symbol})</strong> — 10,000 tokens minted
                  </div>
                )}
              </div>

              <Button
                id="enter-dashboard"
                onClick={handleEnterDashboard}
                className="w-full rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 h-12 text-base gap-2"
              >
                Enter Dashboard <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
