import type { Metadata } from "next";
import { AlertTriangle, Calculator, Check, KeyRound, Layers, Lock, RefreshCcw, ShieldCheck, UserX } from "lucide-react";
import { Frame, FrameHeader, PageHero, SectionHeading } from "@/components/marketing";
import { REPO_URL, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Badge, Notice } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Security",
  description: "What Steward's contract guarantees, what it deliberately does not, and what has and has not been reviewed.",
};

const GUARANTEES = [
  { icon: KeyRound, title: "No admin key", body: "The treasury is its own administrator. The deployer keeps no special power, and no key changes roles or rules directly." },
  { icon: Lock, title: "Rules change only by vote", body: "Members, threshold, timings, spending limits and upgrades change only inside an executed proposal." },
  { icon: Layers, title: "Atomic execution", body: "A proposal's actions all succeed or all revert. It is marked executed before its first action runs, so it cannot be replayed." },
  { icon: UserX, title: "No orphaned treasury", body: "The last member of a role cannot be removed, and the threshold is re-checked against the approver count after every change." },
  { icon: RefreshCcw, title: "Old approvals expire with old rules", body: "Any change to members or rules makes open proposals stale. Approvals under one set of signers cannot execute under another." },
  { icon: Calculator, title: "Checked arithmetic", body: "Every sum is overflow-checked and fails with a typed error. The release build keeps overflow checks on." },
];

const TRADEOFFS = [
  { title: "Spending limits skip the timelock", body: "That is their purpose and their risk. A spender's key can move up to its allowance per period with no vote. Keep limits small." },
  { title: "Invoke can call any contract", body: "An approved Invoke runs with the treasury's full authority. Approvers must read the target, function and arguments. The app decodes them; it cannot judge intent." },
  { title: "Upgrades replace the code", body: "An approved Upgrade swaps the treasury's Wasm. Use a timelock long enough for members to verify the new hash." },
  { title: "Executors choose the moment", body: "An executor cannot change what runs, but decides when inside the window, and can decline. Keep more than one executor." },
  { title: "A zero timelock is allowed", body: "Useful for testing, risky in production: approved proposals can run the minute they pass." },
];

const SUITES = [
  ["constructor", "rejects bad thresholds, duplicates, missing roles"],
  ["lifecycle", "propose, approve, queue, timelock, execute"],
  ["auth", "env.auths() for propose and approve"],
  ["atomic", "second action fails, first reverts"],
  ["roles", "propose, vote and execute enforced separately"],
  ["timing", "early, expired window, expired vote"],
  ["membership", "add, remove, stale proposals, last executor"],
  ["limits", "within, over, reset, removed, missing"],
  ["invoker_auth", "executor-only signature, no-signature failure"],
  ["proptest", "window arithmetic and threshold invariants"],
];

function TestReport() {
  return (
    <Frame className="overflow-hidden">
      <FrameHeader aside={<Badge tone="ok">passing</Badge>}>
        <span className="font-mono">cargo test -p steward-treasury</span>
      </FrameHeader>
      <ul className="divide-y divide-border font-mono text-xs">
        {SUITES.map(([name, detail]) => (
          <li key={name} className="flex items-center gap-3 px-5 py-2.5">
            <Check className="size-3.5 shrink-0 text-ok" strokeWidth={3} />
            <span className="w-24 shrink-0">{name}</span>
            <span className="truncate text-muted">{detail}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border bg-raised px-5 py-3 font-mono text-xs">
        test result: <span className="text-ok">ok</span>. 96 passed; 0 failed
      </div>
    </Frame>
  );
}

export default function SecurityPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main">
        <PageHero title="What the contract guarantees, and what it leaves to you" visual={<TestReport />}>
          <p>A treasury is only as trustworthy as its limits are clear. This page lists both sides plainly.</p>
          <Notice tone="warn" title="Not audited">
            No independent security review has been done. Use testnet only; do not hold real funds in Steward.
          </Notice>
        </PageHero>

        <section aria-labelledby="guarantees" className="container-page grid gap-10 py-16 lg:py-24">
          <SectionHeading id="guarantees" title="Enforced by the contract">
            These hold no matter which app or wallet talks to the treasury.
          </SectionHeading>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUARANTEES.map((item) => (
              <div key={item.title} className="grid content-start gap-3 rounded-xl border border-border p-6">
                <dt className="grid gap-4">
                  <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-semibold">{item.title}</span>
                </dt>
                <dd className="text-sm text-muted">{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="tradeoffs" className="border-y border-border bg-raised">
          <div className="container-page grid gap-10 py-16 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16 lg:py-24">
            <SectionHeading id="tradeoffs" title="Deliberate trade-offs" className="content-start lg:sticky lg:top-24 lg:self-start">
              Design choices, not bugs. Each one moves risk onto the people who approve.
            </SectionHeading>
            <dl className="grid gap-3">
              {TRADEOFFS.map((item) => (
                <div key={item.title} className="grid gap-2 rounded-xl border border-border bg-background p-6">
                  <dt className="flex items-center gap-2.5 font-semibold">
                    <AlertTriangle className="size-4 text-warn" aria-hidden />
                    {item.title}
                  </dt>
                  <dd className="max-w-[44rem] text-sm text-muted">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="tested" className="container-page grid gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:py-24">
          <SectionHeading id="tested" title="How it is tested" />
          <div className="grid gap-4 text-muted">
            <p>
              Unit tests cover the constructor, the lifecycle, role enforcement, timing edges, cancel and replay,
              input validation, membership changes and spending limits.
            </p>
            <p>
              Authorisation tests run with only the executor&apos;s signature, proving contract calls succeed through
              invoker authorisation, and with no signatures, proving they fail. Property tests check the spending
              window arithmetic and threshold invariants on random inputs.
            </p>
            <p className="flex items-start gap-2.5 text-foreground">
              <ShieldCheck className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
              <span>
                Tests show care, not the absence of bugs. Read the{" "}
                <a href={`${REPO_URL}/blob/main/SPEC.md`} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
                  specification
                </a>{" "}
                and the{" "}
                <a href={`${REPO_URL}/tree/main/contracts/treasury`} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
                  contract source
                </a>
                , and report issues privately through the repository&apos;s security policy.
              </span>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
