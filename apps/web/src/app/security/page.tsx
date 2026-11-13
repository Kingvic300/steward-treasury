import type { Metadata } from "next";
import { PageIntro, REPO_URL, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Notice } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Security",
  description: "What Steward's contract guarantees, what it deliberately does not, and what has and has not been reviewed.",
};

const GUARANTEES = [
  { title: "No admin key", body: "The treasury is its own administrator. The deployer keeps no special power, and no key can change roles or rules directly." },
  { title: "Rules change only by vote", body: "Members, threshold, timings, spending limits and code upgrades change only inside an executed proposal." },
  { title: "Atomic execution", body: "A proposal's actions all succeed or all revert. A proposal is marked executed before its first action runs, so it cannot be replayed." },
  { title: "No orphaned treasury", body: "The last member of a role cannot be removed, and the threshold is re-checked against the approver count after every governance proposal." },
  { title: "Old approvals do not outlive old rules", body: "Any change to members or rules makes every open proposal stale. Approvals gathered under one set of signers cannot execute under another." },
  { title: "Checked arithmetic", body: "Every sum is overflow-checked and fails with a typed error. The release build also keeps overflow checks on." },
];

const TRADEOFFS = [
  { title: "Spending limits skip the timelock", body: "That is their purpose, and also their risk. A spender's key can move up to its allowance per period with no vote. Keep limits small and remove them when no longer needed." },
  { title: "Invoke can call any contract", body: "An approved Invoke action runs with the treasury's full authority. Approvers must read the target contract, function and arguments. The app decodes them, but it cannot judge intent." },
  { title: "Upgrades replace the code", body: "An approved Upgrade action swaps the treasury's Wasm. The timelock is the safeguard: use a delay long enough for members to verify the new hash." },
  { title: "Executors choose the moment", body: "An executor cannot change what runs, but decides when inside the execution window, and can decline. Keep more than one executor." },
  { title: "A zero timelock is allowed", body: "Useful for testing, risky in production: approved proposals can run in the same minute they pass." },
];

export default function SecurityPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main">
        <PageIntro title="What the contract guarantees, and what it leaves to you">
          A treasury is only as trustworthy as its limits are clear. This page lists both sides plainly.
        </PageIntro>

        <section className="container-page pb-12">
          <Notice tone="warn" title="Steward has not been audited">
            No independent security review has been done. The app is restricted to Stellar testnet. Do not deploy
            the contract to mainnet or use it with real funds.
          </Notice>
        </section>

        <section aria-labelledby="guarantees" className="container-page grid gap-8 pb-16">
          <h2 id="guarantees" className="text-2xl font-semibold sm:text-3xl">
            Enforced by the contract
          </h2>
          <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {GUARANTEES.map((item) => (
              <div key={item.title} className="grid content-start gap-2 bg-surface p-6">
                <dt className="font-semibold">{item.title}</dt>
                <dd className="text-sm text-muted">{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="tradeoffs" className="border-y border-border bg-surface">
          <div className="container-page grid gap-8 py-16">
            <div className="grid gap-3">
              <h2 id="tradeoffs" className="text-2xl font-semibold sm:text-3xl">
                Deliberate trade-offs
              </h2>
              <p className="max-w-prose text-muted">These are design choices, not bugs. Each one moves risk onto the people who approve.</p>
            </div>
            <dl className="grid gap-6">
              {TRADEOFFS.map((item) => (
                <div key={item.title} className="grid gap-1.5 border-l-2 border-warn pl-5">
                  <dt className="font-semibold">{item.title}</dt>
                  <dd className="max-w-prose text-sm text-muted">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="tested" className="container-page grid gap-5 py-16">
          <h2 id="tested" className="text-2xl font-semibold sm:text-3xl">
            How it is tested
          </h2>
          <ul className="grid max-w-prose gap-3 text-muted">
            <li>Unit tests cover the constructor, the full lifecycle, role enforcement, timing edges, cancel and replay, input validation, membership changes and spending limits.</li>
            <li>Authorisation tests run with only the executor&apos;s signature, proving contract calls succeed through invoker authorisation, and with no signatures, proving they fail.</li>
            <li>Property tests check the spending-window arithmetic and the threshold invariants against randomised inputs.</li>
            <li>A script runs the real lifecycle against Stellar testnet and asserts balances.</li>
          </ul>
          <p className="max-w-prose text-muted">
            Tests show the presence of care, not the absence of bugs. Read the{" "}
            <a href={`${REPO_URL}/blob/main/SPEC.md`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              specification
            </a>{" "}
            and the{" "}
            <a href={`${REPO_URL}/tree/main/contracts/treasury`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              contract source
            </a>
            , and report anything you find through the repository&apos;s security policy.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
