import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { LandingCta } from "@/components/landing-cta";
import { LifecycleBoard } from "@/components/lifecycle-board";
import { HeroShowcase, WizardPreview } from "@/components/hero-showcase";
import { ProductPreview } from "@/components/product-preview";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const FEATURES = [
  {
    title: "Proposals that bundle actions",
    body: "Up to ten steps in one proposal: payments, contract calls, member and rule changes. They all run, or none do.",
    native: "Every signer must co-sign the same transaction before it expires.",
  },
  {
    title: "A timelock with a way out",
    body: "Approved proposals wait before they can run. Members see what is coming, and the proposer can cancel.",
    native: "A transaction with enough signatures runs at once.",
  },
  {
    title: "Three separate roles",
    body: "One key drafts, others approve, another executes. Or give one person all three.",
    native: "A signer is a signer. Weights are the only distinction.",
  },
  {
    title: "Spending limits",
    body: "Per spender, per token, per period. Routine payments skip the vote, inside a cap that resets on the clock.",
    native: "No allowances. Every payment needs the full threshold.",
  },
  {
    title: "Calls to any contract",
    body: "An approved proposal can invoke any Soroban contract with the treasury's own authority.",
    native: "Signers co-sign each contract call by hand.",
  },
  {
    title: "Self-governed",
    body: "No admin key. Members, threshold, timings and the contract's code change only through the treasury's own proposals.",
    native: "One high-threshold signature can change anything, immediately.",
  },
];

const ROLES = [
  { verb: "Drafts", name: "Proposer", body: "Creates proposals and bundles their actions. Can cancel their own proposal until it is executed.", cannot: "approve or run what they drafted, unless they also hold those roles." },
  { verb: "Votes", name: "Approver", body: "Approves or rejects, once per proposal. Approvals reaching the threshold start the timelock.", cannot: "change a vote, or vote on a proposal made under older rules." },
  { verb: "Runs", name: "Executor", body: "Executes an approved proposal after the timelock and before the window closes.", cannot: "alter the actions, or run anything that was not approved." },
];

