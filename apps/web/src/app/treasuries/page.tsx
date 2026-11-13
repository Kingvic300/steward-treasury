"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Plus, Wallet } from "lucide-react";
import { AddressPill } from "@/components/address";
import { Seals } from "@/components/seals";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { isContract } from "@/lib/actions";
import { formatDuration } from "@/lib/format";
import { demo } from "@/lib/network";
import { forgetTreasury, type SavedTreasury } from "@/lib/storage";
import { rolesOf, useOverview } from "@/lib/treasury";
import { useSavedTreasuries } from "@/lib/use-tokens";
import { useWallet } from "@/lib/wallet";

function TreasuryCard({ treasury, isDemo }: { treasury: SavedTreasury; isDemo: boolean }) {
  const { address } = useWallet();
  const overview = useOverview(treasury.id);
  const data = overview.data;
  const roles = rolesOf(data?.members, address);
  const myRoles = [roles.proposer && "Proposer", roles.approver && "Approver", roles.executor && "Executor"].filter(Boolean) as string[];

  return (
    <li className="grid rounded-xl border border-border bg-background" data-testid="treasury-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="grid min-w-0 gap-1">
          <Link href={`/t/${treasury.id}`} className="truncate text-lg font-semibold tracking-tight hover:text-accent">
            {treasury.name}
          </Link>
          <AddressPill address={treasury.id} />
        </div>
        {isDemo ? <Badge tone="accent">Demo</Badge> : myRoles.length > 0 ? <Badge tone="ok">Member</Badge> : null}
      </div>

      <dl className="grid grid-cols-3 gap-px bg-border text-sm">
        <div className="grid gap-2 bg-background px-5 py-4">
          <dt className="text-xs text-muted">Threshold</dt>
          <dd>
            {data ? (
              <span className="grid gap-2">
                <span className="tabular">
                  {data.config.threshold} of {data.members.approvers.length}
                </span>
                <Seals total={data.members.approvers.length} threshold={data.config.threshold} approvals={data.config.threshold} size="sm" />
              </span>
            ) : (
              <Skeleton className="h-10 w-16" />
            )}
          </dd>
        </div>
        <div className="grid gap-2 bg-background px-5 py-4">
          <dt className="text-xs text-muted">Timelock</dt>
          <dd>{data ? formatDuration(data.config.timelock_delay) : <Skeleton className="h-5 w-16" />}</dd>
        </div>
        <div className="grid gap-2 bg-background px-5 py-4">
          <dt className="text-xs text-muted">Proposals</dt>
          <dd className="tabular">{data ? data.proposalCount : <Skeleton className="h-5 w-8" />}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
        <span className="text-xs text-muted">
          {overview.isError
            ? "Could not reach the network. Retrying."
            : !address
              ? "Connect a wallet to see your roles."
              : myRoles.length
                ? `You: ${myRoles.join(", ")}`
                : "You are not a member."}
        </span>
        <span className="flex gap-1">
          {!isDemo && (
            <Button variant="ghost" size="sm" onClick={() => forgetTreasury(treasury.id)}>
              Remove
            </Button>
          )}
          <Button asChild variant="secondary" size="sm">
            <Link href={`/t/${treasury.id}`}>
              Open <ArrowRight />
            </Link>
          </Button>
        </span>
      </div>
    </li>
  );
}

export default function TreasuriesPage() {
  const saved = useSavedTreasuries();
  const router = useRouter();
  const { address, connect, connecting } = useWallet();
  const [id, setId] = useState("");
  const [error, setError] = useState<string>();
  const hasDemo = saved.some((t) => t.id === demo.contractId);
  const list: SavedTreasury[] = [...saved, ...(hasDemo ? [] : [{ id: demo.contractId, name: "Demo treasury", addedAt: 0 }])];

  return (
    <div className="min-h-dvh bg-raised">
      <SiteHeader />
      <main id="main" className="container-page grid gap-10 py-12 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Treasuries</h1>
            <p className="text-muted">Treasuries you created or opened in this browser, plus the public demo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!address && (
              <Button variant="secondary" onClick={() => connect()} loading={connecting}>
                <Wallet /> Connect wallet
              </Button>
            )}
            <Button asChild>
              <Link href="/create">
                <Plus /> Create a treasury
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <ul className="grid gap-4 xl:grid-cols-2" data-testid="treasury-list">
            {list.map((treasury) => (
              <TreasuryCard key={treasury.id} treasury={treasury} isDemo={treasury.id === demo.contractId} />
            ))}
          </ul>

          <aside className="grid gap-4 lg:sticky lg:top-24">
            <form
              className="grid gap-4 rounded-xl border border-border bg-background p-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!isContract(id.trim())) return setError("Enter a contract address: C followed by 55 characters.");
                router.push(`/t/${id.trim()}`);
              }}
            >
              <Field label="Open by contract address" htmlFor="open-id" error={error} hint="Any Steward treasury on testnet.">
                <Input
                  id="open-id"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    setError(undefined);
                  }}
                  placeholder="C…"
                  className="font-mono"
                  spellCheck={false}
                  aria-invalid={!!error}
                />
              </Field>
              <Button type="submit" variant="secondary">
                Open treasury
              </Button>
            </form>
            <p className="px-1 text-sm text-muted">
              This list lives in this browser only. Steward keeps no account and no server-side record of you.
            </p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
