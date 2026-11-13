import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCVCO6UWFYZS34QGIIIEMA6E5YKAMFNMBPMM23MVA5Q6Q6YMNQYTJBFJ",
  }
} as const

/**
 * The three treasury roles. An address may hold more than one.
 */
export enum Role {
  Proposer = 0,
  Approver = 1,
  Executor = 2,
}


export interface Vote {
  approve: boolean;
  timestamp: u64;
  voter: string;
}

/**
 * One step of a proposal. Actions run in order and atomically.
 */
export type Action = {tag: "Transfer", values: readonly [TransferAction]} | {tag: "Invoke", values: readonly [InvokeAction]} | {tag: "AddMember", values: readonly [MemberAction]} | {tag: "RemoveMember", values: readonly [MemberAction]} | {tag: "SetThreshold", values: readonly [u32]} | {tag: "SetTimelockDelay", values: readonly [u64]} | {tag: "SetVotingPeriod", values: readonly [u64]} | {tag: "SetExecutionWindow", values: readonly [u64]} | {tag: "SetSpendingLimit", values: readonly [SpendingLimitAction]} | {tag: "RemoveSpendingLimit", values: readonly [SpendingLimitKey]} | {tag: "Upgrade", values: readonly [Buffer]};


/**
 * Treasury configuration. All durations are in seconds, measured against the
 * ledger timestamp.
 */
export interface Config {
  /**
 * How long a queued proposal stays executable once the timelock ends.
 */
execution_window: u64;
  /**
 * Approvals required to queue a proposal.
 */
threshold: u32;
  /**
 * Delay between a proposal being queued and becoming executable.
 */
timelock_delay: u64;
  /**
 * How long a proposal stays open for voting after creation.
 */
voting_period: u64;
}


export interface Proposal {
  actions: Array<Action>;
  approvals: u32;
  /**
 * When the proposal was executed, cancelled or rejected.
 */
closed_at: Option<u64>;
  /**
 * Config version the proposal was created under.
 */
config_version: u32;
  created_at: u64;
  /**
 * Earliest execution time (`queued_at + timelock_delay`).
 */
eta: Option<u64>;
  id: u64;
  memo: string;
  proposer: string;
  /**
 * When the threshold was reached.
 */
queued_at: Option<u64>;
  rejections: u32;
  status: ProposalStatus;
  votes: Array<Vote>;
  /**
 * Last timestamp (inclusive) at which votes are accepted.
 */
voting_ends_at: u64;
}


export interface InvokeAction {
  args: Array<any>;
  contract: string;
  function: string;
}


export interface MemberAction {
  account: string;
  role: Role;
}

/**
 * State derived from the stored status, the clock and the config version.
 */
export enum ProposalState {
  Pending = 0,
  Queued = 1,
  Ready = 2,
  Executed = 3,
  Cancelled = 4,
  Rejected = 5,
  Expired = 6,
  Stale = 7,
}


/**
 * Allowance for one spender and one token.
 */
export interface SpendingLimit {
  /**
 * Allowance per window.
 */
amount: i128;
  /**
 * Window length in seconds.
 */
period: u64;
  /**
 * Amount already spent in the window starting at `window_start`.
 */
spent: i128;
  /**
 * Start of the window `spent` refers to (a multiple of `period`).
 */
window_start: u64;
}

/**
 * Status persisted on a proposal.
 */
export enum ProposalStatus {
  Pending = 0,
  Queued = 1,
  Executed = 2,
  Cancelled = 3,
  Rejected = 4,
}


export interface TransferAction {
  amount: i128;
  to: string;
  token: string;
}


export interface SpendingLimitKey {
  spender: string;
  token: string;
}


export interface SpendingLimitEntry {
  limit: SpendingLimit;
  spender: string;
  token: string;
}


export interface SpendingLimitAction {
  /**
 * Allowance per window, in the token's smallest unit.
 */
amount: i128;
  /**
 * Window length in seconds.
 */
period: u64;
  spender: string;
  token: string;
}

/**
 * Every failure the treasury can return.
 * 
 * Codes are stable: clients map them to human-readable messages. Never
 * renumber an existing variant; only append.
 */
