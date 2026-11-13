"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Client } from "@steward/treasury-client";
import { AddressPill } from "@/components/address";
import { Seals } from "@/components/seals";
import { SiteHeader } from "@/components/site-chrome";
import { useTx } from "@/components/tx-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Notice, Panel } from "@/components/ui/misc";
import { Slider } from "@/components/ui/slider";
import { isAddress } from "@/lib/actions";
import { formatDuration, truncateAddress } from "@/lib/format";
import { demo, network } from "@/lib/network";
import { saveTreasury } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";
import {
  MAX_APPROVERS,
  TIMING_PRESETS,
  buildConstructorArgs,
  validateWizard,
  type Timing,
  type WizardMember,
} from "@/lib/wizard";

const STEPS = ["Signers", "Roles", "Threshold", "Timing", "Review"] as const;
type Step = (typeof STEPS)[number];

const ROLE_COLUMNS = [
  { key: "proposer", label: "Proposer", hint: "Drafts proposals" },
  { key: "approver", label: "Approver", hint: "Votes on proposals" },
  { key: "executor", label: "Executor", hint: "Runs approved proposals" },
] as const;

const TIMING_FIELDS: { key: keyof Timing; label: string; hint: string }[] = [
  { key: "timelock", label: "Timelock", hint: "Wait between approval and execution. Zero is allowed." },
  { key: "voting", label: "Voting period", hint: "How long a proposal accepts votes." },
  { key: "window", label: "Execution window", hint: "How long an approved proposal stays executable." },
];

