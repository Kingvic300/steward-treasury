"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Gauge, LayoutDashboard, Settings, Users } from "lucide-react";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyButton } from "./address";
import { Logo, LogoMark } from "./logo";
import { Badge } from "./ui/misc";
import { WalletButton } from "./wallet-button";

const NAV = [
  { segment: "", label: "Overview", icon: LayoutDashboard },
  { segment: "/proposals", label: "Proposals", icon: FileText },
  { segment: "/members", label: "Members", icon: Users },
  { segment: "/limits", label: "Limits", icon: Gauge },
  { segment: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ treasuryId, name, children }: { treasuryId: string; name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/t/${treasuryId}`;
  const active = (segment: string) => (segment === "" ? pathname === base : pathname.startsWith(base + segment));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border lg:flex lg:flex-col lg:gap-6 lg:p-5">
        <Link href="/" aria-label="Steward home">
          <Logo />
        </Link>
        <div className="grid gap-1 rounded-md border border-border bg-surface p-3">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="flex items-center gap-0.5 font-mono text-xs text-muted">
            {truncateAddress(treasuryId, 6, 6)}
            <CopyButton value={treasuryId} label="Copy contract id" />
          </p>
          <Link href="/treasuries" className="text-xs text-accent hover:underline">
            Switch treasury
          </Link>
        </div>
        <nav aria-label="Treasury" className="grid gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.segment}
              href={base + item.segment}
              aria-current={active(item.segment) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-foreground",
                active(item.segment) && "bg-raised text-foreground",
              )}
            >
              <item.icon className={cn("size-4", active(item.segment) && "text-accent")} aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto text-xs leading-relaxed text-muted">
          Testnet only. Steward is unaudited: do not use it with real funds.
        </p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="lg:hidden" aria-label="Steward home">
              <LogoMark />
            </Link>
            <span className="truncate text-sm font-medium lg:hidden">{name}</span>
            <Badge tone="warn">Testnet</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <WalletButton />
          </div>
        </header>

        <main id="main" className="container-page flex-1 pb-28 pt-6 sm:pt-8 lg:pb-12">
          {children}
        </main>

        <nav
          aria-label="Treasury"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.segment}
              href={base + item.segment}
              aria-current={active(item.segment) ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium text-muted",
                active(item.segment) && "text-accent",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="max-w-prose text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