export const TreasuryError = {
  /**
   * Threshold is zero or above the approver count.
   */
  1: {message:"InvalidThreshold"},
  /**
   * A role would end up with no members.
   */
  2: {message:"EmptyRole"},
  /**
   * A role would exceed the per-role member cap.
   */
  3: {message:"TooManyMembers"},
  /**
   * The same address appears twice within one role.
   */
  4: {message:"DuplicateMember"},
  /**
   * Voting period or execution window is zero.
   */
  5: {message:"InvalidDuration"},
  /**
   * Caller does not hold the proposer role.
   */
  6: {message:"NotProposer"},
  /**
   * Caller does not hold the approver role.
   */
  7: {message:"NotApprover"},
  /**
   * Caller does not hold the executor role.
   */
  8: {message:"NotExecutor"},
  /**
   * A proposal must contain at least one action.
   */
  9: {message:"NoActions"},
  /**
   * A proposal contains more actions than allowed.
   */
  10: {message:"TooManyActions"},
  /**
   * Memo is longer than the allowed byte length.
   */
  11: {message:"MemoTooLong"},
  /**
   * Amount must be strictly positive.
   */
  12: {message:"InvalidAmount"},
  /**
   * Spending-limit period must be strictly positive.
   */
  13: {message:"InvalidPeriod"},
  /**
   * No proposal exists with this id.
   */
  14: {message:"ProposalNotFound"},
  /**
   * This approver already voted on the proposal.
   */
  15: {message:"AlreadyVoted"},
  /**
   * The proposal is no longer open for voting.
   */
  16: {message:"ProposalNotPending"},
  /**
   * The voting period has ended.
   */
  17: {message:"VotingClosed"},
  /**
   * The proposal was created under an older config version.
   */
  18: {message:"ProposalStale"},
  /**
   * The proposal is not queued for execution.
   */
  19: {message:"NotQueued"},
  /**
   * The timelock has not elapsed yet.
   */
  20: {message:"TimelockActive"},
  /**
   * The execution window has passed.
   */
  21: {message:"ExecutionWindowExpired"},
  /**
   * Only the original proposer may cancel.
   */
  22: {message:"NotProposalCreator"},
  /**
   * The proposal can no longer be cancelled.
   */
  23: {message:"CannotCancel"},
  /**
   * The account already holds this role.
   */
  24: {message:"MemberAlreadyExists"},
  /**
   * The account does not hold this role.
   */
  25: {message:"MemberNotFound"},
  /**
   * The last member of a role can never be removed.
   */
  26: {message:"LastMember"},
  /**
   * No spending limit exists for this spender and token.
   */
  27: {message:"NoSpendingLimit"},
  /**
   * The spend would exceed the allowance for the current window.
   */
  28: {message:"SpendingLimitExceeded"},
  /**
   * Arithmetic overflow.
   */
  29: {message:"Overflow"},
  /**
   * The proposal was already executed.
   */
  30: {message:"AlreadyExecuted"},
  /**
   * Too many spending limits are registered.
   */
  31: {message:"TooManySpendingLimits"}
}
















export const AccessControlError = {
  2000: {message:"Unauthorized"},
  2001: {message:"AdminNotSet"},
  2002: {message:"IndexOutOfBounds"},
  2003: {message:"AdminRoleNotFound"},
  2004: {message:"RoleCountIsNotZero"},
  2005: {message:"RoleNotFound"},
  2006: {message:"AdminAlreadySet"},
  2007: {message:"RoleNotHeld"},
  2008: {message:"RoleIsEmpty"},
  2009: {message:"TransferInProgress"},
  2010: {message:"MaxRolesExceeded"}
}

