/**
 * Everything the app reads from a treasury. All reads go through the generated
 * bindings in @steward/treasury-client, which simulate the view call over RPC.
 */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { rpc } from "@stellar/stellar-sdk";
import { Client as TokenClient } from "@stellar/stellar-sdk/contract";
import {
  Client,
  ProposalState,
  ProposalStatus,
  Role,
  type Config,
  type Proposal,
  type SpendingLimitEntry,
} from "@steward/treasury-client";
import { knownTokens, network, type TokenInfo } from "./network";

export { ProposalState, ProposalStatus, Role };
export type { Config, Proposal, SpendingLimitEntry };

export const PAGE_SIZE = 20;
/** How often open pages re-read chain state. */
export const POLL_MS = 15_000;

export interface Signer {
  publicKey: string;
  signTransaction: (
    xdr: string,
    options?: { networkPassphrase?: string; address?: string },
  ) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
}

export function treasuryClient(contractId: string, signer?: Signer): Client {
  return new Client({
    contractId,
    networkPassphrase: network.passphrase,
    rpcUrl: network.rpcUrl,
    publicKey: signer?.publicKey,
    signTransaction: signer?.signTransaction,
  });
}

let server: rpc.Server | undefined;
export function rpcServer(): rpc.Server {
  server ??= new rpc.Server(network.rpcUrl);
  return server;
}

export interface Members {
  proposers: string[];
  approvers: string[];
  executors: string[];
}

export interface TreasuryOverview {
  config: Config;
  configVersion: number;
  proposalCount: number;
  members: Members;
}

export async function fetchOverview(contractId: string): Promise<TreasuryOverview> {
  const client = treasuryClient(contractId);
  const [config, version, count, proposers, approvers, executors] = await Promise.all([
    client.get_config(),
    client.get_config_version(),
    client.proposal_count(),
    client.members({ role: Role.Proposer }),
    client.members({ role: Role.Approver }),
    client.members({ role: Role.Executor }),
  ]);
  return {
    config: config.result,
    configVersion: version.result,
    proposalCount: Number(count.result),
    members: { proposers: proposers.result, approvers: approvers.result, executors: executors.result },
  };
}

export function rolesOf(members: Members | undefined, address: string | null | undefined) {
  return {
    proposer: !!address && !!members?.proposers.includes(address),
    approver: !!address && !!members?.approvers.includes(address),
    executor: !!address && !!members?.executors.includes(address),
  };
}

/**
 * Mirrors the contract's `proposal_state` so countdowns and badges stay live
 * between polls. `now` is in seconds.
 */
export function deriveState(
  proposal: Pick<Proposal, "status" | "config_version" | "voting_ends_at" | "eta">,
  config: Pick<Config, "execution_window">,
  configVersion: number,
  now: number,
): ProposalState {
  switch (proposal.status) {
    case ProposalStatus.Executed:
      return ProposalState.Executed;
    case ProposalStatus.Cancelled:
      return ProposalState.Cancelled;
    case ProposalStatus.Rejected:
      return ProposalState.Rejected;
  }
  if (proposal.config_version !== configVersion) return ProposalState.Stale;
  if (proposal.status === ProposalStatus.Pending) {
    return now > Number(proposal.voting_ends_at) ? ProposalState.Expired : ProposalState.Pending;
  }
  const eta = Number(proposal.eta ?? 0n);
  if (now < eta) return ProposalState.Queued;
  if (now > eta + Number(config.execution_window)) return ProposalState.Expired;
  return ProposalState.Ready;
}

export const isOpen = (state: ProposalState) =>
  state === ProposalState.Pending || state === ProposalState.Queued || state === ProposalState.Ready;

const keys = {
  all: (id: string) => ["treasury", id] as const,
  overview: (id: string) => ["treasury", id, "overview"] as const,
  proposals: (id: string) => ["treasury", id, "proposals"] as const,
  proposal: (id: string, proposal: string) => ["treasury", id, "proposal", proposal] as const,
  balances: (id: string, tokens: string[]) => ["treasury", id, "balances", ...tokens] as const,
  limits: (id: string) => ["treasury", id, "limits"] as const,
  activity: (id: string) => ["treasury", id, "activity"] as const,
};
export { keys as treasuryKeys };

export function useOverview(contractId: string) {
  return useQuery({
    queryKey: keys.overview(contractId),
    queryFn: () => fetchOverview(contractId),
    refetchInterval: POLL_MS,
  });
}

/** Proposals newest first, one page of 20 per request. */
export function useProposals(contractId: string, proposalCount: number | undefined) {
  return useInfiniteQuery({
    queryKey: [...keys.proposals(contractId), proposalCount ?? 0],
    enabled: proposalCount !== undefined,
    initialPageParam: proposalCount ?? 0,
    // `pageParam` is the highest id not fetched yet.
    queryFn: async ({ pageParam }) => {
      if (pageParam < 1) return [] as Proposal[];
      const start = Math.max(1, pageParam - PAGE_SIZE + 1);
      const page = await treasuryClient(contractId).get_proposals({
        start: BigInt(start),
        limit: pageParam - start + 1,
      });
      return [...page.result].reverse();
    },
    getNextPageParam: (_last, _all, pageParam) => (pageParam - PAGE_SIZE >= 1 ? pageParam - PAGE_SIZE : undefined),
    refetchInterval: POLL_MS,
  });
}

export function useProposal(contractId: string, proposalId: string) {
  return useQuery({
    queryKey: keys.proposal(contractId, proposalId),
    queryFn: async () => {
      const response = await treasuryClient(contractId).get_proposal({ id: BigInt(proposalId) });
      return response.result.isOk() ? response.result.unwrap() : null;
    },
    enabled: /^\d+$/.test(proposalId),
    refetchInterval: POLL_MS,
  });
}

export function useBalances(contractId: string, tokens: TokenInfo[]) {
  return useQuery({
    queryKey: keys.balances(contractId, tokens.map((t) => t.id)),
    queryFn: async () => {
      const client = treasuryClient(contractId);
      const results = await Promise.allSettled(tokens.map((token) => client.balance({ token: token.id })));
      return Object.fromEntries(
        tokens.map((token, index) => {
          const result = results[index];
          return [token.id, result?.status === "fulfilled" ? result.value.result : null];
        }),
      ) as Record<string, bigint | null>;
    },
    refetchInterval: POLL_MS,
  });
}

export function useLimits(contractId: string) {
  return useQuery({
    queryKey: keys.limits(contractId),
    queryFn: async () => (await treasuryClient(contractId).get_spending_limits()).result,
    refetchInterval: POLL_MS,
  });
}

/** Reads symbol, name and decimals from any SEP-41 token contract. */
export async function fetchTokenInfo(id: string): Promise<TokenInfo> {
  const known = knownTokens.find((token) => token.id === id);
  if (known) return known;
  const client = await TokenClient.from({
    contractId: id,
    networkPassphrase: network.passphrase,
    rpcUrl: network.rpcUrl,
  });
  type Call<T> = () => Promise<{ result: T }>;
  const methods = client as unknown as { symbol: Call<string>; name: Call<string>; decimals: Call<number> };
  const [symbol, name, decimals] = await Promise.all([methods.symbol(), methods.name(), methods.decimals()]);
  return { id, symbol: symbol.result, name: name.result, decimals: Number(decimals.result) };
}
