/**
 * Action drafts: what the proposal builder's forms hold (all strings), how
 * they are validated, how they are encoded into the contract's `Action` type,
 * and how any action is described in plain words.
 */
import { Address, StrKey, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { Role, type Action } from "@steward/treasury-client";
import { formatAmount, formatDuration, parseAmount, truncateAddress } from "./format";
import type { TokenInfo } from "./network";

export const MAX_ACTIONS = 10;
export const MAX_MEMO_BYTES = 256;

export type ActionKind = Action["tag"];

export const ACTION_KINDS: { kind: ActionKind; label: string; hint: string; group: string }[] = [
  { kind: "Transfer", label: "Send tokens", hint: "Pay an address from the treasury", group: "Funds" },
  { kind: "SetSpendingLimit", label: "Set a spending limit", hint: "Let one address spend up to an amount per period", group: "Funds" },
  { kind: "RemoveSpendingLimit", label: "Remove a spending limit", hint: "Withdraw a spender's allowance", group: "Funds" },
  { kind: "AddMember", label: "Add a member", hint: "Grant the proposer, approver or executor role", group: "Members" },
  { kind: "RemoveMember", label: "Remove a member", hint: "Revoke a role from an address", group: "Members" },
  { kind: "SetThreshold", label: "Change the threshold", hint: "Approvals needed to queue a proposal", group: "Rules" },
  { kind: "SetTimelockDelay", label: "Change the timelock", hint: "Delay between approval and execution", group: "Rules" },
  { kind: "SetVotingPeriod", label: "Change the voting period", hint: "How long proposals stay open", group: "Rules" },
  { kind: "SetExecutionWindow", label: "Change the execution window", hint: "How long approved proposals stay executable", group: "Rules" },
  { kind: "Invoke", label: "Call a contract", hint: "Invoke any contract function as the treasury", group: "Advanced" },
  { kind: "Upgrade", label: "Upgrade the treasury", hint: "Replace the treasury's own code", group: "Advanced" },
];

export type ActionDraft =
  | { kind: "Transfer"; token: string; to: string; amount: string }
  | { kind: "Invoke"; contract: string; fn: string; args: string }
  | { kind: "AddMember" | "RemoveMember"; account: string; role: string }
  | { kind: "SetThreshold"; threshold: string }
  | { kind: "SetTimelockDelay" | "SetVotingPeriod" | "SetExecutionWindow"; seconds: string }
  | { kind: "SetSpendingLimit"; spender: string; token: string; amount: string; period: string }
  | { kind: "RemoveSpendingLimit"; spender: string; token: string }
  | { kind: "Upgrade"; wasmHash: string };

export function emptyDraft(kind: ActionKind, defaultToken = ""): ActionDraft {
  switch (kind) {
    case "Transfer":
      return { kind, token: defaultToken, to: "", amount: "" };
    case "Invoke":
      return { kind, contract: "", fn: "", args: "[]" };
    case "AddMember":
    case "RemoveMember":
      return { kind, account: "", role: String(Role.Approver) };
    case "SetThreshold":
      return { kind, threshold: "" };
    case "SetTimelockDelay":
    case "SetVotingPeriod":
    case "SetExecutionWindow":
      return { kind, seconds: "" };
    case "SetSpendingLimit":
      return { kind, spender: "", token: defaultToken, amount: "", period: "86400" };
    case "RemoveSpendingLimit":
      return { kind, spender: "", token: defaultToken };
    case "Upgrade":
      return { kind, wasmHash: "" };
  }
}

export const isAccount = (value: string) => StrKey.isValidEd25519PublicKey(value);
export const isContract = (value: string) => StrKey.isValidContract(value);
/** Any address the contract accepts: an account (G...) or a contract (C...). */
export const isAddress = (value: string) => isAccount(value) || isContract(value);

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Proposer]: "Proposer",
  [Role.Approver]: "Approver",
  [Role.Executor]: "Executor",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [Role.Proposer]: "Creates proposals and can cancel their own.",
  [Role.Approver]: "Votes to approve or reject proposals.",
  [Role.Executor]: "Runs approved proposals once the timelock ends.",
};

/** One typed argument for an Invoke action, as written in the builder. */
export interface InvokeArg {
  type: "address" | "i128" | "u128" | "u64" | "i64" | "u32" | "i32" | "bool" | "string" | "symbol" | "bytes";
  value: string | boolean | number;
}

const INVOKE_TYPES = new Set(["address", "i128", "u128", "u64", "i64", "u32", "i32", "bool", "string", "symbol", "bytes"]);

