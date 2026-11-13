import type { Metadata } from "next";
import { LandingCta } from "@/components/landing-cta";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Use cases",
  description: "How DAOs, grant programmes, protocol teams and small organisations can set up a Steward treasury.",
};

const CASES = [
  {
    who: "A DAO or community fund",
    need: "Many contributors, a few trusted signers, and members who want to see decisions before they land.",
    setup: [
      ["Approvers", "5 elected signers, threshold 3"],
      ["Proposers", "Signers plus working-group leads"],
      ["Timelock", "48 hours"],
      ["Limits", "Each working group: a monthly budget in its own token"],
    ],
    why: "Working groups pay routine costs from their limit. Anything larger is visible for two days before it can run.",
  },
  {
    who: "A grants programme",
    need: "Batches of payouts each round, approved by a committee, executed without chasing signatures.",
    setup: [
      ["Approvers", "Committee of 3, threshold 2"],
      ["Proposers", "Programme manager"],
      ["Executors", "An operations key or a bot"],
      ["Timelock", "24 hours"],
    ],
    why: "One proposal carries up to ten payouts. The committee approves the batch once, and it settles in a single transaction.",
  },
  {
    who: "A protocol team",
    need: "A treasury that also owns contracts: it must upgrade them, set parameters and collect fees.",
    setup: [
      ["Approvers", "Core team multisig, threshold 4 of 6"],
      ["Timelock", "72 hours for everything"],
      ["Actions", "Invoke calls to the protocol's admin functions"],
      ["Limits", "None, or a small gas budget for a keeper"],
    ],
    why: "Make the treasury the admin of your contracts. Every parameter change then inherits its threshold and its timelock.",
  },
  {
    who: "A small company or collective",
    need: "Two or three founders who want shared control without a meeting for every invoice.",
    setup: [
      ["Approvers", "All founders, threshold 2"],
      ["Timelock", "1 hour"],
      ["Limits", "Operations wallet: a weekly allowance"],
      ["Executors", "Any founder"],
    ],
    why: "Day-to-day payments come from the operations allowance. Payroll and large transfers need two founders.",
  },
];

export default function UseCasesPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main">
        <PageIntro title="One contract, set up four different ways">
          Roles, threshold, timelock and limits are all yours to choose. These starting points show how the same
          building blocks fit different groups. They are suggestions, not presets.
        </PageIntro>

        <section aria-label="Use cases" className="container-page grid gap-6 pb-20">
          {CASES.map((item) => (
            <article key={item.who} className="grid gap-6 border-t border-border py-10 lg:grid-cols-[1fr_22rem] lg:gap-12">
              <div className="grid content-start gap-3">
                <h2 className="text-2xl font-semibold">{item.who}</h2>
                <p className="max-w-prose text-muted">{item.need}</p>
                <p className="max-w-prose border-l-2 border-accent pl-4">{item.why}</p>
              </div>
              <dl className="grid content-start gap-px overflow-hidden rounded-md border border-border bg-border text-sm">
                {item.setup.map(([term, value]) => (
                  <div key={term} className="grid grid-cols-[6.5rem_1fr] gap-3 bg-background px-4 py-3">
                    <dt className="text-muted">{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>

        <section className="border-t border-border bg-surface">
          <div className="container-page grid gap-5 py-16">
            <h2 className="text-2xl font-semibold sm:text-3xl">Try a setup on testnet</h2>
            <p className="max-w-prose text-muted">
              Creating a treasury costs only testnet XLM. Change the rules later through a proposal.
            </p>
            <LandingCta />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
