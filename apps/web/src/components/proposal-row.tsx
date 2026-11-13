"use client";

import Link from "next/link";
import { describeAction } from "@/lib/actions";
import { formatRelative } from "@/lib/format";
import type { TokenInfo } from "@/lib/network";
import { ProposalState, type Proposal } from "@/lib/treasury";
import { Countdown } from "./countdown";
import { Seals } from "./seals";
import { StateBadge } from "./state-badge";

/** What is the clock counting towards, for a proposal in this state? */
export function deadlineOf(proposal: Proposal, state: ProposalState, executionWindow: bigint) {
  if (state === ProposalState.Pending) return { label: "Voting closes in", at: Number(proposal.voting_ends_at) };
  if (state === ProposalState.Queued && proposal.eta !== undefined) return { label: "Executable in", at: Number(proposal.eta) };
  if (state === ProposalState.Ready && proposal.eta !== undefined) {
    return { label: "Expires in", at: Number(proposal.eta + executionWindow) };
  }
  return null;
}

export function proposalTitle(proposal: Proposal, tokens: TokenInfo[]): string {
  if (proposal.memo.trim()) return proposal.memo;
  const first = proposal.actions[0];
  if (!first) return "Empty proposal";
  const extra = proposal.actions.length - 1;
  return `${describeAction(first, tokens).title}${extra > 0 ? ` and ${extra} more` : ""}`;
}

export function ProposalRow({
  treasuryId,
  proposal,
  state,
  threshold,
  approverCount,
  executionWindow,
  tokens,
  now,
}: {
  treasuryId: string;
  proposal: Proposal;
  state: ProposalState;
  threshold: number;
  approverCount: number;
  executionWindow: bigint;
  tokens: TokenInfo[];
  now: number;
}) {
  const deadline = deadlineOf(proposal, state, executionWindow);
  const count = proposal.actions.length;
  return (
    <li>
      <Link
        href={`/t/${treasuryId}/proposals/${proposal.id}`}
        className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-raised/60 sm:grid-cols-[auto_1fr_auto_auto]"
        data-testid={`proposal-row-${proposal.id}`}
      >
        <span className="font-mono text-sm tabular text-muted">#{proposal.id.toString()}</span>
        <div className="grid min-w-0 gap-0.5">
          <p className="truncate font-medium">{proposalTitle(proposal, tokens)}</p>
          <p className="truncate text-sm text-muted">
            {count} action{count === 1 ? "" : "s"}, created {formatRelative(proposal.created_at)}
          </p>
        </div>
        <div className="col-start-2 flex items-center gap-2 sm:col-start-auto">
          <Seals total={approverCount} threshold={threshold} approvals={proposal.approvals} rejections={proposal.rejections} size="sm" />
          <span className="font-mono text-xs tabular text-muted">
            {proposal.approvals}/{threshold}
          </span>
        </div>
        <div className="col-start-2 flex items-center gap-3 sm:col-start-auto sm:w-44 sm:justify-end">
          {deadline && (
            <span className="text-xs text-muted">
              <span className="sr-only">{deadline.label} </span>
              <Countdown to={deadline.at} now={now} />
            </span>
          )}
          <StateBadge state={state} />
        </div>
      </Link>
    </li>
  );
}
