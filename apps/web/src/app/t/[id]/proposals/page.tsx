"use client";

import Link from "next/link";
import { use } from "react";
import { PageHeader } from "@/components/app-shell";
import { useNow } from "@/components/countdown";
import { ProposalRow } from "@/components/proposal-row";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseError } from "@/lib/errors";
import { ProposalState, deriveState, useOverview, useProposals } from "@/lib/treasury";
import { useTokens } from "@/lib/use-tokens";

const TABS = [
  { key: "active", label: "Active", states: [ProposalState.Pending], empty: "No proposals are open for voting." },
  { key: "queued", label: "Queued", states: [ProposalState.Queued], empty: "No proposals are waiting in the timelock." },
  { key: "ready", label: "Ready", states: [ProposalState.Ready], empty: "No proposals are ready to execute." },
  {
    key: "history",
    label: "History",
    states: [ProposalState.Executed, ProposalState.Cancelled, ProposalState.Rejected, ProposalState.Expired, ProposalState.Stale],
    empty: "Finished proposals appear here.",
  },
];

export default function ProposalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const now = useNow();
  const tokens = useTokens(id);
  const overview = useOverview(id);
  const proposals = useProposals(id, overview.data?.proposalCount);
  const data = overview.data;

  const all = proposals.data?.pages.flat() ?? [];
  const withState = data ? all.map((proposal) => ({ proposal, state: deriveState(proposal, data.config, data.configVersion, now) })) : [];
  const loading = !data || proposals.isLoading;
  const firstWithItems = TABS.find((tab) => withState.some((item) => tab.states.includes(item.state)))?.key ?? "active";

  return (
    <div>
      <PageHeader
        title="Proposals"
        description={data ? `${data.proposalCount} created so far` : undefined}
        action={
          <Button asChild>
            <Link href={`/t/${id}/proposals/new`} data-testid="new-proposal">New proposal</Link>
          </Button>
        }
      />
      {overview.isError && <Notice tone="danger">{parseError(overview.error).message}</Notice>}

      <Tabs key={loading ? "loading" : "loaded"} defaultValue={firstWithItems}>
        <TabsList aria-label="Proposal states">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} data-testid={`tab-${tab.key}`}>
              {tab.label}
              <span className="rounded-full bg-raised px-1.5 font-mono text-xs tabular text-muted">
                {withState.filter((item) => tab.states.includes(item.state)).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => {
          const items = withState.filter((item) => tab.states.includes(item.state));
          return (
            <TabsContent key={tab.key} value={tab.key} className="pt-5">
              <Panel>
                {loading ? (
                  <div className="grid gap-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
                ) : items.length === 0 ? (
                  <EmptyState title={tab.empty} />
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map(({ proposal, state }) => (
                      <ProposalRow
                        key={proposal.id.toString()}
                        treasuryId={id}
                        proposal={proposal}
                        state={state}
                        threshold={data.config.threshold}
                        approverCount={data.members.approvers.length}
                        executionWindow={data.config.execution_window}
                        tokens={tokens}
                        now={now}
                      />
                    ))}
                  </ul>
                )}
              </Panel>
            </TabsContent>
          );
        })}
      </Tabs>

      {proposals.hasNextPage && (
        <div className="mt-5 flex items-center gap-4">
          <Button variant="secondary" onClick={() => proposals.fetchNextPage()} loading={proposals.isFetchingNextPage}>
            Load older proposals
          </Button>
          <span className="text-sm text-muted">Showing the newest {all.length}.</span>
        </div>
      )}
    </div>
  );
}