export default function CreateTreasuryPage() {
  const { address, connect, connecting } = useWallet();
  const { run } = useTx();
  const router = useRouter();

  const [step, setStep] = useState<Step>("Signers");
  const [name, setName] = useState("");
  const [members, setMembers] = useState<WizardMember[]>([]);
  const [draft, setDraft] = useState({ address: "", label: "" });
  const [draftError, setDraftError] = useState<string>();
  const [threshold, setThreshold] = useState(1);
  const [preset, setPreset] = useState<string>("standard");
  const [timing, setTiming] = useState<Timing>(TIMING_PRESETS[1]!.timing);

  // The connected wallet starts as the first member, with every role.
  const roster = useMemo<WizardMember[]>(() => {
    if (!address || members.some((m) => m.address === address)) return members;
    return [{ address, label: "You", proposer: true, approver: true, executor: true }, ...members];
  }, [address, members]);

  const approverCount = roster.filter((m) => m.approver).length;
  const clampedThreshold = Math.min(Math.max(threshold, 1), Math.max(approverCount, 1));
  const issues = validateWizard({ members: roster, threshold: clampedThreshold, timing });
  const stepIndex = STEPS.indexOf(step);

  const stepIssues: Record<Step, string[]> = {
    Signers: issues.filter((i) => i.step === "Signers").map((i) => i.message),
    Roles: issues.filter((i) => i.step === "Roles").map((i) => i.message),
    Threshold: issues.filter((i) => i.step === "Threshold").map((i) => i.message),
    Timing: issues.filter((i) => i.step === "Timing").map((i) => i.message),
    Review: [],
  };
  const canAdvance = stepIssues[step].length === 0;

  function update(addr: string, patch: Partial<WizardMember>) {
    const exists = members.some((m) => m.address === addr);
    if (exists) setMembers(members.map((m) => (m.address === addr ? { ...m, ...patch } : m)));
    else {
      const base = roster.find((m) => m.address === addr);
      if (base) setMembers([{ ...base, ...patch }, ...members]);
    }
  }

  function remove(addr: string) {
    const base = roster.find((m) => m.address === addr);
    if (addr === address && base) {
      // Keep the wallet out of the roster explicitly: store it with no roles, then drop it.
      setMembers([...members.filter((m) => m.address !== addr), { ...base, proposer: false, approver: false, executor: false, removed: true }]);
      return;
    }
    setMembers(members.filter((m) => m.address !== addr));
  }

  function addMember() {
    const value = draft.address.trim();
    if (!isAddress(value)) return setDraftError("Enter a Stellar address: G… for an account or C… for a contract.");
    if (roster.some((m) => m.address === value && !m.removed)) return setDraftError("This address is already a member.");
    setMembers([
      ...members.filter((m) => m.address !== value),
      { address: value, label: draft.label.trim(), proposer: false, approver: true, executor: false },
    ]);
    setDraft({ address: "", label: "" });
    setDraftError(undefined);
  }

  const visible = roster.filter((m) => !m.removed);

  function deploy() {
    const args = buildConstructorArgs({ members: roster, threshold: clampedThreshold, timing });
    run<Client>({
      title: "Deploy treasury",
      confirmLabel: "Deploy",
      successLabel: "Treasury deployed",
      summary: (
        <p className="text-muted">
          Creates a new Steward contract on {network.name} from the published wasm{" "}
          <span className="font-mono text-foreground">{truncateAddress(demo.wasmHash, 6, 6)}</span>, with{" "}
          {args.approvers.length} approvers and a threshold of {clampedThreshold}. After this, only its own proposals
          can change it.
        </p>
      ),
      build: (signer) =>
        Client.deploy(args, {
          wasmHash: demo.wasmHash,
          format: "hex",
          networkPassphrase: network.passphrase,
          rpcUrl: network.rpcUrl,
          publicKey: signer.publicKey,
          signTransaction: signer.signTransaction,
        }),
      onSuccess: ({ result }) => {
        const contractId = (result as Client | undefined)?.options.contractId;
        if (!contractId) return;
        saveTreasury(contractId, name || "Treasury");
        router.push(`/t/${contractId}`);
      },
    });
  }

  return (
    <div className="min-h-dvh bg-raised">
      <SiteHeader />
      <main id="main" className="container-page grid gap-8 py-10 lg:grid-cols-[15rem_minmax(0,1fr)_22rem] lg:gap-10 lg:py-14">
        <nav aria-label="Steps" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-4 text-sm text-muted">New treasury</p>
          <ol className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:grid lg:gap-1">
            {STEPS.map((name, index) => {
              const done = index < stepIndex;
              const current = name === step;
              const reachable = index <= stepIndex || STEPS.slice(0, index).every((s) => stepIssues[s].length === 0);
              return (
                <li key={name} className="shrink-0">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => setStep(name)}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm disabled:opacity-40",
                      current ? "bg-background font-medium shadow-[0_0_0_1px_var(--border)]" : "text-muted hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full border text-xs tabular",
                        done ? "border-accent bg-accent text-on-accent" : current ? "border-accent text-accent" : "border-border-strong",
                      )}
                    >
                      {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                    </span>
                    {name}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <Panel as="section" aria-labelledby="step-title" className="grid content-start">
          <header className="grid gap-1 border-b border-border px-6 py-5">
            <p className="text-sm text-muted">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            <h1 id="step-title" className="text-xl font-semibold tracking-tight">
              {
                {
                  Signers: "Who is in the treasury?",
                  Roles: "What can each member do?",
                  Threshold: "How many approvals does a proposal need?",
                  Timing: "How long does each stage last?",
                  Review: "Review and deploy",
                }[step]
              }
            </h1>
          </header>

          <div className="grid gap-6 px-6 py-6">
            {!address && (
              <Notice tone="accent" title="Connect a wallet to deploy">
                You can fill in the form first. Your wallet pays the deploy fee and becomes the first member.{" "}
                <Button variant="link" onClick={() => connect()} disabled={connecting}>
                  Connect wallet
                </Button>
              </Notice>
            )}

            {step === "Signers" && (
              <>
                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addMember();
                  }}
                >
                  <Field label="Address" htmlFor="member-address" error={draftError}>
                    <Input
                      id="member-address"
                      value={draft.address}
                      onChange={(e) => {
                        setDraft({ ...draft, address: e.target.value });
                        setDraftError(undefined);
                      }}
                      placeholder="G… or C…"
                      className="font-mono"
                      spellCheck={false}
                      aria-invalid={!!draftError}
                    />
                  </Field>
                  <Field label="Label (optional)" htmlFor="member-label">
                    <Input id="member-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Alice" />
                  </Field>
                  <Button type="submit" variant="secondary" className={cn(draftError && "sm:mb-7")}>
                    <Plus /> Add
                  </Button>
                </form>

                <ul className="divide-y divide-border rounded-lg border border-border" data-testid="wizard-members">
                  {visible.length === 0 && <li className="px-4 py-6 text-sm text-muted">No members yet. Add at least one address.</li>}
                  {visible.map((member) => (
                    <li key={member.address} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="grid gap-0.5">
                        <span className="text-sm font-medium">{member.label || "Member"}</span>
                        <AddressPill address={member.address} />
                      </span>
                      <Button variant="ghost" size="icon" aria-label={`Remove ${member.label || member.address}`} onClick={() => remove(member.address)}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted">Up to {MAX_APPROVERS} approvers. Proposers and executors have no cap.</p>
              </>
            )}

            {step === "Roles" && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="px-4 py-3 font-medium">Member</th>
                      {ROLE_COLUMNS.map((role) => (
                        <th key={role.key} scope="col" className="px-4 py-3 text-center font-medium">
                          <span className="grid">
                            {role.label}
                            <span className="text-xs font-normal text-muted">{role.hint}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visible.map((member) => (
                      <tr key={member.address}>
                        <th scope="row" className="px-4 py-3 text-left font-normal">
                          <span className="grid gap-0.5">
                            <span className="font-medium">{member.label || "Member"}</span>
                            <span className="font-mono text-xs text-muted">{truncateAddress(member.address)}</span>
                          </span>
                        </th>
                        {ROLE_COLUMNS.map((role) => (
                          <td key={role.key} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--accent)]"
                              aria-label={`${member.label || truncateAddress(member.address)} is ${role.label.toLowerCase()}`}
                              checked={member[role.key]}
                              onChange={(e) => update(member.address, { [role.key]: e.target.checked })}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {step === "Threshold" && (
              <div className="grid gap-8">
                <div className="grid justify-items-start gap-4">
                  <p className="text-4xl font-semibold tracking-tight tabular" data-testid="threshold-label">
                    {clampedThreshold} <span className="text-muted">of {approverCount}</span>
                  </p>
                  <Seals total={approverCount} threshold={clampedThreshold} approvals={clampedThreshold} size="lg" />
                </div>
                <Slider
                  aria-label="Approval threshold"
                  min={1}
                  max={Math.max(approverCount, 1)}
                  step={1}
                  value={[clampedThreshold]}
                  onValueChange={([value]) => setThreshold(value ?? 1)}
                  disabled={approverCount <= 1}
                />
                <p className="text-sm text-muted">
                  {clampedThreshold === 1
                    ? "Any single approver can queue a proposal. Fine for testing, weak for real funds."
                    : clampedThreshold === approverCount
                      ? "Every approver must agree. One lost key stops the treasury until a proposal replaces it, and that proposal also needs every approver."
                      : `Any ${clampedThreshold} approvers can queue a proposal; ${approverCount - clampedThreshold + 1} rejections are enough to stop one.`}
                </p>
              </div>
            )}

            {step === "Timing" && (
              <div className="grid gap-6">
                <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Timing preset">
                  {[...TIMING_PRESETS, { id: "custom", label: "Custom", note: "Set each value", timing }].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={preset === option.id}
                      onClick={() => {
                        setPreset(option.id);
                        if (option.id !== "custom") setTiming(option.timing);
                      }}
                      className={cn(
                        "grid gap-0.5 rounded-lg border px-4 py-3 text-left",
                        preset === option.id ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
                      )}
                    >
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-muted">{option.note}</span>
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {TIMING_FIELDS.map((field) => (
                    <Field key={field.key} label={`${field.label} (hours)`} htmlFor={`timing-${field.key}`} hint={field.hint}>
                      <Input
                        id={`timing-${field.key}`}
                        type="number"
                        min={0}
                        step="0.25"
                        inputMode="decimal"
                        className="tabular"
                        value={String(timing[field.key] / 3600)}
                        onChange={(e) => {
                          setPreset("custom");
                          const hours = Number(e.target.value);
                          setTiming({ ...timing, [field.key]: Number.isFinite(hours) ? Math.max(0, Math.round(hours * 3600)) : 0 });
                        }}
                      />
                    </Field>
                  ))}
                </div>
              </div>
            )}

            {step === "Review" && (
              <div className="grid gap-6">
                <Field label="Name" htmlFor="treasury-name" hint="Stored in this browser only. The contract has no name.">
                  <Input id="treasury-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Orbit Collective" />
                </Field>
                <Notice tone="warn" title="Unaudited software on testnet">
                  Steward has not been audited. Deploy to testnet to try it; do not hold real funds in it.
                </Notice>
              </div>
            )}

            {stepIssues[step].length > 0 && (
              <ul className="grid gap-1 text-sm text-muted" role="status">
                {stepIssues[step].map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
            {stepIndex > 0 ? (
              <Button variant="ghost" onClick={() => setStep(STEPS[stepIndex - 1] ?? "Signers")}>
                Back
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link href="/treasuries">Cancel</Link>
              </Button>
            )}
            {step === "Review" ? (
              address ? (
                <Button onClick={deploy} disabled={issues.length > 0} data-testid="deploy-treasury">
                  Deploy treasury
                </Button>
              ) : (
                <Button onClick={() => connect()} loading={connecting}>
                  Connect wallet to deploy
                </Button>
              )
            ) : (
              <Button onClick={() => setStep(STEPS[stepIndex + 1] ?? "Review")} disabled={!canAdvance}>
                Continue
              </Button>
            )}
          </footer>
        </Panel>

        <aside aria-label="Summary" className="lg:sticky lg:top-24 lg:self-start">
          <Panel className="grid gap-5 p-5">
            <p className="text-sm font-medium">Summary</p>
            <dl className="grid gap-3 text-sm">
              {ROLE_COLUMNS.map((role) => (
                <div key={role.key} className="flex justify-between gap-3">
                  <dt className="text-muted">{role.label}s</dt>
                  <dd className="tabular">{visible.filter((m) => m[role.key]).length}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="text-muted">Threshold</dt>
                <dd className="tabular">
                  {clampedThreshold} of {approverCount}
                </dd>
              </div>
              {TIMING_FIELDS.map((field) => (
                <div key={field.key} className="flex justify-between gap-3">
                  <dt className="text-muted">{field.label}</dt>
                  <dd className="tabular">{formatDuration(timing[field.key])}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt className="text-muted">Network</dt>
                <dd className="capitalize">{network.name}</dd>
              </div>
            </dl>
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-ok">
                <Check className="size-4" /> Ready to deploy
              </p>
            ) : (
              <p className="text-sm text-muted">
                {issues.length} thing{issues.length === 1 ? "" : "s"} left to fix
              </p>
            )}
          </Panel>
        </aside>
      </main>
    </div>
  );
}
