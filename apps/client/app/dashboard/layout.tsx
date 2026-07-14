"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Coins,
  BarChart3,
  User,
  LogOut,
  ChevronRight,
  Wallet,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/loans", label: "Loans", icon: ArrowLeftRight },
  { href: "/dashboard/token", label: "My Token", icon: Coins },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: BarChart3 },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "DP";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-border/50 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-500/30">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">DebtProof</p>
            <p className="text-[10px] text-muted-foreground">Blockchain P2P Lending</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-emerald-400" : "")} />
                {label}
                {active && <ChevronRight className="ml-auto h-3 w-3 text-emerald-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="border-t border-border/50 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-accent/50 px-3 py-2.5">
            <Avatar className="h-8 w-8 ring-2 ring-emerald-500/30">
              <AvatarImage src={user?.image ?? ""} />
              <AvatarFallback className="bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name || "User"}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => signOut({ callbackUrl: "/" })}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex items-center gap-3 border-b border-border/50 bg-card/50 px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <span className="font-bold text-sm">DebtProof</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
