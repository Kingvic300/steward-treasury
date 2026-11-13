/** Maps contract, host and wallet failures to messages a person can act on. */

export const TREASURY_ERRORS: Record<number, { name: string; message: string }> = {
  1: { name: "InvalidThreshold", message: "The threshold must be at least 1 and no more than the number of approvers." },
  2: { name: "EmptyRole", message: "Every role needs at least one member." },
  3: { name: "TooManyMembers", message: "A role can hold at most 20 members." },
  4: { name: "DuplicateMember", message: "The same address appears twice in one role." },
  5: { name: "InvalidDuration", message: "The voting period and execution window must be longer than zero." },
  6: { name: "NotProposer", message: "This wallet does not hold the proposer role." },
  7: { name: "NotApprover", message: "This wallet does not hold the approver role." },
  8: { name: "NotExecutor", message: "This wallet does not hold the executor role." },
  9: { name: "NoActions", message: "Add at least one action to the proposal." },
  10: { name: "TooManyActions", message: "A proposal can hold at most 10 actions." },
  11: { name: "MemoTooLong", message: "The memo is longer than 256 bytes." },
  12: { name: "InvalidAmount", message: "Amounts must be greater than zero." },
  13: { name: "InvalidPeriod", message: "The spending period must be longer than zero." },
  14: { name: "ProposalNotFound", message: "No proposal exists with this id." },
  15: { name: "AlreadyVoted", message: "This wallet already voted on the proposal." },
  16: { name: "ProposalNotPending", message: "Voting on this proposal has closed." },
  17: { name: "VotingClosed", message: "The voting period has ended." },
  18: { name: "ProposalStale", message: "Treasury settings changed after this proposal was created. Create it again." },
  19: { name: "NotQueued", message: "The proposal has not been approved yet." },
  20: { name: "TimelockActive", message: "The timelock is still running. Wait until the proposal is ready." },
  21: { name: "ExecutionWindowExpired", message: "The execution window has passed. Create the proposal again." },
  22: { name: "NotProposalCreator", message: "Only the wallet that created the proposal can cancel it." },
  23: { name: "CannotCancel", message: "This proposal is already finished and cannot be cancelled." },
  24: { name: "MemberAlreadyExists", message: "This address already holds that role." },
  25: { name: "MemberNotFound", message: "This address does not hold that role." },
  26: { name: "LastMember", message: "The last member of a role cannot be removed. Add a replacement first." },
  27: { name: "NoSpendingLimit", message: "This wallet has no spending limit for that token." },
  28: { name: "SpendingLimitExceeded", message: "This spend is more than what is left of the limit for the current period." },
  29: { name: "Overflow", message: "A number in this request is too large." },
  30: { name: "AlreadyExecuted", message: "This proposal was already executed." },
  31: { name: "TooManySpendingLimits", message: "The treasury already tracks the maximum of 50 spending limits." },
  // OpenZeppelin access control (never expected, listed so nothing is opaque)
  2000: { name: "Unauthorized", message: "This wallet is not authorised for that role change." },
  2007: { name: "RoleNotHeld", message: "This address does not hold that role." },
};

export interface FriendlyError {
  /** Contract error code, when the failure came from the treasury. */
  code?: number;
  name: string;
  message: string;
}

const CONTRACT_ERROR = /Error\(Contract, #(\d+)\)/;

export function parseError(error: unknown): FriendlyError {
  const text =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);

  // A failing token call also reads "Error(Contract, #n)", but with the token's
  // own numbering. Recognise those by their diagnostic text before mapping codes.
  if (/balance is not sufficient|insufficient balance|resulting balance is not within/i.test(text)) {
    return { name: "InsufficientBalance", message: "There is not enough balance to cover this transfer." };
  }
  if (/trustline/i.test(text)) {
    return { name: "TrustlineMissing", message: "The recipient has no trustline for this asset." };
  }
  const contract = CONTRACT_ERROR.exec(text);
  if (contract) {
    const code = Number(contract[1]);
    const known = TREASURY_ERRORS[code];
    return known
      ? { code, ...known }
      : { code, name: "ContractError", message: `The contract rejected this with error #${code}.` };
  }
  if (/reject|denied|declin|cancel|closed the modal/i.test(text)) {
    return { name: "Rejected", message: "The request was cancelled in the wallet." };
  }
  if (/Error\(Auth,/i.test(text)) {
    return { name: "Unauthorized", message: "The connected wallet is not authorised to sign for this action." };
  }
  if (/Error\(Budget,/i.test(text)) {
    return { name: "BudgetExceeded", message: "This transaction needs more resources than the network allows. Split it into smaller proposals." };
  }
  if (/not found|Account not found|404/i.test(text) && /account/i.test(text)) {
    return { name: "AccountNotFound", message: "This account is not funded on testnet yet. Fund it with Friendbot first." };
  }
  if (/timeout|timed out|network|fetch failed|Failed to fetch|503|502/i.test(text)) {
    return { name: "Network", message: "The Stellar RPC did not respond. Check your connection and try again." };
  }
  if (/Error\(WasmVm|HostError|Error\(/.test(text)) {
    return { name: "HostError", message: "The network rejected this transaction during simulation. One of the actions would fail." };
  }
  return { name: "Unknown", message: text.length > 220 ? `${text.slice(0, 220)}…` : text || "Something went wrong." };
}
