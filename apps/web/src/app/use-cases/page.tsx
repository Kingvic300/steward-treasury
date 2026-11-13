import type { Metadata } from "next";
import { Clock3, Gauge, ShieldCheck, Users } from "lucide-react";
import { CtaCard, Frame, FrameHeader, PageHero } from "@/components/marketing";
import { Seals } from "@/components/seals";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Badge } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Use cases",
  description: "How DAOs, grant programmes, protocol teams and small organisations can set up a Steward treasury.",
};

interface Case {
  id: string;
  who: string;
  need: string;
  why: string;
  name: string;
  approvers: number;
  threshold: number;
  timelock: string;
  roles: [string, string][];
  limit?: { who: string; amount: string; period: string; percent: number };
}

const CASES: Case[] = [
  {
    id: "dao",
    who: "DAO or community fund",
    need: "Many contributors, a few trusted signers, and members who want to see decisions before they land.",
    why: "Working groups pay routine costs from their own limit. Anything larger is public for two days before it can run.",
    name: "Commons Fund",
    approvers: 5,
    threshold: 3,
    timelock: "48 hours",
    roles: [
      ["Proposers", "Signers and working-group leads"],
      ["Executors", "Any signer"],
    ],
    limit: { who: "Events working group", amount: "2,000.00 USDC", period: "monthly", percent: 42 },
  },
  {
    id: "grants",
    who: "Grants programme",
    need: "Batches of payouts each round, approved by a committee, executed without chasing signatures.",
    why: "One proposal carries up to ten payouts. The committee approves the batch once and it settles in one transaction.",
    name: "Round 7 Grants",
    approvers: 3,
    threshold: 2,
    timelock: "24 hours",
    roles: [
      ["Proposers", "Programme manager"],
      ["Executors", "Operations key or a bot"],
    ],
  },
  {
    id: "protocol",
    who: "Protocol team",
    need: "A treasury that also owns contracts: it upgrades them, sets parameters and collects fees.",
    why: "Make the treasury the admin of your contracts. Every parameter change then inherits its threshold and timelock.",
    name: "Protocol Admin",
    approvers: 6,
    threshold: 4,
    timelock: "72 hours",
    roles: [
      ["Proposers", "Core team"],
      ["Actions", "Invoke calls to admin functions"],
    ],
    limit: { who: "Keeper bot", amount: "50.00 XLM", period: "weekly", percent: 18 },
  },
  {
    id: "company",
    who: "Small company or collective",
    need: "Two or three founders who want shared control without a meeting for every invoice.",
    why: "Day-to-day payments come from the operations allowance. Payroll and large transfers need two founders.",
    name: "Northwind Studio",
    approvers: 3,
    threshold: 2,
    timelock: "1 hour",
    roles: [
      ["Proposers", "All founders"],
      ["Executors", "Any founder"],
    ],
    limit: { who: "Operations wallet", amount: "1,500.00 USDC", period: "weekly", percent: 63 },
  },
];

function SetupCard({ item }: { item: Case }) {
  return (
    <Frame>
      <FrameHeader aside={<span className="font-mono text-xs text-muted">testnet</span>}>
        <span className="font-medium text-foreground">{item.name}</span>
      </FrameHeader>
      <div className="grid gap-px bg-border sm:grid-cols-2">
        <div className="grid gap-3 bg-background p-5">
          <span className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="size-3.5" /> Threshold
          </span>
          <span className="text-2xl font-semibold tracking-tight tabular">
            {item.threshold} <span className="text-muted">of {item.approvers}</span>
          </span>
          <Seals total={item.approvers} threshold={item.threshold} approvals={item.threshold} size="sm" />
        </div>
        <div className="grid gap-3 bg-background p-5">
          <span className="flex items-center gap-2 text-xs text-muted">
            <Clock3 className="size-3.5" /> Timelock
          </span>
          <span className="text-2xl font-semibold tracking-tight">{item.timelock}</span>
          <span className="text-xs text-muted">between approval and execution</span>
        </div>
      </div>
      <dl className="divide-y divide-border border-t border-border text-sm">
        {item.roles.map(([term, value]) => (
          <div key={term} className="flex items-center justify-between gap-4 px-5 py-3">
            <dt className="flex items-center gap-2 text-muted">
              <Users className="size-3.5" />
              {term}
            </dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {item.limit ? (
        <div className="grid gap-2.5 border-t border-border px-5 py-4">
          <span className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <Gauge className="size-3.5 text-muted" />
              {item.limit.who}
            </span>
            <span className="font-mono text-xs tabular text-muted">
              {item.limit.amount} {item.limit.period}
            </span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-raised">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${item.limit.percent}%` }} />
          </span>
        </div>
      ) : (
        <div className="border-t border-border px-5 py-4 text-sm text-muted">No spending limits: every payment is voted on.</div>
      )}
    </Frame>
  );
}

function HeroStack() {
  return (
    <div className="relative">
      <div className="grid gap-3">
        {CASES.map((item, index) => (
          <Frame key={item.id} className={index % 2 ? "ml-8 sm:ml-14" : "mr-8 sm:mr-14"}>
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted">{item.who}</span>
              </span>
              <span className="flex items-center gap-3">
                <Seals total={item.approvers} threshold={item.threshold} approvals={item.threshold} size="sm" />
                <Badge tone="idle" className="font-mono">
                  {item.timelock}
                </Badge>
              </span>
            </div>
          </Frame>
        ))}
      </div>
    </div>
  );
}

export default function UseCasesPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main">
        <PageHero title="One contract, set up four different ways" visual={<HeroStack />}>
          <p>
            Roles, threshold, timelock and limits are yours to choose. These starting points show how the same
            building blocks fit different groups.
          </p>
        </PageHero>

        <nav aria-label="Use cases" className="sticky top-16 z-20 border-b border-border bg-background">
          <ul className="container-page flex gap-6 overflow-x-auto py-3 text-sm text-muted [scrollbar-width:none]">
            {CASES.map((item) => (
              <li key={item.id} className="shrink-0">
                <a href={`#${item.id}`} className="hover:text-foreground">
                  {item.who}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {CASES.map((item, index) => (
          <section
            key={item.id}
            id={item.id}
            aria-labelledby={`${item.id}-title`}
            className={index % 2 ? "scroll-mt-28 border-b border-border bg-raised" : "scroll-mt-28 border-b border-border"}
          >
            <div className="container-page grid gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-center lg:gap-16 lg:py-20">
              <div className="grid content-start gap-5">
                <span className="font-mono text-sm tabular text-muted">0{index + 1}</span>
                <h2 id={`${item.id}-title`} className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {item.who}
                </h2>
                <p className="max-w-[36rem] text-lg text-muted">{item.need}</p>
                <p className="max-w-[36rem] border-l-2 border-accent pl-4">{item.why}</p>
              </div>
              <div aria-hidden className="select-none">
                <SetupCard item={item} />
              </div>
            </div>
          </section>
        ))}

        <CtaCard title="Try a setup on testnet">
          Creating a treasury costs only testnet XLM. Every rule can change later through a proposal.
        </CtaCard>
      </main>
      <SiteFooter />
    </div>
  );
}
