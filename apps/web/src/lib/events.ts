/**
 * Recent activity from Stellar RPC `getEvents`.
 *
 * Public RPC nodes keep events for a short window only (about a week on
 * testnet, often less), so this is a live feed, not a history. Full history
 * needs an indexer: see docs/WAVE_ISSUES.md.
 */
import { useQuery } from "@tanstack/react-query";
import { scValToNative, type xdr } from "@stellar/stellar-sdk";
import { POLL_MS, rpcServer, treasuryKeys } from "./treasury";

export interface ActivityItem {
  id: string;
  /** Event name as emitted, for example "proposal_created". */
  type: string;
  ledger: number;
  closedAt: string;
  txHash: string;
  topics: unknown[];
  data: Record<string, unknown>;
}

/** Roughly one day of ledgers at about five seconds each. */
const LOOKBACK_LEDGERS = 17_280;

function native(value: xdr.ScVal): unknown {
  try {
    return scValToNative(value);
  } catch {
    return null;
  }
}

export async function fetchActivity(contractId: string, limit = 40): Promise<ActivityItem[]> {
  const server = rpcServer();
  const latest = await server.getLatestLedger();
  let startLedger = Math.max(1, latest.sequence - LOOKBACK_LEDGERS);
  const filters = [{ type: "contract" as const, contractIds: [contractId] }];

  let response;
  try {
    response = await server.getEvents({ startLedger, filters, limit: 200 });
  } catch (error) {
    // The node keeps less than a day: retry from the oldest ledger it reports.
    const match = /(\d+)\s*-\s*(\d+)/.exec(String((error as Error).message));
    if (!match) throw error;
    startLedger = Number(match[1]);
    response = await server.getEvents({ startLedger, filters, limit: 200 });
  }

  return response.events
    .map((event) => {
      const [name, ...topics] = event.topic.map(native);
      const data = native(event.value);
      return {
        id: event.id,
        type: String(name),
        ledger: event.ledger,
        closedAt: event.ledgerClosedAt,
        txHash: event.txHash,
        topics,
        data: data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : { value: data },
      };
    })
    .reverse()
    .slice(0, limit);
}

export function useActivity(contractId: string) {
  return useQuery({
    queryKey: treasuryKeys.activity(contractId),
    queryFn: () => fetchActivity(contractId),
    refetchInterval: POLL_MS,
    retry: 1,
  });
}

const ROLE_NAMES = ["proposer", "approver", "executor"];
const short = (value: unknown) => {
  const text = String(value);
  return text.length > 12 ? `${text.slice(0, 4)}…${text.slice(-4)}` : text;
};

/** One line of plain words for an event. */
export function describeEvent(item: ActivityItem): string {
  const [first, second] = item.topics;
  switch (item.type) {
    case "proposal_created":
      return `Proposal #${first} created by ${short(second)}`;
    case "voted":
      return `${short(second)} ${item.data.approve ? "approved" : "rejected"} proposal #${first}`;
    case "proposal_queued":
      return `Proposal #${first} reached its threshold and entered the timelock`;
    case "proposal_rejected":
      return `Proposal #${first} was rejected`;
    case "proposal_cancelled":
      return `Proposal #${first} was cancelled`;
    case "proposal_executed":
      return `Proposal #${first} executed by ${short(second)}`;
    case "member_added":
      return `${short(first)} became ${ROLE_NAMES[Number(item.data.role)] ?? "a member"}`;
    case "member_removed":
      return `${short(first)} is no longer ${ROLE_NAMES[Number(item.data.role)] ?? "a member"}`;
    case "config_updated":
      return `Settings updated to version ${first}`;
    case "spending_limit_set":
      return `Spending limit set for ${short(first)}`;
    case "spending_limit_removed":
      return `Spending limit removed for ${short(first)}`;
    case "spent":
      return `${short(first)} spent from their limit`;
    case "upgraded":
      return "Treasury code upgraded";
    case "role_granted":
    case "role_revoked":
      return `Role ${first} ${item.type === "role_granted" ? "granted to" : "revoked from"} ${short(second)}`;
    default:
      return item.type.replace(/_/g, " ");
  }
}

/** Proposal id an event refers to, when it has one. */
export function eventProposalId(item: ActivityItem): string | null {
  return item.type.startsWith("proposal_") || item.type === "voted" ? String(item.topics[0]) : null;
}
