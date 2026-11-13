"use client";

import Link from "next/link";
import { use, useState } from "react";
import { AddressPill } from "@/components/address";
import { PageHeader } from "@/components/app-shell";
import { Countdown, useNow } from "@/components/countdown";
import { useTx } from "@/components/tx-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { emptyDraft, isAddress, prefillHref } from "@/lib/actions";
import { parseError } from "@/lib/errors";
import { formatAmount, formatDuration, parseAmount, truncateAddress } from "@/lib/format";
import type { TokenInfo } from "@/lib/network";
import { treasuryClient, useLimits, type SpendingLimitEntry } from "@/lib/treasury";
import { useTokens } from "@/lib/use-tokens";
import { useWallet } from "@/lib/wallet";

function SpendForm({ treasuryId, entry, token, remaining }: { treasuryId: string; entry: SpendingLimitEntry; token: TokenInfo; remaining: bigint }) {
  const tx = useTx();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ to?: string; amount?: string }>({});
  const key = truncateAddress(entry.token, 3, 3);

  return (
    <form
      className="grid gap-4 border-t border-border bg-raised/60 p-5 sm:grid-cols-[1fr_12rem_auto] sm:items-start"
      data-testid="spend-form"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseAmount(amount, token.decimals);
        const next: typeof errors = {};
        if (!isAddress(to.trim())) next.to = "Enter an account (G…) or contract (C…) address.";
        if (parsed === null || parsed <= 0n) next.amount = "Enter an amount greater than zero.";
        else if (parsed > remaining) next.amount = `Only ${formatAmount(remaining, token.decimals)} ${token.symbol} is left this period.`;
        setErrors(next);
        if (Object.keys(next).length > 0 || parsed === null) return;
        tx.run({
          title: `Spend ${formatAmount(parsed, token.decimals)} ${token.symbol}`,
          confirmLabel: "Spend",
          successLabel: "Spent",
          treasuryId,
          summary: (
            <p className="text-muted">
              Sends {formatAmount(parsed, token.decimals)} {token.symbol} from the treasury to {truncateAddress(to.trim(), 6, 6)} under your spending
              limit. No proposal or timelock applies.
            </p>
          ),
          build: (signer) => treasuryClient(treasuryId, signer).spend({ spender: signer.publicKey, token: entry.token, to: to.trim(), amount: parsed }),
          onSuccess: () => {
            setTo("");
            setAmount("");
          },
        });
      }}
    >
      <Field label="Pay to" htmlFor={`spend-to-${key}`} error={errors.to}>
        <Input id={`spend-to-${key}`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="G… or C…" className="font-mono" spellCheck={false} />
      </Field>
      <Field label={`Amount, ${token.symbol}`} htmlFor={`spend-amount-${key}`} error={errors.amount}>
        <Input id={`spend-amount-${key}`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="font-mono tabular" />
      </Field>
      <Button type="submit" className="sm:mt-[1.65rem]">Spend</Button>
    </form>
  );
}

export default function LimitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const limits = useLimits(id);
  const tokens = useTokens(id);
  const now = useNow();
  const { address } = useWallet();

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Spending limits"
        description="A limit lets one address pay from the treasury without a proposal, up to an amount per period. Limits skip the timelock, so keep them small."
        action={
          <Button asChild>
            <Link href={prefillHref(id, emptyDraft("SetSpendingLimit", tokens[0]?.id))}>Propose new limit</Link>
          </Button>
        }
      />
      {limits.isError && <Notice tone="danger">{parseError(limits.error).message}</Notice>}

      {limits.isLoading ? (
        <div className="grid gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : (limits.data ?? []).length === 0 ? (
        <Panel>
          <EmptyState title="No spending limits">
            Give an operations wallet or a service a capped allowance, so routine payments do not need a vote.
          </EmptyState>
        </Panel>
      ) : (
        <ul className="grid gap-5">
          {(limits.data ?? []).map((entry) => {
            const token = tokens.find((t) => t.id === entry.token) ?? { id: entry.token, symbol: truncateAddress(entry.token), name: "Unknown token", decimals: 7 };
            const { amount, spent, period, window_start: start } = entry.limit;
            const remaining = amount > spent ? amount - spent : 0n;
            const percent = amount > 0n ? Math.min(100, Number((spent * 10_000n) / amount) / 100) : 0;
            const mine = entry.spender === address;
            return (
              <Panel as="li" key={`${entry.spender}-${entry.token}`} className="overflow-hidden" data-testid="limit">
                <div className="grid gap-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <AddressPill address={entry.spender} you={mine} />
                    <span className="text-sm text-muted">
                      Every {formatDuration(period)}, resets in <Countdown to={start + period} now={now} className="text-foreground" />
                    </span>
                  </div>
                  <div
                    role="meter"
                    aria-label={`Spent this period, ${token.symbol}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(percent)}
                    className="h-3 overflow-hidden rounded-full bg-raised"
                  >
                    <div className={percent >= 100 ? "h-full rounded-full bg-danger" : "h-full rounded-full bg-accent"} style={{ width: `${percent}%` }} />
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-3 font-mono tabular">
                    <p className="text-xl" data-testid="limit-usage">
                      {formatAmount(spent, token.decimals)} <span className="text-sm text-muted">of {formatAmount(amount, token.decimals)} {token.symbol}</span>
                    </p>
                    <p className="text-sm text-muted">{formatAmount(remaining, token.decimals)} {token.symbol} left</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={prefillHref(id, { kind: "SetSpendingLimit", spender: entry.spender, token: entry.token, amount: "", period: period.toString() })}>Propose a change</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={prefillHref(id, { kind: "RemoveSpendingLimit", spender: entry.spender, token: entry.token })}>Propose removal</Link>
                    </Button>
                  </div>
                </div>
                {mine && <SpendForm treasuryId={id} entry={entry} token={token} remaining={remaining} />}
              </Panel>
            );
          })}
        </ul>
      )}
    </div>
  );
}