const LIMITS = [
  { who: "Operations wallet", period: "Daily", resets: "6h 12m", spent: "340.00 XLM", cap: "500.00", left: "160.00", percent: 68 },
  { who: "Payroll service", period: "Every 30 days", resets: "11 days", spent: "2,500.00 USDC", cap: "10,000.00", left: "7,500.00", percent: 25 },
  { who: "Events team", period: "Weekly", resets: "2 days", spent: "0.00 USDC", cap: "1,200.00", left: "1,200.00", percent: 0 },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main id="main">
        <section className="container-page grid items-center gap-14 pb-16 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] lg:gap-16 lg:pb-24 lg:pt-20">
          <div className="grid content-center gap-7">
            <h1 className="max-w-[18ch] text-[clamp(2.1rem,3.6vw,3.25rem)] font-semibold tracking-[-0.03em]">
              A multisig treasury that waits for signatures, then the clock.
            </h1>
            <p className="max-w-[34rem] text-lg leading-relaxed text-muted">
              Bundle actions into proposals, collect approvals, sit out a timelock, then execute. Routine payments
              run under spending limits instead.
            </p>
            <div className="grid gap-3">
              <LandingCta />
              <p className="text-sm text-muted">Open source, MIT licensed. Unaudited: not for real funds.</p>
            </div>
          </div>
          <HeroShowcase />
        </section>

        <section aria-label="The Steward dashboard" className="border-t border-border bg-raised">
          <div className="container-page pt-10 lg:pt-16">
            <ProductPreview />
          </div>
        </section>

        <section aria-labelledby="lifecycle" className="border-t border-border">
          <div className="container-page grid gap-6 py-16 lg:grid-cols-[1fr_minmax(0,34rem)] lg:items-end lg:gap-16 lg:py-20">
            <h2 id="lifecycle" className="max-w-[20ch] text-3xl font-semibold sm:text-4xl">
              One proposal, five stations.
            </h2>
            <p className="text-lg text-muted">
              Every change to a treasury takes the same path. Below is a single proposal at each point on it:
              three approvers, a threshold of two, a 24 hour timelock.
            </p>
          </div>
          <LifecycleBoard />
        </section>

        <section aria-labelledby="roles" className="border-b border-border">
          <div className="container-page grid gap-12 py-20 lg:py-24">
            <h2 id="roles" className="max-w-[20ch] text-3xl font-semibold sm:text-4xl">
              Three roles, kept apart.
            </h2>
            <dl className="grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border">
              {ROLES.map((role) => (
                <div key={role.name} className="grid content-start gap-4 md:px-8 md:first:pl-0 md:last:pr-0">
                  <dt className="grid gap-3">
                    <span className="text-sm font-medium uppercase tracking-[0.08em] text-accent">{role.verb}</span>
                    <span className="text-2xl font-semibold tracking-tight">{role.name}</span>
                  </dt>
                  <dd className="grid gap-3 text-muted">
                    <p>{role.body}</p>
                    <p className="border-t border-border pt-3 text-sm">Cannot: {role.cannot}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="limits" className="bg-raised">
          <div className="container-page grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-24">
            <div className="grid gap-5">
              <h2 id="limits" className="max-w-[16ch] text-3xl font-semibold sm:text-4xl">
                Small payments skip the vote.
              </h2>
              <p className="max-w-[34rem] text-lg text-muted">
                A proposal can give one address an allowance: up to an amount of one token per period. Inside
                it, that address pays directly. Outside it, the contract refuses.
              </p>
              <ul className="grid max-w-[34rem] gap-2 border-t border-border-strong pt-5 text-muted">
                <li>Windows are fixed on the clock, for example each UTC day.</li>
                <li>Unused allowance does not carry over.</li>
                <li>Only a proposal can create, change or remove a limit.</li>
              </ul>
            </div>
            <div aria-hidden className="rounded-xl border border-border-strong bg-background">
              {LIMITS.map((limit) => (
                <div key={limit.who} className="grid gap-3 border-b border-border p-6 last:border-0 sm:p-8">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-lg font-medium">{limit.who}</span>
                    <span className="text-sm text-muted">{limit.period}, resets in {limit.resets}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-raised">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${limit.percent}%` }} />
                  </div>
                  <div className="flex items-baseline justify-between gap-4 font-mono tabular">
                    <span className="text-lg">
                      {limit.spent} <span className="text-sm text-muted">of {limit.cap}</span>
                    </span>
                    <span className="text-sm text-muted">{limit.left} left</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="features" className="container-page grid gap-12 py-20 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20 lg:py-24">
          <div className="grid content-start gap-5 lg:sticky lg:top-24 lg:self-start">
            <h2 id="features" className="text-3xl font-semibold sm:text-4xl">
              What native multisig leaves out
            </h2>
            <p className="text-lg text-muted">
              Stellar accounts already support signer weights and thresholds. That settles who must sign. Steward
              adds what can be signed, when it may run, in which role, and within which limits.
            </p>
            <Link href="/how-it-works" className="w-fit text-accent underline underline-offset-4 hover:text-accent-strong">
              Read how it works
            </Link>
          </div>

          <div className="border-t border-foreground">
            <div className="hidden grid-cols-[1.4fr_1fr] gap-10 border-b border-border py-3 text-sm text-muted sm:grid">
              <span>With Steward</span>
              <span>With native multisig</span>
            </div>
            {FEATURES.map((feature) => (
              <article key={feature.title} className="grid gap-4 border-b border-border py-8 sm:grid-cols-[1.4fr_1fr] sm:gap-10">
                <div className="grid gap-2">
                  <h3 className="flex items-start gap-3 text-lg font-semibold">
                    <Check className="mt-1 size-5 shrink-0 text-accent" strokeWidth={2.5} aria-hidden />
                    {feature.title}
                  </h3>
                  <p className="pl-8 text-muted">{feature.body}</p>
                </div>
                <p className="flex items-start gap-3 pl-8 text-muted sm:pl-0">
                  <Minus className="mt-1 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="sr-only">Native multisig: </span>
                    {feature.native}
                  </span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="start" className="border-t border-border bg-raised">
          <div className="container-page py-16 lg:py-24">
            <div className="grid overflow-hidden rounded-xl border border-border-strong bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
              <div className="grid content-center gap-6 p-8 sm:p-12">
                <h2 id="start" className="max-w-[20ch] text-3xl font-semibold sm:text-4xl">
                  Set one up in about two minutes.
                </h2>
                <p className="max-w-[34rem] text-lg text-muted">
                  Pick signers, roles, a threshold and a timelock. Steward deploys your own treasury contract to
                  testnet. From then on, only its proposals can change it.
                </p>
                <LandingCta />
              </div>
              <WizardPreview />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
