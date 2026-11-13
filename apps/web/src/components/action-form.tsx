"use client";

import { Role } from "@steward/treasury-client";
import { ROLE_LABELS, type ActionDraft, type DraftErrors } from "@/lib/actions";
import { formatDuration } from "@/lib/format";
import type { TokenInfo } from "@/lib/network";
import { Field, Input, Select, Textarea } from "./ui/input";

export const PERIOD_PRESETS = [
  { label: "Hourly", seconds: 3_600 },
  { label: "Daily", seconds: 86_400 },
  { label: "Weekly", seconds: 604_800 },
  { label: "Every 30 days", seconds: 2_592_000 },
];

const INVOKE_EXAMPLE = `[
  { "type": "address", "value": "G…" },
  { "type": "i128", "value": "10000000" }
]`;

/** The typed form for one action. Field ids are prefixed so several can share a page. */
export function ActionFields({
  draft,
  onChange,
  errors,
  tokens,
  idPrefix,
}: {
  draft: ActionDraft;
  onChange: (draft: ActionDraft) => void;
  errors: DraftErrors;
  tokens: TokenInfo[];
  idPrefix: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  const invalid = (name: string) => (errors[name] ? { "aria-invalid": true, "aria-describedby": `${id(name)}-error` } : {});
  const set = (patch: Record<string, string>) => onChange({ ...draft, ...patch } as ActionDraft);

  const tokenField = (value: string) => (
    <Field label="Token" htmlFor={id("token")} error={errors.token}>
      <Select id={id("token")} value={value} onChange={(e) => set({ token: e.target.value })} {...invalid("token")}>
        <option value="">Choose a token</option>
        {tokens.map((token) => (
          <option key={token.id} value={token.id}>
            {token.symbol} · {token.name}
          </option>
        ))}
      </Select>
    </Field>
  );
  const symbol = (tokenId: string) => tokens.find((t) => t.id === tokenId)?.symbol;
  const addressField = (name: string, label: string, value: string, hint?: string) => (
    <Field label={label} htmlFor={id(name)} error={errors[name]} hint={hint}>
      <Input
        id={id(name)}
        value={value}
        onChange={(e) => set({ [name]: e.target.value })}
        placeholder="G… or C…"
        className="font-mono"
        spellCheck={false}
        autoComplete="off"
        {...invalid(name)}
      />
    </Field>
  );
  const amountField = (value: string, tokenId: string, label = "Amount") => (
    <Field label={label} htmlFor={id("amount")} error={errors.amount}>
      <div className="relative">
        <Input
          id={id("amount")}
          value={value}
          onChange={(e) => set({ amount: e.target.value })}
          inputMode="decimal"
          placeholder="0.00"
          className="pr-16 font-mono tabular"
          autoComplete="off"
          {...invalid("amount")}
        />
        {symbol(tokenId) && (
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">
            {symbol(tokenId)}
          </span>
        )}
      </div>
    </Field>
  );
  const secondsField = (label: string, value: string, hint: string) => {
    const preview = /^\d+$/.test(value.trim()) ? formatDuration(Number(value)) : null;
    return (
      <Field label={label} htmlFor={id("seconds")} error={errors.seconds} hint={preview ? `${hint} That is ${preview}.` : hint}>
        <Input
          id={id("seconds")}
          value={value}
          onChange={(e) => set({ seconds: e.target.value })}
          inputMode="numeric"
          placeholder="Seconds"
          className="font-mono tabular"
          {...invalid("seconds")}
        />
      </Field>
    );
  };

  switch (draft.kind) {
    case "Transfer":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {tokenField(draft.token)}
          {amountField(draft.amount, draft.token)}
          <div className="sm:col-span-2">{addressField("to", "Recipient", draft.to)}</div>
        </div>
      );
    case "AddMember":
    case "RemoveMember":
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          {addressField("account", "Address", draft.account)}
          <Field label="Role" htmlFor={id("role")} error={errors.role}>
            <Select id={id("role")} value={draft.role} onChange={(e) => set({ role: e.target.value })}>
              {[Role.Approver, Role.Proposer, Role.Executor].map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case "SetThreshold":
      return (
        <Field
          label="Approvals required"
          htmlFor={id("threshold")}
          error={errors.threshold}
          hint="Must not exceed the number of approvers once every action in this proposal has run."
        >
          <Input
            id={id("threshold")}
            value={draft.threshold}
            onChange={(e) => set({ threshold: e.target.value })}
            inputMode="numeric"
            className="max-w-32 font-mono tabular"
            {...invalid("threshold")}
          />
        </Field>
      );
    case "SetTimelockDelay":
      return secondsField("Timelock, in seconds", draft.seconds, "Use 0 to remove the delay.");
    case "SetVotingPeriod":
      return secondsField("Voting period, in seconds", draft.seconds, "How long new proposals stay open.");
    case "SetExecutionWindow":
      return secondsField("Execution window, in seconds", draft.seconds, "How long approved proposals stay executable.");
    case "SetSpendingLimit":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{addressField("spender", "Spender", draft.spender, "This address can spend without a proposal, up to the limit.")}</div>
          {tokenField(draft.token)}
          {amountField(draft.amount, draft.token, "Limit per period")}
          <Field label="Period" htmlFor={id("period")} error={errors.period} hint="Unused allowance does not carry over.">
            <Select id={id("period")} value={draft.period} onChange={(e) => set({ period: e.target.value })}>
              {PERIOD_PRESETS.map((preset) => (
                <option key={preset.seconds} value={preset.seconds}>
                  {preset.label}
                </option>
              ))}
              {!PERIOD_PRESETS.some((preset) => String(preset.seconds) === draft.period) && (
                <option value={draft.period}>Every {formatDuration(Number(draft.period) || 0)}</option>
              )}
            </Select>
          </Field>
        </div>
      );
    case "RemoveSpendingLimit":
      return (
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          {addressField("spender", "Spender", draft.spender)}
          {tokenField(draft.token)}
        </div>
      );
    case "Invoke":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contract" htmlFor={id("contract")} error={errors.contract}>
            <Input
              id={id("contract")}
              value={draft.contract}
              onChange={(e) => set({ contract: e.target.value })}
              placeholder="C…"
              className="font-mono"
              spellCheck={false}
              {...invalid("contract")}
            />
          </Field>
          <Field label="Function" htmlFor={id("fn")} error={errors.fn}>
            <Input
              id={id("fn")}
              value={draft.fn}
              onChange={(e) => set({ fn: e.target.value })}
              placeholder="transfer"
              className="font-mono"
              spellCheck={false}
              {...invalid("fn")}
            />
          </Field>
          <Field
            className="sm:col-span-2"
            label="Arguments, as a JSON list"
            htmlFor={id("args")}
            error={errors.args}
            hint="Types: address, i128, u128, i64, u64, i32, u32, bool, string, symbol, bytes (hex)."
          >
            <Textarea
              id={id("args")}
              value={draft.args}
              onChange={(e) => set({ args: e.target.value })}
              placeholder={INVOKE_EXAMPLE}
              rows={5}
              className="font-mono text-[0.8125rem]"
              spellCheck={false}
              {...invalid("args")}
            />
          </Field>
        </div>
      );
    case "Upgrade":
      return (
        <Field
          label="Wasm hash"
          htmlFor={id("wasmHash")}
          error={errors.wasmHash}
          hint="The hash of a Wasm already uploaded to the network. The treasury keeps its address, funds and settings."
        >
          <Input
            id={id("wasmHash")}
            value={draft.wasmHash}
            onChange={(e) => set({ wasmHash: e.target.value })}
            placeholder="64 hex characters"
            className="font-mono"
            spellCheck={false}
            {...invalid("wasmHash")}
          />
        </Field>
      );
  }
}
