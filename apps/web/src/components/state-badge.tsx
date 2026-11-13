import { ProposalState } from "@/lib/treasury";
import { Badge, type Tone } from "./ui/misc";

export const STATE_META: Record<ProposalState, { label: string; tone: Tone; meaning: string }> = {
  [ProposalState.Pending]: { label: "Voting", tone: "wait", meaning: "Open for approvals" },
  [ProposalState.Queued]: { label: "Timelock", tone: "warn", meaning: "Approved; waiting for the timelock" },
  [ProposalState.Ready]: { label: "Ready", tone: "accent", meaning: "Can be executed now" },
  [ProposalState.Executed]: { label: "Executed", tone: "ok", meaning: "All actions ran" },
  [ProposalState.Cancelled]: { label: "Cancelled", tone: "idle", meaning: "Cancelled by its proposer" },
  [ProposalState.Rejected]: { label: "Rejected", tone: "danger", meaning: "The threshold can no longer be reached" },
  [ProposalState.Expired]: { label: "Expired", tone: "idle", meaning: "Its time window ran out" },
  [ProposalState.Stale]: { label: "Stale", tone: "idle", meaning: "Treasury settings changed after it was created" },
};

export function StateBadge({ state }: { state: ProposalState }) {
  const meta = STATE_META[state];
  return (
    <Badge tone={meta.tone} title={meta.meaning}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {meta.label}
    </Badge>
  );
}
