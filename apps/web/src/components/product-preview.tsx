import { FileText, Gauge, LayoutDashboard, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { Seals } from "./seals";
import { Badge, type Tone } from "./ui/misc";

const NAV = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Proposals", icon: FileText },
  { label: "Members", icon: Users },
  { label: "Limits", icon: Gauge },
  { label: "Settings", icon: Settings },
];

const BALANCES = [
  { symbol: "USDC", name: "USD Coin", amount: "248,310.00" },
  { symbol: "XLM", name: "Stellar Lumens", amount: "1,204,662.50" },
  { symbol: "AQUA", name: "Aquarius", amount: "9,800,000.00" },
];

const ROWS: { id: number; title: string; meta: string; approvals: number; status: string; tone: Tone; clock?: string }[] = [
  { id: 42, title: "March contributor payouts", meta: "2 actions, needs your approval", approvals: 1, status: "Voting", tone: "wait", clock: "6d 04h" },
  { id: 41, title: "Raise the threshold to 3 of 5", meta: "3 actions, in timelock", approvals: 2, status: "Timelock", tone: "warn", clock: "17h 22m" },
  { id: 40, title: "Supply 50,000 USDC to Blend", meta: "1 action, ready to execute", approvals: 2, status: "Ready", tone: "accent", clock: "2d 11h" },
  { id: 39, title: "Q1 audit retainer", meta: "1 action, executed 2 days ago", approvals: 3, status: "Executed", tone: "ok" },
];

/**
 * A faithful, static rendering of the treasury dashboard, used on the landing
 * page so visitors see the product itself rather than a description of it.
 */
export function ProductPreview() {
  return (
    <div aria-hidden className="overflow-hidden rounded-t-xl border border-b-0 border-border-strong bg-background text-left">
      <div className="grid lg:grid-cols-[13.5rem_1fr]">
        <div className="hidden border-r border-border p-5 lg:grid lg:content-start lg:gap-6">
          <span className="inline-flex items-center gap-2 font-semibold">
            <LogoMark className="size-6" /> Steward
          </span>
          <div className="grid gap-0.5 rounded-md border border-border p-3">
            <span className="text-sm font-medium">Orbit Collective</span>
            <span className="font-mono text-xs text-muted">CCVCO6…YTJBFJ</span>
          </div>
          <div className="grid gap-0.5">
            {NAV.map((item) => (
              <span
                key={item.label}
                className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted", item.active && "bg-raised text-foreground")}
              >
                <item.icon className={cn("size-4", item.active && "text-accent")} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-8 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-1">
              <span className="text-2xl font-semibold tracking-tight">Overview</span>
              <span className="text-sm text-muted">3 of 5 approvers, 24 hour timelock</span>
            </div>
            <span className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent">New proposal</span>
          </div>

          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            {BALANCES.map((balance) => (
              <div key={balance.symbol} className="grid gap-3 bg-background p-5">
                <span className="text-sm text-muted">{balance.name}</span>
                <span className="font-mono text-xl tabular sm:text-2xl">
                  {balance.amount} <span className="text-sm text-muted">{balance.symbol}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="font-semibold">Proposals</span>
              <span className="text-sm text-muted">1 needs your approval</span>
            </div>
            <div className="divide-y divide-border">
              {ROWS.map((row) => (
                <div key={row.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 px-5 py-4 md:grid-cols-[auto_1fr_auto_8rem_6.5rem]">
                  <span className="font-mono text-sm tabular text-muted">#{row.id}</span>
                  <span className="grid min-w-0">
                    <span className="truncate font-medium">{row.title}</span>
                    <span className="truncate text-sm text-muted">{row.meta}</span>
                  </span>
                  <span className="hidden items-center gap-2 md:flex">
                    <Seals total={5} threshold={3} approvals={row.approvals} size="sm" />
                  </span>
                  <span className="hidden text-right font-mono text-xs tabular text-muted md:block">{row.clock ?? ""}</span>
                  <span className="justify-self-end">
                    <Badge tone={row.tone}>{row.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