export function parseInvokeArgs(json: string): xdr.ScVal[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json || "[]");
  } catch {
    throw new Error("Arguments must be valid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("Arguments must be a JSON list.");
  return parsed.map((item, index) => {
    const where = `Argument ${index + 1}`;
    if (typeof item !== "object" || item === null || !("type" in item) || !("value" in item)) {
      throw new Error(`${where} must look like {"type": "...", "value": ...}.`);
    }
    const { type, value } = item as InvokeArg;
    if (!INVOKE_TYPES.has(type)) throw new Error(`${where} has an unknown type "${String(type)}".`);
    try {
      switch (type) {
        case "address":
          if (!isAddress(String(value))) throw new Error("not an address");
          return new Address(String(value)).toScVal();
        case "bool":
          if (typeof value !== "boolean") throw new Error("not a boolean");
          return xdr.ScVal.scvBool(value);
        case "string":
          return nativeToScVal(String(value), { type: "string" });
        case "symbol":
          return nativeToScVal(String(value), { type: "symbol" });
        case "bytes":
          if (!/^([0-9a-f]{2})*$/i.test(String(value))) throw new Error("not hex");
          return xdr.ScVal.scvBytes(Buffer.from(String(value), "hex"));
        default:
          return nativeToScVal(BigInt(value as string | number), { type });
      }
    } catch {
      throw new Error(`${where} is not a valid ${type}.`);
    }
  });
}

export type DraftErrors = Record<string, string>;

function positiveInteger(text: string): bigint | null {
  return /^\d+$/.test(text.trim()) ? BigInt(text.trim()) : null;
}

/** Returns field → message for everything wrong with a draft. Empty means valid. */
export function validateDraft(draft: ActionDraft, tokens: TokenInfo[]): DraftErrors {
  const errors: DraftErrors = {};
  const decimalsOf = (id: string) => tokens.find((t) => t.id === id)?.decimals;
  const requireAddress = (field: string, value: string, what = "an account (G…) or contract (C…) address") => {
    if (!value.trim()) errors[field] = "Enter an address.";
    else if (!isAddress(value.trim())) errors[field] = `This is not ${what}.`;
  };
  const requireToken = (value: string) => {
    if (!isContract(value.trim())) errors.token = "Choose a token.";
  };
  const requireAmount = (value: string, token: string) => {
    const decimals = decimalsOf(token) ?? 7;
    const parsed = parseAmount(value, decimals);
    if (!value.trim()) errors.amount = "Enter an amount.";
    else if (parsed === null) errors.amount = `Enter a number with at most ${decimals} decimals.`;
    else if (parsed <= 0n) errors.amount = "The amount must be greater than zero.";
  };

  switch (draft.kind) {
    case "Transfer":
      requireToken(draft.token);
      requireAddress("to", draft.to);
      requireAmount(draft.amount, draft.token);
      break;
    case "Invoke":
      if (!isContract(draft.contract.trim())) errors.contract = "Enter a contract address (C…).";
      if (!/^[A-Za-z0-9_]{1,32}$/.test(draft.fn.trim())) {
        errors.fn = "Enter the function name: letters, digits and underscores, up to 32 characters.";
      }
      try {
        parseInvokeArgs(draft.args);
      } catch (error) {
        errors.args = (error as Error).message;
      }
      break;
    case "AddMember":
    case "RemoveMember":
      requireAddress("account", draft.account);
      if (!(draft.role in ROLE_LABELS)) errors.role = "Choose a role.";
      break;
    case "SetThreshold": {
      const value = positiveInteger(draft.threshold);
      if (value === null || value < 1n || value > 20n) errors.threshold = "Enter a whole number from 1 to 20.";
      break;
    }
    case "SetTimelockDelay": {
      if (positiveInteger(draft.seconds) === null) errors.seconds = "Enter a duration in seconds (0 for none).";
      break;
    }
    case "SetVotingPeriod":
    case "SetExecutionWindow": {
      const value = positiveInteger(draft.seconds);
      if (value === null || value < 1n) errors.seconds = "Enter a duration longer than zero.";
      break;
    }
    case "SetSpendingLimit": {
      requireAddress("spender", draft.spender);
      requireToken(draft.token);
      requireAmount(draft.amount, draft.token);
      const period = positiveInteger(draft.period);
      if (period === null || period < 1n) errors.period = "Choose a period longer than zero.";
      break;
    }
    case "RemoveSpendingLimit":
      requireAddress("spender", draft.spender);
      requireToken(draft.token);
      break;
    case "Upgrade":
      if (!/^[0-9a-f]{64}$/i.test(draft.wasmHash.trim())) errors.wasmHash = "Enter the 64-character hex hash of an uploaded Wasm.";
      break;
  }
  return errors;
}

/** Encodes a valid draft into the contract's `Action`. Throws if it is invalid. */
export function encodeDraft(draft: ActionDraft, tokens: TokenInfo[]): Action {
  const problems = validateDraft(draft, tokens);
  const first = Object.values(problems)[0];
  if (first) throw new Error(first);
  const amountOf = (text: string, token: string) =>
    parseAmount(text, tokens.find((t) => t.id === token)?.decimals ?? 7) as bigint;

  switch (draft.kind) {
    case "Transfer":
      return { tag: "Transfer", values: [{ token: draft.token.trim(), to: draft.to.trim(), amount: amountOf(draft.amount, draft.token) }] };
    case "Invoke":
      return { tag: "Invoke", values: [{ contract: draft.contract.trim(), function: draft.fn.trim(), args: parseInvokeArgs(draft.args) }] };
    case "AddMember":
    case "RemoveMember":
      return { tag: draft.kind, values: [{ account: draft.account.trim(), role: Number(draft.role) as Role }] };
    case "SetThreshold":
      return { tag: "SetThreshold", values: [Number(draft.threshold)] };
    case "SetTimelockDelay":
    case "SetVotingPeriod":
    case "SetExecutionWindow":
      return { tag: draft.kind, values: [BigInt(draft.seconds.trim())] };
    case "SetSpendingLimit":
      return {
        tag: "SetSpendingLimit",
        values: [{ spender: draft.spender.trim(), token: draft.token.trim(), amount: amountOf(draft.amount, draft.token), period: BigInt(draft.period.trim()) }],
      };
    case "RemoveSpendingLimit":
      return { tag: "RemoveSpendingLimit", values: [{ spender: draft.spender.trim(), token: draft.token.trim() }] };
    case "Upgrade":
      return { tag: "Upgrade", values: [Buffer.from(draft.wasmHash.trim(), "hex")] };
  }
}

export interface ActionSummary {
  title: string;
  /** One sentence in plain words. */
  detail: string;
  /** Marks actions that change who controls the treasury or what code it runs. */
  sensitive: boolean;
}

/** Describes any on-chain action in plain words. */
export function describeAction(action: Action, tokens: TokenInfo[]): ActionSummary {
  const token = (id: string) => tokens.find((t) => t.id === id);
  const amount = (value: bigint, id: string) => {
    const info = token(id);
    return info
      ? `${formatAmount(value, info.decimals)} ${info.symbol}`
      : `${value.toString()} units of ${truncateAddress(id)}`;
  };
  const who = (address: string) => truncateAddress(address, 6, 6);

  switch (action.tag) {
    case "Transfer": {
      const [t] = action.values;
      return { title: "Send tokens", detail: `Send ${amount(t.amount, t.token)} to ${who(t.to)}.`, sensitive: false };
    }
    case "Invoke": {
      const [i] = action.values;
      const count = i.args.length;
      return {
        title: "Call a contract",
        detail: `Call ${i.function}() on ${who(i.contract)} with ${count} argument${count === 1 ? "" : "s"}, acting as the treasury.`,
        sensitive: true,
      };
    }
    case "AddMember": {
      const [m] = action.values;
      return { title: "Add a member", detail: `Give ${who(m.account)} the ${ROLE_LABELS[m.role].toLowerCase()} role.`, sensitive: true };
    }
    case "RemoveMember": {
      const [m] = action.values;
      return { title: "Remove a member", detail: `Take the ${ROLE_LABELS[m.role].toLowerCase()} role away from ${who(m.account)}.`, sensitive: true };
    }
    case "SetThreshold":
      return { title: "Change the threshold", detail: `Require ${action.values[0]} approval${action.values[0] === 1 ? "" : "s"} to queue a proposal.`, sensitive: true };
    case "SetTimelockDelay":
      return {
        title: "Change the timelock",
        detail: action.values[0] === 0n ? "Remove the timelock: approved proposals can run at once." : `Make approved proposals wait ${formatDuration(action.values[0])} before they can run.`,
        sensitive: true,
      };
    case "SetVotingPeriod":
      return { title: "Change the voting period", detail: `Keep new proposals open for voting for ${formatDuration(action.values[0])}.`, sensitive: true };
    case "SetExecutionWindow":
      return { title: "Change the execution window", detail: `Keep approved proposals executable for ${formatDuration(action.values[0])} after the timelock.`, sensitive: true };
    case "SetSpendingLimit": {
      const [l] = action.values;
      return {
        title: "Set a spending limit",
        detail: `Let ${who(l.spender)} spend up to ${amount(l.amount, l.token)} every ${formatDuration(l.period)}, with no proposal.`,
        sensitive: true,
      };
    }
    case "RemoveSpendingLimit": {
      const [k] = action.values;
      return { title: "Remove a spending limit", detail: `Remove ${who(k.spender)}'s spending limit for ${token(k.token)?.symbol ?? truncateAddress(k.token)}.`, sensitive: false };
    }
    case "Upgrade":
      return {
        title: "Upgrade the treasury",
        detail: `Replace the treasury's code with Wasm ${truncateAddress(Buffer.from(action.values[0]).toString("hex"), 8, 8)}.`,
        sensitive: true,
      };
  }
}

export function memoBytes(memo: string): number {
  return new TextEncoder().encode(memo).length;
}

/** Builds a link to the proposal builder with one action pre-filled. */
export function prefillHref(treasuryId: string, draft: ActionDraft): string {
  const params = new URLSearchParams({ prefill: JSON.stringify(draft) });
  return `/t/${treasuryId}/proposals/new?${params.toString()}`;
}

export function parsePrefill(value: string | null): ActionDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ActionDraft;
    if (!ACTION_KINDS.some((k) => k.kind === parsed.kind)) return null;
    return { ...emptyDraft(parsed.kind), ...parsed } as ActionDraft;
  } catch {
    return null;
  }
}
