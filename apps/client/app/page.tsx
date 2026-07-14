"use client"
import Navbar from "@/feature/landing-page/component/navbar"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function Page() {
  const router = useRouter();
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

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button
              size="lg"
              className="rounded-2xl bg-emerald-500 px-8 text-black hover:bg-emerald-400"
              onClick={() => {
                // "use client";
                router.push("/dashboard")
              }}
            >
              Start Transaction
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl"
            >
              View Documentation
            </Button>
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