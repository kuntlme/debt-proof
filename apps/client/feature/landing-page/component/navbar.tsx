"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle-button"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"
import { Menu } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

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

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-3">
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

        {/* Mobile menu */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] border-l border-border/50 bg-background/95 backdrop-blur-md p-6">
              <SheetHeader className="text-left border-b border-border/50 pb-4 mb-6">
                <SheetTitle>
                  <Link href="/" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_20px_#10b981]" />
                    <span className="text-xl font-bold tracking-tight text-foreground">
                      Debt<span className="text-emerald-500">Proof</span>
                    </span>
                  </Link>
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-4">
                {status === "loading" ? (
                  <>
                    <Skeleton className="h-11 w-full rounded-xl" />
                    <Skeleton className="h-11 w-full rounded-xl" />
                  </>
                ) : session ? (
                  <>
                    <Button
                      variant="ghost"
                      className="w-full justify-start rounded-xl text-foreground text-base h-11"
                      onClick={() => {
                        router.push("/dashboard");
                      }}
                    >
                      Dashboard
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start rounded-xl text-foreground border-border text-base h-11"
                      onClick={() => {
                        router.push("/dashboard/profile");
                      }}
                    >
                      {session.user?.name || "Account"}
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full rounded-xl bg-emerald-500 text-black font-semibold h-11 text-base hover:bg-emerald-400"
                    onClick={() => {
                      router.push("/login");
                    }}
                  >
                    Login
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}

export default Navbar