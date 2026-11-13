"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AddressPill, TxLink } from "@/components/address";
import { PageHeader } from "@/components/app-shell";
import { useNow } from "@/components/countdown";
import { ProposalRow } from "@/components/proposal-row";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { EmptyState, Notice, Panel, PanelHeader, Skeleton } from "@/components/ui/misc";
import { emptyDraft, isContract, prefillHref } from "@/lib/actions";
import { parseError } from "@/lib/errors";
import { describeEvent, useActivity } from "@/lib/events";
import { formatAmount, formatDuration, formatRelative } from "@/lib/format";
import { addCustomToken } from "@/lib/storage";
import { ProposalState, deriveState, fetchTokenInfo, rolesOf, useBalances, useOverview, useProposals } from "@/lib/treasury";
import { useTokens } from "@/lib/use-tokens";
import { useWallet } from "@/lib/wallet";

function AddToken({ treasuryId }: { treasuryId: string }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus aria-hidden /> Track a token
        </Button>
      </DialogTrigger>
      <DialogContent title="Track a token" description="Steward reads the symbol and decimals from the token contract.">
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!isContract(id.trim())) return setError("Enter the token's contract address (C…).");
            setBusy(true);
            try {
              const info = await fetchTokenInfo(id.trim());
              addCustomToken(treasuryId, info);
              toast.success(`Tracking ${info.symbol}`);
              setOpen(false);
              setId("");
            } catch (cause) {
              setError(`This contract did not answer as a token. ${parseError(cause).message}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Token contract" htmlFor="token-id" error={error}>
            <Input id="token-id" value={id} onChange={(e) => { setId(e.target.value); setError(undefined); }} placeholder="C…" className="font-mono" spellCheck={false} />
          </Field>
          <Button type="submit" loading={busy} className="justify-self-end">Track token</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address } = useWallet();
  const now = useNow();
  const tokens = useTokens(id);
  const overview = useOverview(id);
  const balances = useBalances(id, tokens);
  const proposals = useProposals(id, overview.data?.proposalCount);
  const activity = useActivity(id);

  if (overview.isError) {
    return (
      <Notice tone="danger" title="This treasury could not be loaded">
        {parseError(overview.error).message} Check that the address is a Steward treasury on testnet.
      </Notice>
    );
  }

  const data = overview.data;
  const roles = rolesOf(data?.members, address);
  const all = proposals.data?.pages.flat() ?? [];
  const withState = data ? all.map((proposal) => ({ proposal, state: deriveState(proposal, data.config, data.configVersion, now) })) : [];
  const needsApproval = withState.filter(
    ({ proposal, state }) => state === ProposalState.Pending && roles.approver && !proposal.votes.some((vote) => vote.voter === address),
  );
  const ready = withState.filter(({ state }) => state === ProposalState.Ready);
  const rowProps = data && {
    treasuryId: id,
    threshold: data.config.threshold,
    approverCount: data.members.approvers.length,
    executionWindow: data.config.execution_window,
    tokens,
    now,
  };

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Overview"
        description={
          data ? (
            `${data.config.threshold} of ${data.members.approvers.length} approvers, ${data.config.timelock_delay === 0n ? "no timelock" : `${formatDuration(data.config.timelock_delay)} timelock`}`
          ) : (
            <Skeleton className="h-5 w-56" />
          )
        }
        action={
          <Button asChild>
            <Link href={`/t/${id}/proposals/new`} data-testid="new-proposal">New proposal</Link>
          </Button>
        }
      />

      <section aria-labelledby="balances" className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 id="balances" className="text-base font-semibold">Balances</h2>
          <AddToken treasuryId={id} />
        </div>
        <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          {tokens.map((token) => {
            const value = balances.data?.[token.id];
            return (
              <li key={token.id} className="grid gap-3 bg-background p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted">{token.name}</span>
                  <AddressPill address={token.id} className="[&>span:first-child]:hidden" />
                </div>
                {balances.isLoading ? (
                  <Skeleton className="h-8 w-40" />
                ) : (
                  <p className="font-mono text-2xl tabular" data-testid={`balance-${token.symbol}`}>
                    {value === null || value === undefined ? "Unavailable" : formatAmount(value, token.decimals)}{" "}
                    <span className="text-sm text-muted">{token.symbol}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Panel as="section" aria-labelledby="inbox-approve">
          <PanelHeader title="Needs your approval" description={roles.approver ? undefined : address ? "The connected wallet is not an approver." : "Connect a wallet to see what waits for you."} />
          {!rowProps || proposals.isLoading ? (
            <div className="grid gap-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : needsApproval.length === 0 ? (
            <EmptyState title="Nothing to approve">Proposals you have not voted on yet appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {needsApproval.map(({ proposal, state }) => (
                <ProposalRow key={proposal.id.toString()} proposal={proposal} state={state} {...rowProps} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel as="section" aria-labelledby="inbox-ready">
          <PanelHeader title="Ready to execute" description={roles.executor ? "You are an executor." : "An executor can run these now."} />
          {!rowProps || proposals.isLoading ? (
            <div className="grid gap-3 p-5"><Skeleton className="h-12" /></div>
          ) : ready.length === 0 ? (
            <EmptyState title="Nothing is ready">Approved proposals appear here once their timelock ends.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {ready.map(({ proposal, state }) => (
                <ProposalRow key={proposal.id.toString()} proposal={proposal} state={state} {...rowProps} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <Panel as="section">
          <PanelHeader title="Recent activity" description="From the network's event feed, which keeps only the last few days." />
          {activity.isLoading ? (
            <div className="grid gap-3 p-5"><Skeleton className="h-6" /><Skeleton className="h-6" /><Skeleton className="h-6" /></div>
          ) : activity.isError ? (
            <EmptyState title="Activity is unavailable">The RPC node did not return events. Balances and proposals are unaffected.</EmptyState>
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState title="No recent activity">Events from the last day appear here.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {(activity.data ?? []).slice(0, 12).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <span>{describeEvent(item)}</span>
                  <span className="flex items-center gap-3 text-muted">
                    {formatRelative(Date.parse(item.closedAt) / 1000)}
                    <TxLink hash={item.txHash} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel as="section">
          <PanelHeader title="Quick actions" description="Each one opens a proposal draft." />
          <div className="grid gap-2 p-5">
            {[
              { label: "Send tokens", draft: emptyDraft("Transfer", tokens[0]?.id) },
              { label: "Set a spending limit", draft: emptyDraft("SetSpendingLimit", tokens[0]?.id) },
              { label: "Add a member", draft: emptyDraft("AddMember") },
              { label: "Change the threshold", draft: emptyDraft("SetThreshold") },
            ].map((item) => (
              <Button key={item.label} asChild variant="secondary" className="justify-start">
                <Link href={prefillHref(id, item.draft)}>{item.label}</Link>
              </Button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
