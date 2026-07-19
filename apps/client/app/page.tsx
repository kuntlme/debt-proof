"use client"
import Navbar from "@/feature/landing-page/component/navbar"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { BookOpen, Shield, ShieldCheck, Wallet, ArrowRight } from "lucide-react"

export default function Page() {
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <>
      <Navbar />

      <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
        {/* background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-24 h-[450px] w-[450px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="absolute right-20 top-40 h-[300px] w-[300px] rounded-full bg-cyan-500/20 blur-3xl" />
        </div>

        {/* hero */}
        <section className="mx-auto flex max-w-7xl flex-col items-center px-6 py-24 text-center md:py-32">
          <div className="mb-6 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Blockchain Powered Debt Verification Platform
          </div>

          <h1 className="max-w-5xl text-5xl font-bold tracking-tight md:text-7xl">
            Proof of Debt.
            <span className="block bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
              Secured on Blockchain.
            </span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            DebtProof is a decentralized platform to record, verify and track
            debt agreements securely on blockchain. Create transparent,
            tamper-proof debt contracts between lenders and borrowers.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row items-center justify-center">
            <Button
              size="lg"
              className="rounded-2xl bg-emerald-500 px-8 text-black hover:bg-emerald-400 font-semibold"
              onClick={() => {
                router.push(session ? "/dashboard" : "/login")
              }}
            >
              Start Transaction
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-2xl"
                >
                  View Documentation
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] border-border/60 bg-card/95 backdrop-blur-2xl text-foreground p-6">
                <DialogHeader>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                    <BookOpen className="h-6 w-6 text-emerald-500" />
                  </div>
                  <DialogTitle className="text-2xl font-bold text-center">DebtProof Documentation</DialogTitle>
                  <DialogDescription className="text-center text-muted-foreground">
                    Learn how the decentralized peer-to-peer debt verification protocol works.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                      <Shield className="h-4 w-4" /> 1. Decentralized Debt Agreements
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                      Lenders and Borrowers can propose and counter-sign peer-to-peer loan agreements. 
                      Once signed, the agreement terms (amount, interest rate, duration, and collateral) 
                      are permanently written to the blockchain as an immutable smart contract.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                      <Wallet className="h-4 w-4" /> 2. Collateral Protection
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                      Borrowers can lock dynamic digital token collateral in a secure escrow smart contract.
                      This minimizes lender risk and secures borrowers' collateral. The contract enforces 
                      automatic liquidation rules if defaults occur.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                      <ShieldCheck className="h-4 w-4" /> 3. Verification & Reputation
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                      Every transaction leaves an auditable cryptographic footprint. Credit profiles are built
                      on-chain based on past repayment histories, allowing users to build a trust score 
                      independent of traditional centralized bureaus.
                    </p>
                  </div>
                </div>

                <DialogFooter className="flex sm:justify-between items-center border-t border-border/50 pt-4 mt-2 gap-4">
                  <p className="text-[10px] text-muted-foreground">DebtProof v1.0.0 • Sepolia Testnet</p>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-xl"
                      onClick={() => router.push(session ? "/dashboard" : "/login")}
                    >
                      Get Started <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* features */}
        <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
          <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Immutable Records</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-7">
                Every debt agreement is stored securely on-chain,
                making it permanent, transparent and impossible
                to manipulate later.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Smart Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-7">
                Verify borrowers, lenders, signatures and repayment
                history using blockchain-backed validation.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Trustless Transparency</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-7">
                Reduce disputes and remove dependency on
                intermediaries through verifiable debt contracts.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  )
}