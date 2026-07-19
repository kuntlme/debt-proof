"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle-button"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"

function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_20px_#10b981]" />

          <span className="text-2xl font-bold tracking-tight text-foreground transition group-hover:opacity-90">
            Debt
            <span className="text-emerald-500">Proof</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
              <ThemeToggle />
            </div>
          ) : session ? (
            <>
              <Button
                variant="ghost"
                className="rounded-full text-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => router.push("/dashboard")}
              >
                Dashboard
              </Button>

              <Button
                variant="outline"
                className="rounded-full border-border bg-background hover:bg-accent"
                onClick={() => router.push("/dashboard/profile")}
              >
                {session.user?.name || "Account"}
              </Button>

              <ThemeToggle />
            </>
          ) : (
            <>
              <Button
                className="rounded-full bg-emerald-500 px-6 text-black shadow-lg transition hover:bg-emerald-400"
                onClick={() => router.push("/login")}
              >
                Login
              </Button>

              <ThemeToggle />
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar