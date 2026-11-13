/**
 * Create-treasury wizard rules. They mirror the contract constructor's checks
 * so the form refuses what the contract would refuse, before any simulation.
 */
import type { Config } from "@steward/treasury-client";

export const MAX_APPROVERS = 20;

export interface WizardMember {
  address: string;
  label: string;
  proposer: boolean;
  approver: boolean;
  executor: boolean;
  /** The connected wallet, taken out of the roster by the person. */
  removed?: boolean;
}

/** All values in seconds. */
export interface Timing {
  timelock: number;
  voting: number;
  window: number;
}

const HOUR = 3600;
const DAY = 24 * HOUR;

export const TIMING_PRESETS: { id: string; label: string; note: string; timing: Timing }[] = [
  { id: "fast", label: "Testing", note: "5 min lock, 1 day vote", timing: { timelock: 5 * 60, voting: DAY, window: DAY } },
  { id: "standard", label: "Standard", note: "1 day lock, 7 day vote", timing: { timelock: DAY, voting: 7 * DAY, window: 3 * DAY } },
  { id: "cautious", label: "Cautious", note: "3 day lock, 14 day vote", timing: { timelock: 3 * DAY, voting: 14 * DAY, window: 7 * DAY } },
];

export interface WizardIssue {
  step: "Signers" | "Roles" | "Threshold" | "Timing";
  message: string;
}

export function validateWizard({
  members,
  threshold,
  timing,
}: {
  members: WizardMember[];
  threshold: number;
  timing: Timing;
}): WizardIssue[] {
  const active = members.filter((m) => !m.removed);
  const issues: WizardIssue[] = [];
  const approvers = active.filter((m) => m.approver).length;

  if (active.length === 0) issues.push({ step: "Signers", message: "Add at least one member." });
  if (new Set(active.map((m) => m.address)).size !== active.length)
    issues.push({ step: "Signers", message: "Each address can appear only once." });

  if (active.length > 0) {
    if (approvers === 0) issues.push({ step: "Roles", message: "At least one member must be an approver." });
    if (approvers > MAX_APPROVERS) issues.push({ step: "Roles", message: `At most ${MAX_APPROVERS} approvers.` });
    if (!active.some((m) => m.proposer)) issues.push({ step: "Roles", message: "At least one member must be a proposer." });
    if (!active.some((m) => m.executor)) issues.push({ step: "Roles", message: "At least one member must be an executor." });
  }

  if (approvers > 0 && (threshold < 1 || threshold > approvers))
    issues.push({ step: "Threshold", message: `Threshold must be between 1 and ${approvers}.` });

  if (timing.voting <= 0) issues.push({ step: "Timing", message: "Voting period must be longer than zero." });
  if (timing.window <= 0) issues.push({ step: "Timing", message: "Execution window must be longer than zero." });
  if (timing.timelock < 0) issues.push({ step: "Timing", message: "Timelock cannot be negative." });

  return issues;
}

export function buildConstructorArgs({
  members,
  threshold,
  timing,
}: {
  members: WizardMember[];
  threshold: number;
  timing: Timing;
}): { approvers: string[]; proposers: string[]; executors: string[]; config: Config } {
  const active = members.filter((m) => !m.removed);
  return {
    approvers: active.filter((m) => m.approver).map((m) => m.address),
    proposers: active.filter((m) => m.proposer).map((m) => m.address),
    executors: active.filter((m) => m.executor).map((m) => m.address),
    config: {
      threshold,
      timelock_delay: BigInt(timing.timelock),
      voting_period: BigInt(timing.voting),
      execution_window: BigInt(timing.window),
    },
  };
}