export interface Client {
  /**
   * Construct and simulate a spend transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sends `amount` of `token` from the treasury to `to`, within the
   * spender's allowance for the current window. Needs only the spender's
   * authorisation: no proposal and no timelock.
   */
  spend: ({spender, token, to, amount}: {spender: string, token: string, to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancels a pending or queued proposal. Only the original proposer may
   * cancel, which gives the timelock its purpose: a window to back out.
   */
  cancel: ({proposer, id}: {proposer: string, id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a reject transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Votes against. When the threshold can no longer be reached the proposal
   * is rejected. Returns the new status.
   */
  reject: ({approver, id}: {approver: string, id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<ProposalStatus>>>

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Votes in favour. When approvals reach the threshold the proposal is
   * queued with `eta = now + timelock_delay`. Returns the new status.
   */
  approve: ({approver, id}: {approver: string, id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<ProposalStatus>>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Treasury balance of `token`.
   */
  balance: ({token}: {token: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a execute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Executes a queued proposal once its timelock has elapsed and before its
   * execution window closes. All actions run atomically: if one fails, the
   * whole transaction reverts.
   */
  execute: ({executor, id}: {executor: string, id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a members transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  members: ({role}: {role: Role}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a propose transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Creates a proposal bundling 1 to 10 actions. Returns its id.
   * 
   * Requires the proposer role and `proposer`'s authorisation.
   */
  propose: ({proposer, actions, memo}: {proposer: string, actions: Array<Action>, memo: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a has_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  has_role: ({account, role}: {account: string, role: Role}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a get_proposal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_proposal: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Proposal>>>

  /**
   * Construct and simulate a get_proposals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns up to `limit` (max 20) proposals with ids `start, start + 1, ...`.
   * Ids start at 1.
   */
  get_proposals: ({start, limit}: {start: u64, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Proposal>>>

  /**
   * Construct and simulate a proposal_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Number of proposals ever created. Ids run from 1 to this value.
   */
  proposal_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a proposal_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Current state of a proposal, taking the clock and config version into
   * account.
   */
  proposal_state: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<ProposalState>>>

  /**
   * Construct and simulate a get_config_version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Incremented every time an executed proposal changes membership, config
   * or code. Proposals created under an older version are stale.
   */
  get_config_version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_spending_limit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The spender's limit for `token` as it stands now: if the stored window
   * has passed, `spent` reads as zero.
   */
  get_spending_limit: ({spender, token}: {spender: string, token: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<SpendingLimit>>>

  /**
   * Construct and simulate a get_spending_limits transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Every registered spending limit (at most 50), as it stands now.
   */
  get_spending_limits: (options?: MethodOptions) => Promise<AssembledTransaction<Array<SpendingLimitEntry>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {approvers, proposers, executors, config}: {approvers: Array<string>, proposers: Array<string>, executors: Array<string>, config: Config},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({approvers, proposers, executors, config}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAwAAADxUaGUgdGhyZWUgdHJlYXN1cnkgcm9sZXMuIEFuIGFkZHJlc3MgbWF5IGhvbGQgbW9yZSB0aGFuIG9uZS4AAAAAAAAABFJvbGUAAAADAAAAAAAAAAhQcm9wb3NlcgAAAAAAAAAAAAAACEFwcHJvdmVyAAAAAQAAAAAAAAAIRXhlY3V0b3IAAAAC",
        "AAAAAQAAAAAAAAAAAAAABFZvdGUAAAADAAAAAAAAAAdhcHByb3ZlAAAAAAEAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAAAAAAABXZvdGVyAAAAAAAAEw==",
        "AAAAAgAAADxPbmUgc3RlcCBvZiBhIHByb3Bvc2FsLiBBY3Rpb25zIHJ1biBpbiBvcmRlciBhbmQgYXRvbWljYWxseS4AAAAAAAAABkFjdGlvbgAAAAAACwAAAAEAAAAhU2VuZCB0b2tlbnMgaGVsZCBieSB0aGUgdHJlYXN1cnkuAAAAAAAACFRyYW5zZmVyAAAAAQAAB9AAAAAOVHJhbnNmZXJBY3Rpb24AAAAAAAEAAABEQ2FsbCBhbnkgY29udHJhY3QgYXMgdGhlIHRyZWFzdXJ5IChhdXRob3Jpc2VkIHRocm91Z2ggaW52b2tlciBhdXRoKS4AAAAGSW52b2tlAAAAAAABAAAH0AAAAAxJbnZva2VBY3Rpb24AAAABAAAAAAAAAAlBZGRNZW1iZXIAAAAAAAABAAAH0AAAAAxNZW1iZXJBY3Rpb24AAAABAAAAAAAAAAxSZW1vdmVNZW1iZXIAAAABAAAH0AAAAAxNZW1iZXJBY3Rpb24AAAABAAAAAAAAAAxTZXRUaHJlc2hvbGQAAAABAAAABAAAAAEAAAAAAAAAEFNldFRpbWVsb2NrRGVsYXkAAAABAAAABgAAAAEAAAAAAAAAD1NldFZvdGluZ1BlcmlvZAAAAAABAAAABgAAAAEAAAAAAAAAElNldEV4ZWN1dGlvbldpbmRvdwAAAAAAAQAAAAYAAAABAAAAAAAAABBTZXRTcGVuZGluZ0xpbWl0AAAAAQAAB9AAAAATU3BlbmRpbmdMaW1pdEFjdGlvbgAAAAABAAAAAAAAABNSZW1vdmVTcGVuZGluZ0xpbWl0AAAAAAEAAAfQAAAAEFNwZW5kaW5nTGltaXRLZXkAAAABAAAAIFJlcGxhY2UgdGhlIHRyZWFzdXJ5J3Mgb3duIFdhc20uAAAAB1VwZ3JhZGUAAAAAAQAAA+4AAAAg",
        "AAAAAQAAAFxUcmVhc3VyeSBjb25maWd1cmF0aW9uLiBBbGwgZHVyYXRpb25zIGFyZSBpbiBzZWNvbmRzLCBtZWFzdXJlZCBhZ2FpbnN0IHRoZQpsZWRnZXIgdGltZXN0YW1wLgAAAAAAAAAGQ29uZmlnAAAAAAAEAAAAQ0hvdyBsb25nIGEgcXVldWVkIHByb3Bvc2FsIHN0YXlzIGV4ZWN1dGFibGUgb25jZSB0aGUgdGltZWxvY2sgZW5kcy4AAAAAEGV4ZWN1dGlvbl93aW5kb3cAAAAGAAAAJ0FwcHJvdmFscyByZXF1aXJlZCB0byBxdWV1ZSBhIHByb3Bvc2FsLgAAAAAJdGhyZXNob2xkAAAAAAAABAAAAD5EZWxheSBiZXR3ZWVuIGEgcHJvcG9zYWwgYmVpbmcgcXVldWVkIGFuZCBiZWNvbWluZyBleGVjdXRhYmxlLgAAAAAADnRpbWVsb2NrX2RlbGF5AAAAAAAGAAAAOUhvdyBsb25nIGEgcHJvcG9zYWwgc3RheXMgb3BlbiBmb3Igdm90aW5nIGFmdGVyIGNyZWF0aW9uLgAAAAAAAA12b3RpbmdfcGVyaW9kAAAAAAAABg==",
        "AAAAAQAAAAAAAAAAAAAACFByb3Bvc2FsAAAADgAAAAAAAAAHYWN0aW9ucwAAAAPqAAAH0AAAAAZBY3Rpb24AAAAAAAAAAAAJYXBwcm92YWxzAAAAAAAABAAAADZXaGVuIHRoZSBwcm9wb3NhbCB3YXMgZXhlY3V0ZWQsIGNhbmNlbGxlZCBvciByZWplY3RlZC4AAAAAAAljbG9zZWRfYXQAAAAAAAPoAAAABgAAAC5Db25maWcgdmVyc2lvbiB0aGUgcHJvcG9zYWwgd2FzIGNyZWF0ZWQgdW5kZXIuAAAAAAAOY29uZmlnX3ZlcnNpb24AAAAAAAQAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAA3RWFybGllc3QgZXhlY3V0aW9uIHRpbWUgKGBxdWV1ZWRfYXQgKyB0aW1lbG9ja19kZWxheWApLgAAAAADZXRhAAAAA+gAAAAGAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAEbWVtbwAAABAAAAAAAAAACHByb3Bvc2VyAAAAEwAAAB9XaGVuIHRoZSB0aHJlc2hvbGQgd2FzIHJlYWNoZWQuAAAAAAlxdWV1ZWRfYXQAAAAAAAPoAAAABgAAAAAAAAAKcmVqZWN0aW9ucwAAAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADlByb3Bvc2FsU3RhdHVzAAAAAAAAAAAABXZvdGVzAAAAAAAD6gAAB9AAAAAEVm90ZQAAADdMYXN0IHRpbWVzdGFtcCAoaW5jbHVzaXZlKSBhdCB3aGljaCB2b3RlcyBhcmUgYWNjZXB0ZWQuAAAAAA52b3RpbmdfZW5kc19hdAAAAAAABg==",
        "AAAAAQAAAAAAAAAAAAAADEludm9rZUFjdGlvbgAAAAMAAAAAAAAABGFyZ3MAAAPqAAAAAAAAAAAAAAAIY29udHJhY3QAAAATAAAAAAAAAAhmdW5jdGlvbgAAABE=",
        "AAAAAQAAAAAAAAAAAAAADE1lbWJlckFjdGlvbgAAAAIAAAAAAAAAB2FjY291bnQAAAAAEwAAAAAAAAAEcm9sZQAAB9AAAAAEUm9sZQ==",
        "AAAAAwAAAEdTdGF0ZSBkZXJpdmVkIGZyb20gdGhlIHN0b3JlZCBzdGF0dXMsIHRoZSBjbG9jayBhbmQgdGhlIGNvbmZpZyB2ZXJzaW9uLgAAAAAAAAAADVByb3Bvc2FsU3RhdGUAAAAAAAAIAAAAEE9wZW4gZm9yIHZvdGluZy4AAAAHUGVuZGluZwAAAAAAAAAAI0FwcHJvdmVkOyB3YWl0aW5nIGZvciB0aGUgdGltZWxvY2suAAAAAAZRdWV1ZWQAAAAAAAEAAAAmVGltZWxvY2sgZWxhcHNlZDsgY2FuIGJlIGV4ZWN1dGVkIG5vdy4AAAAAAAVSZWFkeQAAAAAAAAIAAAAAAAAACEV4ZWN1dGVkAAAAAwAAAAAAAAAJQ2FuY2VsbGVkAAAAAAAABAAAAAAAAAAIUmVqZWN0ZWQAAAAFAAAAKlZvdGluZyBwZXJpb2Qgb3IgZXhlY3V0aW9uIHdpbmRvdyByYW4gb3V0LgAAAAAAB0V4cGlyZWQAAAAABgAAACZDcmVhdGVkIHVuZGVyIGFuIG9sZGVyIGNvbmZpZyB2ZXJzaW9uLgAAAAAABVN0YWxlAAAAAAAABw==",
        "AAAAAQAAAChBbGxvd2FuY2UgZm9yIG9uZSBzcGVuZGVyIGFuZCBvbmUgdG9rZW4uAAAAAAAAAA1TcGVuZGluZ0xpbWl0AAAAAAAABAAAABVBbGxvd2FuY2UgcGVyIHdpbmRvdy4AAAAAAAAGYW1vdW50AAAAAAALAAAAGVdpbmRvdyBsZW5ndGggaW4gc2Vjb25kcy4AAAAAAAAGcGVyaW9kAAAAAAAGAAAAPkFtb3VudCBhbHJlYWR5IHNwZW50IGluIHRoZSB3aW5kb3cgc3RhcnRpbmcgYXQgYHdpbmRvd19zdGFydGAuAAAAAAAFc3BlbnQAAAAAAAALAAAAP1N0YXJ0IG9mIHRoZSB3aW5kb3cgYHNwZW50YCByZWZlcnMgdG8gKGEgbXVsdGlwbGUgb2YgYHBlcmlvZGApLgAAAAAMd2luZG93X3N0YXJ0AAAABg==",
        "AAAAAwAAAB9TdGF0dXMgcGVyc2lzdGVkIG9uIGEgcHJvcG9zYWwuAAAAAAAAAAAOUHJvcG9zYWxTdGF0dXMAAAAAAAUAAAAAAAAAB1BlbmRpbmcAAAAAAAAAAAAAAAAGUXVldWVkAAAAAAABAAAAAAAAAAhFeGVjdXRlZAAAAAIAAAAAAAAACUNhbmNlbGxlZAAAAAAAAAMAAAAAAAAACFJlamVjdGVkAAAABA==",
        "AAAAAQAAAAAAAAAAAAAADlRyYW5zZmVyQWN0aW9uAAAAAAADAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABM=",
        "AAAAAQAAAAAAAAAAAAAAEFNwZW5kaW5nTGltaXRLZXkAAAACAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAAElNwZW5kaW5nTGltaXRFbnRyeQAAAAAAAwAAAAAAAAAFbGltaXQAAAAAAAfQAAAADVNwZW5kaW5nTGltaXQAAAAAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAQAAAAAAAAAAAAAAE1NwZW5kaW5nTGltaXRBY3Rpb24AAAAABAAAADNBbGxvd2FuY2UgcGVyIHdpbmRvdywgaW4gdGhlIHRva2VuJ3Mgc21hbGxlc3QgdW5pdC4AAAAABmFtb3VudAAAAAAACwAAABlXaW5kb3cgbGVuZ3RoIGluIHNlY29uZHMuAAAAAAAABnBlcmlvZAAAAAAABgAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABM=",
        "AAAABAAAAJdFdmVyeSBmYWlsdXJlIHRoZSB0cmVhc3VyeSBjYW4gcmV0dXJuLgoKQ29kZXMgYXJlIHN0YWJsZTogY2xpZW50cyBtYXAgdGhlbSB0byBodW1hbi1yZWFkYWJsZSBtZXNzYWdlcy4gTmV2ZXIKcmVudW1iZXIgYW4gZXhpc3RpbmcgdmFyaWFudDsgb25seSBhcHBlbmQuAAAAAAAAAAANVHJlYXN1cnlFcnJvcgAAAAAAAB8AAAAuVGhyZXNob2xkIGlzIHplcm8gb3IgYWJvdmUgdGhlIGFwcHJvdmVyIGNvdW50LgAAAAAAEEludmFsaWRUaHJlc2hvbGQAAAABAAAAJEEgcm9sZSB3b3VsZCBlbmQgdXAgd2l0aCBubyBtZW1iZXJzLgAAAAlFbXB0eVJvbGUAAAAAAAACAAAALEEgcm9sZSB3b3VsZCBleGNlZWQgdGhlIHBlci1yb2xlIG1lbWJlciBjYXAuAAAADlRvb01hbnlNZW1iZXJzAAAAAAADAAAAL1RoZSBzYW1lIGFkZHJlc3MgYXBwZWFycyB0d2ljZSB3aXRoaW4gb25lIHJvbGUuAAAAAA9EdXBsaWNhdGVNZW1iZXIAAAAABAAAACpWb3RpbmcgcGVyaW9kIG9yIGV4ZWN1dGlvbiB3aW5kb3cgaXMgemVyby4AAAAAAA9JbnZhbGlkRHVyYXRpb24AAAAABQAAACdDYWxsZXIgZG9lcyBub3QgaG9sZCB0aGUgcHJvcG9zZXIgcm9sZS4AAAAAC05vdFByb3Bvc2VyAAAAAAYAAAAnQ2FsbGVyIGRvZXMgbm90IGhvbGQgdGhlIGFwcHJvdmVyIHJvbGUuAAAAAAtOb3RBcHByb3ZlcgAAAAAHAAAAJ0NhbGxlciBkb2VzIG5vdCBob2xkIHRoZSBleGVjdXRvciByb2xlLgAAAAALTm90RXhlY3V0b3IAAAAACAAAACxBIHByb3Bvc2FsIG11c3QgY29udGFpbiBhdCBsZWFzdCBvbmUgYWN0aW9uLgAAAAlOb0FjdGlvbnMAAAAAAAAJAAAALkEgcHJvcG9zYWwgY29udGFpbnMgbW9yZSBhY3Rpb25zIHRoYW4gYWxsb3dlZC4AAAAAAA5Ub29NYW55QWN0aW9ucwAAAAAACgAAACxNZW1vIGlzIGxvbmdlciB0aGFuIHRoZSBhbGxvd2VkIGJ5dGUgbGVuZ3RoLgAAAAtNZW1vVG9vTG9uZwAAAAALAAAAIUFtb3VudCBtdXN0IGJlIHN0cmljdGx5IHBvc2l0aXZlLgAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAAADAAAADBTcGVuZGluZy1saW1pdCBwZXJpb2QgbXVzdCBiZSBzdHJpY3RseSBwb3NpdGl2ZS4AAAANSW52YWxpZFBlcmlvZAAAAAAAAA0AAAAgTm8gcHJvcG9zYWwgZXhpc3RzIHdpdGggdGhpcyBpZC4AAAAQUHJvcG9zYWxOb3RGb3VuZAAAAA4AAAAsVGhpcyBhcHByb3ZlciBhbHJlYWR5IHZvdGVkIG9uIHRoZSBwcm9wb3NhbC4AAAAMQWxyZWFkeVZvdGVkAAAADwAAACpUaGUgcHJvcG9zYWwgaXMgbm8gbG9uZ2VyIG9wZW4gZm9yIHZvdGluZy4AAAAAABJQcm9wb3NhbE5vdFBlbmRpbmcAAAAAABAAAAAcVGhlIHZvdGluZyBwZXJpb2QgaGFzIGVuZGVkLgAAAAxWb3RpbmdDbG9zZWQAAAARAAAAN1RoZSBwcm9wb3NhbCB3YXMgY3JlYXRlZCB1bmRlciBhbiBvbGRlciBjb25maWcgdmVyc2lvbi4AAAAADVByb3Bvc2FsU3RhbGUAAAAAAAASAAAAKVRoZSBwcm9wb3NhbCBpcyBub3QgcXVldWVkIGZvciBleGVjdXRpb24uAAAAAAAACU5vdFF1ZXVlZAAAAAAAABMAAAAhVGhlIHRpbWVsb2NrIGhhcyBub3QgZWxhcHNlZCB5ZXQuAAAAAAAADlRpbWVsb2NrQWN0aXZlAAAAAAAUAAAAIFRoZSBleGVjdXRpb24gd2luZG93IGhhcyBwYXNzZWQuAAAAFkV4ZWN1dGlvbldpbmRvd0V4cGlyZWQAAAAAABUAAAAmT25seSB0aGUgb3JpZ2luYWwgcHJvcG9zZXIgbWF5IGNhbmNlbC4AAAAAABJOb3RQcm9wb3NhbENyZWF0b3IAAAAAABYAAAAoVGhlIHByb3Bvc2FsIGNhbiBubyBsb25nZXIgYmUgY2FuY2VsbGVkLgAAAAxDYW5ub3RDYW5jZWwAAAAXAAAAJFRoZSBhY2NvdW50IGFscmVhZHkgaG9sZHMgdGhpcyByb2xlLgAAABNNZW1iZXJBbHJlYWR5RXhpc3RzAAAAABgAAAAkVGhlIGFjY291bnQgZG9lcyBub3QgaG9sZCB0aGlzIHJvbGUuAAAADk1lbWJlck5vdEZvdW5kAAAAAAAZAAAAL1RoZSBsYXN0IG1lbWJlciBvZiBhIHJvbGUgY2FuIG5ldmVyIGJlIHJlbW92ZWQuAAAAAApMYXN0TWVtYmVyAAAAAAAaAAAANE5vIHNwZW5kaW5nIGxpbWl0IGV4aXN0cyBmb3IgdGhpcyBzcGVuZGVyIGFuZCB0b2tlbi4AAAAPTm9TcGVuZGluZ0xpbWl0AAAAABsAAAA8VGhlIHNwZW5kIHdvdWxkIGV4Y2VlZCB0aGUgYWxsb3dhbmNlIGZvciB0aGUgY3VycmVudCB3aW5kb3cuAAAAFVNwZW5kaW5nTGltaXRFeGNlZWRlZAAAAAAAABwAAAAUQXJpdGhtZXRpYyBvdmVyZmxvdy4AAAAIT3ZlcmZsb3cAAAAdAAAAIlRoZSBwcm9wb3NhbCB3YXMgYWxyZWFkeSBleGVjdXRlZC4AAAAAAA9BbHJlYWR5RXhlY3V0ZWQAAAAAHgAAAChUb28gbWFueSBzcGVuZGluZyBsaW1pdHMgYXJlIHJlZ2lzdGVyZWQuAAAAFVRvb01hbnlTcGVuZGluZ0xpbWl0cwAAAAAAAB8=",
        "AAAABQAAAAAAAAAAAAAABVNwZW50AAAAAAAAAQAAAAVzcGVudAAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAABVZvdGVkAAAAAAAAAQAAAAV2b3RlZAAAAAAAAAUAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAAFdm90ZXIAAAAAAAATAAAAAQAAAAAAAAAHYXBwcm92ZQAAAAABAAAAAAAAAAAAAAAJYXBwcm92YWxzAAAAAAAABAAAAAAAAAAAAAAACnJlamVjdGlvbnMAAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAACFVwZ3JhZGVkAAAAAQAAAAh1cGdyYWRlZAAAAAEAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAC01lbWJlckFkZGVkAAAAAAEAAAAMbWVtYmVyX2FkZGVkAAAAAgAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAEcm9sZQAAB9AAAAAEUm9sZQAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADUNvbmZpZ1VwZGF0ZWQAAAAAAAABAAAADmNvbmZpZ191cGRhdGVkAAAAAAACAAAAAAAAAA5jb25maWdfdmVyc2lvbgAAAAAABAAAAAEAAAAAAAAABmNvbmZpZwAAAAAH0AAAAAZDb25maWcAAAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADU1lbWJlclJlbW92ZWQAAAAAAAABAAAADm1lbWJlcl9yZW1vdmVkAAAAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAABAAAAAAAAAARyb2xlAAAH0AAAAARSb2xlAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADlByb3Bvc2FsUXVldWVkAAAAAAABAAAAD3Byb3Bvc2FsX3F1ZXVlZAAAAAACAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAAA2V0YQAAAAAGAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAD1Byb3Bvc2FsQ3JlYXRlZAAAAAABAAAAEHByb3Bvc2FsX2NyZWF0ZWQAAAAFAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAACHByb3Bvc2VyAAAAEwAAAAEAAAAAAAAADGFjdGlvbl9jb3VudAAAAAQAAAAAAAAAAAAAAA52b3RpbmdfZW5kc19hdAAAAAAABgAAAAAAAAAAAAAADmNvbmZpZ192ZXJzaW9uAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAEFByb3Bvc2FsRXhlY3V0ZWQAAAABAAAAEXByb3Bvc2FsX2V4ZWN1dGVkAAAAAAAAAgAAAAAAAAACaWQAAAAAAAYAAAABAAAAAAAAAAhleGVjdXRvcgAAABMAAAABAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAEFByb3Bvc2FsUmVqZWN0ZWQAAAABAAAAEXByb3Bvc2FsX3JlamVjdGVkAAAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAEFNwZW5kaW5nTGltaXRTZXQAAAABAAAAEnNwZW5kaW5nX2xpbWl0X3NldAAAAAAABAAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAGcGVyaW9kAAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAEVByb3Bvc2FsQ2FuY2VsbGVkAAAAAAAAAQAAABJwcm9wb3NhbF9jYW5jZWxsZWQAAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAI=",
        "AAAABQAAAAAAAAAAAAAAFFNwZW5kaW5nTGltaXRSZW1vdmVkAAAAAQAAABZzcGVuZGluZ19saW1pdF9yZW1vdmVkAAAAAAACAAAAAAAAAAdzcGVuZGVyAAAAABMAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAABAAAAAg==",
        "AAAAAAAAALBTZW5kcyBgYW1vdW50YCBvZiBgdG9rZW5gIGZyb20gdGhlIHRyZWFzdXJ5IHRvIGB0b2AsIHdpdGhpbiB0aGUKc3BlbmRlcidzIGFsbG93YW5jZSBmb3IgdGhlIGN1cnJlbnQgd2luZG93LiBOZWVkcyBvbmx5IHRoZSBzcGVuZGVyJ3MKYXV0aG9yaXNhdGlvbjogbm8gcHJvcG9zYWwgYW5kIG5vIHRpbWVsb2NrLgAAAAVzcGVuZAAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAACAAAH0AAAAA1UcmVhc3VyeUVycm9yAAAA",
        "AAAAAAAAAIhDYW5jZWxzIGEgcGVuZGluZyBvciBxdWV1ZWQgcHJvcG9zYWwuIE9ubHkgdGhlIG9yaWdpbmFsIHByb3Bvc2VyIG1heQpjYW5jZWwsIHdoaWNoIGdpdmVzIHRoZSB0aW1lbG9jayBpdHMgcHVycG9zZTogYSB3aW5kb3cgdG8gYmFjayBvdXQuAAAABmNhbmNlbAAAAAAAAgAAAAAAAAAIcHJvcG9zZXIAAAATAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPpAAAAAgAAB9AAAAANVHJlYXN1cnlFcnJvcgAAAA==",
        "AAAAAAAAAGxWb3RlcyBhZ2FpbnN0LiBXaGVuIHRoZSB0aHJlc2hvbGQgY2FuIG5vIGxvbmdlciBiZSByZWFjaGVkIHRoZSBwcm9wb3NhbAppcyByZWplY3RlZC4gUmV0dXJucyB0aGUgbmV3IHN0YXR1cy4AAAAGcmVqZWN0AAAAAAACAAAAAAAAAAhhcHByb3ZlcgAAABMAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAfQAAAADlByb3Bvc2FsU3RhdHVzAAAAAAfQAAAADVRyZWFzdXJ5RXJyb3IAAAA=",
        "AAAAAAAAAIVWb3RlcyBpbiBmYXZvdXIuIFdoZW4gYXBwcm92YWxzIHJlYWNoIHRoZSB0aHJlc2hvbGQgdGhlIHByb3Bvc2FsIGlzCnF1ZXVlZCB3aXRoIGBldGEgPSBub3cgKyB0aW1lbG9ja19kZWxheWAuIFJldHVybnMgdGhlIG5ldyBzdGF0dXMuAAAAAAAAB2FwcHJvdmUAAAAAAgAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPpAAAH0AAAAA5Qcm9wb3NhbFN0YXR1cwAAAAAH0AAAAA1UcmVhc3VyeUVycm9yAAAA",
        "AAAAAAAAABxUcmVhc3VyeSBiYWxhbmNlIG9mIGB0b2tlbmAuAAAAB2JhbGFuY2UAAAAAAQAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAKlFeGVjdXRlcyBhIHF1ZXVlZCBwcm9wb3NhbCBvbmNlIGl0cyB0aW1lbG9jayBoYXMgZWxhcHNlZCBhbmQgYmVmb3JlIGl0cwpleGVjdXRpb24gd2luZG93IGNsb3Nlcy4gQWxsIGFjdGlvbnMgcnVuIGF0b21pY2FsbHk6IGlmIG9uZSBmYWlscywgdGhlCndob2xlIHRyYW5zYWN0aW9uIHJldmVydHMuAAAAAAAAB2V4ZWN1dGUAAAAAAgAAAAAAAAAIZXhlY3V0b3IAAAATAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPpAAAAAgAAB9AAAAANVHJlYXN1cnlFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAHbWVtYmVycwAAAAABAAAAAAAAAARyb2xlAAAH0AAAAARSb2xlAAAAAQAAA+oAAAAT",
        "AAAAAAAAAHhDcmVhdGVzIGEgcHJvcG9zYWwgYnVuZGxpbmcgMSB0byAxMCBhY3Rpb25zLiBSZXR1cm5zIGl0cyBpZC4KClJlcXVpcmVzIHRoZSBwcm9wb3NlciByb2xlIGFuZCBgcHJvcG9zZXJgJ3MgYXV0aG9yaXNhdGlvbi4AAAAHcHJvcG9zZQAAAAADAAAAAAAAAAhwcm9wb3NlcgAAABMAAAAAAAAAB2FjdGlvbnMAAAAD6gAAB9AAAAAGQWN0aW9uAAAAAAAAAAAABG1lbW8AAAAQAAAAAQAAA+kAAAAGAAAH0AAAAA1UcmVhc3VyeUVycm9yAAAA",
        "AAAAAAAAAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABHJvbGUAAAfQAAAABFJvbGUAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAAAAAAAMZ2V0X3Byb3Bvc2FsAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6QAAB9AAAAAIUHJvcG9zYWwAAAfQAAAADVRyZWFzdXJ5RXJyb3IAAAA=",
        "AAAAAAAAASpEZXBsb3lzIGEgdHJlYXN1cnkuCgpUaGUgdHJlYXN1cnkgYmVjb21lcyBpdHMgb3duIGFjY2Vzcy1jb250cm9sIGFkbWluLCBzbyBmcm9tIHRoaXMgcG9pbnQgb24Kbm8ga2V5IOKAlCBub3QgZXZlbiB0aGUgZGVwbG95ZXIg4oCUIGNhbiBjaGFuZ2Ugcm9sZXMgb3IgY29uZmlnIGRpcmVjdGx5LgoKRmFpbHMgd2l0aCBgRW1wdHlSb2xlYCwgYFRvb01hbnlNZW1iZXJzYCwgYER1cGxpY2F0ZU1lbWJlcmAsCmBJbnZhbGlkVGhyZXNob2xkYCBvciBgSW52YWxpZER1cmF0aW9uYCB3aGVuIHRoZSBpbnB1dHMgYXJlIGludmFsaWQuAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAQAAAAAAAAACWFwcHJvdmVycwAAAAAAA+oAAAATAAAAAAAAAAlwcm9wb3NlcnMAAAAAAAPqAAAAEwAAAAAAAAAJZXhlY3V0b3JzAAAAAAAD6gAAABMAAAAAAAAABmNvbmZpZwAAAAAH0AAAAAZDb25maWcAAAAAAAA=",
        "AAAAAAAAAFpSZXR1cm5zIHVwIHRvIGBsaW1pdGAgKG1heCAyMCkgcHJvcG9zYWxzIHdpdGggaWRzIGBzdGFydCwgc3RhcnQgKyAxLCAuLi5gLgpJZHMgc3RhcnQgYXQgMS4AAAAAAA1nZXRfcHJvcG9zYWxzAAAAAAAAAgAAAAAAAAAFc3RhcnQAAAAAAAAGAAAAAAAAAAVsaW1pdAAAAAAAAAQAAAABAAAD6gAAB9AAAAAIUHJvcG9zYWw=",
        "AAAAAAAAAD9OdW1iZXIgb2YgcHJvcG9zYWxzIGV2ZXIgY3JlYXRlZC4gSWRzIHJ1biBmcm9tIDEgdG8gdGhpcyB2YWx1ZS4AAAAADnByb3Bvc2FsX2NvdW50AAAAAAAAAAAAAQAAAAY=",
        "AAAAAAAAAE5DdXJyZW50IHN0YXRlIG9mIGEgcHJvcG9zYWwsIHRha2luZyB0aGUgY2xvY2sgYW5kIGNvbmZpZyB2ZXJzaW9uIGludG8KYWNjb3VudC4AAAAAAA5wcm9wb3NhbF9zdGF0ZQAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6QAAB9AAAAANUHJvcG9zYWxTdGF0ZQAAAAAAB9AAAAANVHJlYXN1cnlFcnJvcgAAAA==",
        "AAAAAAAAAINJbmNyZW1lbnRlZCBldmVyeSB0aW1lIGFuIGV4ZWN1dGVkIHByb3Bvc2FsIGNoYW5nZXMgbWVtYmVyc2hpcCwgY29uZmlnCm9yIGNvZGUuIFByb3Bvc2FscyBjcmVhdGVkIHVuZGVyIGFuIG9sZGVyIHZlcnNpb24gYXJlIHN0YWxlLgAAAAASZ2V0X2NvbmZpZ192ZXJzaW9uAAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAGlUaGUgc3BlbmRlcidzIGxpbWl0IGZvciBgdG9rZW5gIGFzIGl0IHN0YW5kcyBub3c6IGlmIHRoZSBzdG9yZWQgd2luZG93CmhhcyBwYXNzZWQsIGBzcGVudGAgcmVhZHMgYXMgemVyby4AAAAAAAASZ2V0X3NwZW5kaW5nX2xpbWl0AAAAAAACAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAEAAAPoAAAH0AAAAA1TcGVuZGluZ0xpbWl0AAAA",
        "AAAAAAAAAD9FdmVyeSByZWdpc3RlcmVkIHNwZW5kaW5nIGxpbWl0IChhdCBtb3N0IDUwKSwgYXMgaXQgc3RhbmRzIG5vdy4AAAAAE2dldF9zcGVuZGluZ19saW1pdHMAAAAAAAAAAAEAAAPqAAAH0AAAABJTcGVuZGluZ0xpbWl0RW50cnkAAA==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIGdyYW50ZWQuAAAAAAAAAAAAAAtSb2xlR3JhbnRlZAAAAAABAAAADHJvbGVfZ3JhbnRlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIHJldm9rZWQuAAAAAAAAAAAAAAtSb2xlUmV2b2tlZAAAAAABAAAADHJvbGVfcmV2b2tlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAEkFjY2Vzc0NvbnRyb2xFcnJvcgAAAAAACwAAAAAAAAAMVW5hdXRob3JpemVkAAAH0AAAAAAAAAALQWRtaW5Ob3RTZXQAAAAH0QAAAAAAAAAQSW5kZXhPdXRPZkJvdW5kcwAAB9IAAAAAAAAAEUFkbWluUm9sZU5vdEZvdW5kAAAAAAAH0wAAAAAAAAASUm9sZUNvdW50SXNOb3RaZXJvAAAAAAfUAAAAAAAAAAxSb2xlTm90Rm91bmQAAAfVAAAAAAAAAA9BZG1pbkFscmVhZHlTZXQAAAAH1gAAAAAAAAALUm9sZU5vdEhlbGQAAAAH1wAAAAAAAAALUm9sZUlzRW1wdHkAAAAH2AAAAAAAAAASVHJhbnNmZXJJblByb2dyZXNzAAAAAAfZAAAAAAAAABBNYXhSb2xlc0V4Y2VlZGVkAAAH2g==" ]),
      options
    )
  }
  public readonly fromJSON = {
    spend: this.txFromJSON<Result<void>>,
        cancel: this.txFromJSON<Result<void>>,
        reject: this.txFromJSON<Result<ProposalStatus>>,
        approve: this.txFromJSON<Result<ProposalStatus>>,
        balance: this.txFromJSON<i128>,
        execute: this.txFromJSON<Result<void>>,
        members: this.txFromJSON<Array<string>>,
        propose: this.txFromJSON<Result<u64>>,
        has_role: this.txFromJSON<boolean>,
        get_config: this.txFromJSON<Config>,
        get_proposal: this.txFromJSON<Result<Proposal>>,
        get_proposals: this.txFromJSON<Array<Proposal>>,
        proposal_count: this.txFromJSON<u64>,
        proposal_state: this.txFromJSON<Result<ProposalState>>,
        get_config_version: this.txFromJSON<u32>,
        get_spending_limit: this.txFromJSON<Option<SpendingLimit>>,
        get_spending_limits: this.txFromJSON<Array<SpendingLimitEntry>>
  }
}