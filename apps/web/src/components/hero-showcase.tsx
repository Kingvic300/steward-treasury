import { ArrowUpRight, Check, Clock3, FileCode2, Send, ShieldCheck, Wallet, X } from "lucide-react";
import { Seals } from "./seals";
import { Badge } from "./ui/misc";

/**
 * Static composition of real Steward surfaces for the landing hero: a proposal
 * card, the approval dialog a signer sees on top of it, and the toast that
 * follows a signature. Nothing here moves; it is a still of the product.
 */
export function HeroShowcase() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[40rem] select-none pb-10 sm:pb-16 lg:mx-0">
      {/* Proposal card, back layer */}
      <div className="rounded-xl border border-border-strong bg-background shadow-[0_1px_2px_rgb(16_22_42/0.04),0_12px_32px_-12px_rgb(16_22_42/0.12)]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <span className="flex items-center gap-2 text-sm text-muted">
            <span className="font-mono tabular">#42</span>
            <span className="text-border-strong">/</span>
            Orbit Collective
          </span>
          <Badge tone="wait">Voting</Badge>
        </div>
        <div className="grid gap-5 px-5 py-5">
          <div className="grid gap-1">
            <span className="text-lg font-semibold tracking-tight">March contributor payouts</span>
            <span className="text-sm text-muted">Proposed by GAGR…MGM6, 2 hours ago</span>
          </div>
          <ol className="grid gap-2 text-sm">
            <li className="flex items-center gap-3 rounded-md bg-raised px-3 py-2.5">
              <Send className="size-4 text-accent" />
              <span className="flex-1">Transfer to design guild</span>
              <span className="font-mono tabular">12,500.00 USDC</span>
            </li>
            <li className="flex items-center gap-3 rounded-md bg-raised px-3 py-2.5">
              <FileCode2 className="size-4 text-accent" />
              <span className="flex-1">Invoke blend_pool.supply</span>
              <span className="font-mono tabular">50,000.00 USDC</span>
            </li>
          </ol>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="flex items-center gap-3">
              <Seals total={3} threshold={2} approvals={1} />
              <span className="font-mono text-xs tabular text-muted">1 of 2</span>
            </span>
            <span className="flex items-center gap-1.5 font-mono text-xs tabular text-muted">
              <Clock3 className="size-3.5" /> voting ends in 6d 04h
            </span>
          </div>
        </div>
      </div>

      {/* Approval dialog, front layer */}
      <div className="relative -mt-5 ml-auto w-[88%] rounded-xl border border-border-strong bg-background shadow-[0_2px_4px_rgb(16_22_42/0.05),0_24px_48px_-16px_rgb(16_22_42/0.22)] sm:-mt-6 sm:w-[78%]">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="grid gap-1">
            <span className="text-base font-semibold">Approve proposal #42?</span>
            <span className="text-sm text-muted">Your approval reaches the threshold.</span>
          </div>
          <span className="grid size-7 place-items-center rounded-md text-muted">
            <X className="size-4" />
          </span>
        </div>
        <dl className="mx-5 mt-4 grid gap-2 rounded-lg border border-border px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">After approval</dt>
            <dd className="font-medium">Queued, 24h timelock</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Simulated fee</dt>
            <dd className="font-mono tabular">0.0213 XLM</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Signing as</dt>
            <dd className="flex items-center gap-1.5 font-mono tabular">
              <Wallet className="size-3.5 text-muted" /> GATI…JL5U
            </dd>
          </div>
        </dl>
        <div className="flex justify-end gap-2 px-5 py-4">
          <span className="inline-flex h-9 items-center rounded-md border border-border-strong px-3.5 text-sm font-medium">Reject</span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-on-accent">
            <Check className="size-4" /> Approve and sign
          </span>
        </div>
      </div>

      {/* Toast */}
      <div className="absolute bottom-0 left-0 flex w-[19rem] max-w-[85%] items-start gap-3 rounded-lg border border-border-strong bg-background px-4 py-3 shadow-[0_12px_28px_-10px_rgb(16_22_42/0.25)] sm:-left-6">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
        <span className="grid gap-0.5 text-sm">
          <span className="font-medium">Approval recorded</span>
          <span className="flex items-center gap-1 font-mono text-xs text-muted">
            tx 9f3a…c41e <ArrowUpRight className="size-3" />
          </span>
        </span>
      </div>
    </div>
  );
}

const WIZARD_STEPS = ["Signers", "Roles", "Threshold", "Timing", "Review"];

/** Still of the create wizard at its threshold step, for the closing call to action. */
export function WizardPreview() {
  return (
    <div aria-hidden className="relative hidden select-none border-l border-border bg-raised p-8 lg:block">
      <div className="rounded-xl border border-border-strong bg-background shadow-[0_2px_4px_rgb(16_22_42/0.05),0_24px_48px_-16px_rgb(16_22_42/0.18)]">
        <div className="flex gap-1.5 border-b border-border px-5 py-3.5">
          {WIZARD_STEPS.map((step, index) => (
            <span
              key={step}
              className={
                index < 2
                  ? "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted"
                  : index === 2
                    ? "flex items-center gap-1.5 rounded-md bg-raised px-2 py-1 text-xs font-medium"
                    : "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted/60"
              }
            >
              <span
                className={
                  index < 2
                    ? "grid size-4 place-items-center rounded-full bg-accent text-on-accent"
                    : index === 2
                      ? "grid size-4 place-items-center rounded-full border border-accent text-[10px] text-accent"
                      : "grid size-4 place-items-center rounded-full border border-border-strong text-[10px]"
                }
              >
                {index < 2 ? <Check className="size-2.5" strokeWidth={3} /> : index + 1}
              </span>
              {step}
            </span>
          ))}
        </div>
        <div className="grid gap-6 px-6 py-6">
          <span className="text-base font-semibold">How many approvals does a proposal need?</span>
          <div className="grid gap-3">
            <span className="text-3xl font-semibold tracking-tight tabular">
              2 <span className="text-muted">of 3</span>
            </span>
            <Seals total={3} threshold={2} approvals={2} size="md" />
          </div>
          <div className="relative h-1.5 rounded-full bg-raised">
            <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-accent" />
            <div className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-background" />
          </div>
          <span className="text-sm text-muted">Any 2 approvers can queue a proposal; 2 rejections stop one.</span>
        </div>
        <div className="flex justify-between border-t border-border px-6 py-4">
          <span className="inline-flex h-9 items-center px-2 text-sm text-muted">Back</span>
          <span className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent">Continue</span>
        </div>
      </div>
    </div>
  );
}
