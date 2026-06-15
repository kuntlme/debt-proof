import { signIn } from "@/lib/auth"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      {/* background */}
      <div className="absolute inset-0 -z-10 bg-grid-black/[0.03] dark:bg-grid-white/[0.03]" />

      {/* glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />

        <div className="absolute right-10 top-20 h-[260px] w-[260px] rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="absolute left-10 bottom-10 h-[220px] w-[220px] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <Card className="w-full max-w-md border-border/60 bg-card/70 shadow-2xl backdrop-blur-2xl">
        <CardHeader className="space-y-6 text-center">
          {/* logo */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
          </div>

          {/* badge */}
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            Blockchain Secured Debt Verification
          </div>

          {/* title */}
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight">
              Welcome to
              <span className="ml-2 text-emerald-500">
                DebtProof
              </span>
            </CardTitle>

            <CardDescription className="mx-auto max-w-sm text-sm leading-6">
              Record, verify and manage debt agreements with
              transparent blockchain-backed proof between lenders
              and borrowers.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form
            action={async () => {
              "use server"
              await signIn("google")
            }}
          >
            <Button
              type="submit"
              variant="outline"
              className="h-12 w-full rounded-xl text-base font-medium shadow-sm transition-all hover:scale-[1.02]"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>
          </form>

          <p className="text-center text-xs leading-5 text-muted-foreground">
            By continuing, you agree to securely connect your identity
            with DebtProof for blockchain debt verification.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}