"use client";

import Link from "next/link";
import { use } from "react";
import { Check, X } from "lucide-react";
import { ActionList } from "@/components/action-list";
import { AddressPill, TxLink } from "@/components/address";
import { Countdown, useNow } from "@/components/countdown";
import { deadlineOf, proposalTitle } from "@/components/proposal-row";
import { Seals } from "@/components/seals";
import { STATE_META, StateBadge } from "@/components/state-badge";
import { useTx } from "@/components/tx-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Panel, PanelHeader, Skeleton } from "@/components/ui/misc";
import { eventProposalId, useActivity } from "@/lib/events";
import { formatDuration, formatTimestamp } from "@/lib/format";
import { rememberTx } from "@/lib/storage";
import { ProposalState, ProposalStatus, deriveState, rolesOf, treasuryClient, useOverview, useProposal } from "@/lib/treasury";
import { useTokens, useTxHashes } from "@/lib/use-tokens";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/wallet";

interface Step {
  label: string;
  at?: bigint;
  done: boolean;
  current?: boolean;
  note?: string;
}

export default function ProposalPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = use(params);
  const now = useNow();
  const tokens = useTokens(id);
  const overview = useOverview(id);
  const query = useProposal(id, pid);
  const activity = useActivity(id);
  const hashes = useTxHashes(id);
  const { address } = useWallet();
  const tx = useTx();

  const back = (
    <Link href={`/t/${id}/proposals`} className="text-sm text-muted hover:text-foreground">
      All proposals
    </Link>
  );

  if (query.isLoading || overview.isLoading) {
    return (
      <div className="grid gap-6">
        {back}
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  const proposal = query.data;
  const data = overview.data;
  if (!proposal || !data) {
    return (
      <div className="grid gap-6">
        {back}
        <EmptyState title={`Proposal #${pid} does not exist`}>
          Check the number, or go back to the list of proposals for this treasury.
        </EmptyState>
      </div>
    );
  }

  const state = deriveState(proposal, data.config, data.configVersion, now);
  const roles = rolesOf(data.members, address);
  const myVote = proposal.votes.find((vote) => vote.voter === address);
  const deadline = deadlineOf(proposal, state, data.config.execution_window);
  const threshold = data.config.threshold;
  const number = proposal.id.toString();
  const events = (activity.data ?? []).filter((item) => eventProposalId(item) === number);
  const hashFor = (type: string, who?: string) =>
    events.find((item) => item.type === type && (!who || item.topics[1] === who))?.txHash ??
    hashes[who ? `${type}:${number}:${who}` : `${type}:${number}`];

  const canVote = state === ProposalState.Pending && roles.approver && !myVote;
  const canExecute = state === ProposalState.Ready && roles.executor;
  const canCancel =
    proposal.proposer === address && (proposal.status === ProposalStatus.Pending || proposal.status === ProposalStatus.Queued);

  const act = (kind: "approve" | "reject" | "execute" | "cancel") => {
    const copy = {
      approve: { title: `Approve proposal #${number}`, confirm: "Approve", done: "Approved", note: `Your approval is recorded on chain. ${proposal.approvals + 1 >= threshold ? "It reaches the threshold, so the timelock starts." : `${threshold - proposal.approvals - 1} more needed after yours.`}` },
      reject: { title: `Reject proposal #${number}`, confirm: "Reject", done: "Rejected", note: "Your rejection is final: you cannot change sides later." },
      execute: { title: `Execute proposal #${number}`, confirm: "Execute", done: "Executed", note: "Every action below runs now, in order. If one fails, all revert." },
      cancel: { title: `Cancel proposal #${number}`, confirm: "Cancel proposal", done: "Cancelled", note: "A cancelled proposal cannot be reopened." },
    }[kind];
    tx.run({
      title: copy.title,
      confirmLabel: copy.confirm,
      successLabel: copy.done,
      treasuryId: id,
      summary: (
        <>
          <p className="text-muted">{copy.note}</p>
          {kind === "execute" && <ActionList actions={proposal.actions} tokens={tokens} />}
        </>
      ),
      build: (signer) => {
        const client = treasuryClient(id, signer);
        const who = signer.publicKey;
        if (kind === "approve") return client.approve({ approver: who, id: proposal.id });
        if (kind === "reject") return client.reject({ approver: who, id: proposal.id });
        if (kind === "execute") return client.execute({ executor: who, id: proposal.id });
        return client.cancel({ proposer: who, id: proposal.id });
      },
      onSuccess: ({ hash }) => {
        const event = { approve: "voted", reject: "voted", execute: "proposal_executed", cancel: "proposal_cancelled" }[kind];
        rememberTx(id, kind === "approve" || kind === "reject" ? `${event}:${number}:${address}` : `${event}:${number}`, hash);
      },
    });
  };

  const queued = proposal.queued_at !== undefined;
  const steps: Step[] = [
    { label: "Created", at: proposal.created_at, done: true },
    {
      label: `Approvals (${proposal.approvals} of ${threshold})`,
      done: queued,
      current: state === ProposalState.Pending,
      note: state === ProposalState.Pending ? `Voting closes ${formatTimestamp(proposal.voting_ends_at)}` : undefined,
    },
    { label: "Queued", at: proposal.queued_at, done: queued, note: queued ? `Timelock of ${formatDuration(data.config.timelock_delay)}` : undefined },
    {
      label: "Ready",
      at: queued && proposal.eta !== undefined && now >= Number(proposal.eta) ? proposal.eta : undefined,
      done: queued && proposal.eta !== undefined && now >= Number(proposal.eta) && proposal.status !== ProposalStatus.Cancelled,
      current: state === ProposalState.Queued,
      note: state === ProposalState.Queued && proposal.eta !== undefined ? `Executable from ${formatTimestamp(proposal.eta)}` : undefined,
    },
    {
      label: proposal.status === ProposalStatus.Cancelled ? "Cancelled" : proposal.status === ProposalStatus.Rejected ? "Rejected" : "Executed",
      at: proposal.closed_at,
      done: proposal.closed_at !== undefined,
      current: state === ProposalState.Ready,
    },
  ];

  return (
    <div className="grid gap-8">
      {back}
      <header className="grid gap-5 border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm tabular text-muted">#{number}</span>
          <span data-testid="proposal-state"><StateBadge state={state} /></span>
          {deadline && (
            <span className="text-sm text-muted">
              {deadline.label} <Countdown to={deadline.at} now={now} className="text-foreground" />
            </span>
          )}
        </div>
        <h1 className="max-w-[30ch] text-2xl font-semibold tracking-tight lg:text-3xl">{proposalTitle(proposal, tokens)}</h1>
        <p className="text-sm text-muted">{STATE_META[state].meaning}.</p>

        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Seals total={data.members.approvers.length} threshold={threshold} approvals={proposal.approvals} rejections={proposal.rejections} size="lg" />
            <p className="text-sm text-muted">
              <span className="font-mono text-lg tabular text-foreground" data-testid="approval-count">
                {proposal.approvals} of {threshold}
              </span>{" "}
              approvals{proposal.rejections > 0 && `, ${proposal.rejections} rejected`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canVote && (
              <>
                <Button variant="secondary" onClick={() => act("reject")} data-testid="reject">
                  <X aria-hidden /> Reject
                </Button>
                <Button onClick={() => act("approve")} data-testid="approve">
                  <Check aria-hidden /> Approve
                </Button>
              </>
            )}
            {canExecute && <Button onClick={() => act("execute")} data-testid="execute">Execute</Button>}
            {canCancel && <Button variant="danger" onClick={() => act("cancel")} data-testid="cancel">Cancel proposal</Button>}
          </div>
        </div>

        {myVote && state === ProposalState.Pending && (
          <Notice tone="idle">You {myVote.approve ? "approved" : "rejected"} this proposal on {formatTimestamp(myVote.timestamp)}.</Notice>
        )}
        {state === ProposalState.Ready && !roles.executor && <Notice tone="idle">This proposal is ready. Any executor can run it.</Notice>}
        {state === ProposalState.Stale && (
          <Notice tone="warn">The treasury&apos;s members or rules changed after this proposal was created, so it can no longer be voted on or run. Create it again if it is still wanted.</Notice>
        )}
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_24rem] xl:items-start">
        <div className="grid gap-8">
          <section aria-labelledby="actions" className="grid gap-3">
            <h2 id="actions" className="text-base font-semibold">
              {proposal.actions.length} action{proposal.actions.length === 1 ? "" : "s"}, run in this order
            </h2>
            <ActionList actions={proposal.actions} tokens={tokens} />
          </section>

          <Panel as="section">
            <PanelHeader title="Votes" description={`${data.members.approvers.length} approvers, ${threshold} needed`} />
            {proposal.votes.length === 0 ? (
              <EmptyState title="No votes yet" />
            ) : (
              <ul className="divide-y divide-border">
                {proposal.votes.map((vote) => {
                  const hash = hashFor("voted", vote.voter);
                  return (
                    <li key={vote.voter} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <span className="flex items-center gap-3">
                        <span className={cn("grid size-6 place-items-center rounded-full", vote.approve ? "bg-accent text-on-accent" : "bg-danger-soft text-danger")}>
                          {vote.approve ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : <X className="size-3.5" strokeWidth={3} aria-hidden />}
                        </span>
                        <AddressPill address={vote.voter} you={vote.voter === address} />
                        <span className="text-sm text-muted">{vote.approve ? "approved" : "rejected"}</span>
                      </span>
                      <span className="flex items-center gap-3 text-sm text-muted">
                        {formatTimestamp(vote.timestamp)}
                        {hash && <TxLink hash={hash} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid gap-8">
          <Panel as="section">
            <PanelHeader title="Timeline" />
            <ol className="grid gap-0 p-5">
              {steps.map((step, index) => (
                <li key={step.label} className="grid grid-cols-[1.25rem_1fr] gap-x-4">
                  <span className="flex flex-col items-center">
                    <span className={cn("mt-1 size-3 rounded-full border-2", step.done ? "border-accent bg-accent" : step.current ? "border-accent bg-background" : "border-border-strong bg-background")} />
                    {index < steps.length - 1 && <span className={cn("w-px flex-1", step.done ? "bg-accent" : "bg-border-strong")} />}
                  </span>
                  <div className="grid gap-0.5 pb-6">
                    <p className={cn("font-medium", !step.done && !step.current && "text-muted")}>{step.label}</p>
                    {step.at !== undefined && <p className="text-sm text-muted">{formatTimestamp(step.at)}</p>}
                    {step.note && <p className="text-sm text-muted">{step.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel as="section">
            <PanelHeader title="Details" />
            <dl className="grid gap-3 p-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <dt className="text-muted">Proposer</dt>
                <dd><AddressPill address={proposal.proposer} you={proposal.proposer === address} /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Settings version</dt>
                <dd className="font-mono tabular">{proposal.config_version}{proposal.config_version !== data.configVersion && ` (now ${data.configVersion})`}</dd>
              </div>
              {(
                [
                  ["Created in", hashFor("proposal_created") ?? hashes[`propose:${number}`]],
                  ["Executed in", hashFor("proposal_executed")],
                  ["Cancelled in", hashFor("proposal_cancelled")],
                ] as const
              ).map(([label, hash]) => hash && (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-muted">{label}</dt>
                  <dd><TxLink hash={hash} /></dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
