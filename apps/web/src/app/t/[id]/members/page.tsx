"use client";

import Link from "next/link";
import { use } from "react";
import { Role } from "@steward/treasury-client";
import { AddressPill } from "@/components/address";
import { PageHeader } from "@/components/app-shell";
import { Seals } from "@/components/seals";
import { Button } from "@/components/ui/button";
import { Notice, Panel, PanelHeader, Skeleton } from "@/components/ui/misc";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, prefillHref } from "@/lib/actions";
import { parseError } from "@/lib/errors";
import { useOverview } from "@/lib/treasury";
import { useWallet } from "@/lib/wallet";

export default function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const overview = useOverview(id);
  const { address } = useWallet();
  const data = overview.data;
  const groups = [
    { role: Role.Approver, members: data?.members.approvers },
    { role: Role.Proposer, members: data?.members.proposers },
    { role: Role.Executor, members: data?.members.executors },
  ];

  return (
    <div className="grid gap-8">
      <PageHeader title="Members" description="Roles change only through an executed proposal. The buttons here open a draft; they change nothing by themselves." />
      {overview.isError && <Notice tone="danger">{parseError(overview.error).message}</Notice>}

      <Panel as="section" className="flex flex-wrap items-center justify-between gap-6 p-5">
        <div className="flex items-center gap-5">
          {data ? <Seals total={data.members.approvers.length} threshold={data.config.threshold} approvals={0} size="lg" /> : <Skeleton className="h-8 w-32" />}
          <div className="grid gap-0.5">
            <p className="font-mono text-xl tabular">{data ? `${data.config.threshold} of ${data.members.approvers.length}` : "…"}</p>
            <p className="text-sm text-muted">approvals needed to queue a proposal</p>
          </div>
        </div>
        <Button asChild variant="secondary">
          <Link href={prefillHref(id, { kind: "SetThreshold", threshold: data ? String(data.config.threshold) : "" })}>Propose a new threshold</Link>
        </Button>
      </Panel>

      <div className="grid gap-8 xl:grid-cols-3 xl:items-start">
        {groups.map(({ role, members }) => (
          <Panel as="section" key={role} data-testid={`role-${ROLE_LABELS[role].toLowerCase()}`}>
            <PanelHeader
              title={`${ROLE_LABELS[role]}s`}
              description={ROLE_DESCRIPTIONS[role]}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href={prefillHref(id, { kind: "AddMember", account: "", role: String(role) })}>Propose adding</Link>
                </Button>
              }
            />
            {!members ? (
              <div className="grid gap-3 p-5"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((member) => (
                  <li key={member} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <AddressPill address={member} you={member === address} />
                    {members.length > 1 ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={prefillHref(id, { kind: "RemoveMember", account: member, role: String(role) })}>Propose removal</Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted">Last member, cannot be removed</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
