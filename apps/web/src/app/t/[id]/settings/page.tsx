"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { xdr } from "@stellar/stellar-sdk";
import { AddressPill, CopyButton } from "@/components/address";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Notice, Panel, PanelHeader, Skeleton } from "@/components/ui/misc";
import { prefillHref, type ActionDraft } from "@/lib/actions";
import { formatDuration } from "@/lib/format";
import { demo, mainnetEnabled, network } from "@/lib/network";
import { forgetTreasury, saveTreasury } from "@/lib/storage";
import { rpcServer, useOverview } from "@/lib/treasury";
import { useSavedTreasuries } from "@/lib/use-tokens";

function useWasmHash(contractId: string) {
  return useQuery({
    queryKey: ["treasury", contractId, "wasm"],
    staleTime: 60_000,
    queryFn: async () => {
      const entry = await rpcServer().getContractData(contractId, xdr.ScVal.scvLedgerKeyContractInstance());
      return entry.val.contractData().val().instance().executable().wasmHash().toString("hex");
    },
  });
}

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const overview = useOverview(id);
  const wasm = useWasmHash(id);
  const saved = useSavedTreasuries().find((t) => t.id === id);
  const [name, setName] = useState<string>();
  const config = overview.data?.config;

  const rules: { label: string; value?: string; hint: string; draft: ActionDraft }[] = [
    { label: "Threshold", value: config && `${config.threshold} of ${overview.data?.members.approvers.length} approvers`, hint: "Approvals needed to queue a proposal.", draft: { kind: "SetThreshold", threshold: String(config?.threshold ?? "") } },
    { label: "Timelock", value: config && formatDuration(config.timelock_delay), hint: "Delay between approval and execution.", draft: { kind: "SetTimelockDelay", seconds: String(config?.timelock_delay ?? "") } },
    { label: "Voting period", value: config && formatDuration(config.voting_period), hint: "How long a proposal stays open for votes.", draft: { kind: "SetVotingPeriod", seconds: String(config?.voting_period ?? "") } },
    { label: "Execution window", value: config && formatDuration(config.execution_window), hint: "How long an approved proposal stays executable.", draft: { kind: "SetExecutionWindow", seconds: String(config?.execution_window ?? "") } },
  ];

  return (
    <div className="grid gap-8">
      <PageHeader title="Settings" description="Rules change only through an executed proposal. Each change raises the settings version and makes older open proposals stale." />

      <Panel as="section">
        <PanelHeader title="Rules" description={overview.data ? `Settings version ${overview.data.configVersion}` : undefined} />
        <dl className="divide-y divide-border">
          {rules.map((rule) => (
            <div key={rule.label} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="grid gap-0.5">
                <dt className="text-sm text-muted">{rule.label}</dt>
                <dd className="font-mono text-lg tabular" data-testid={`rule-${rule.label.toLowerCase().replace(/ /g, "-")}`}>{rule.value ?? <Skeleton className="h-6 w-28" />}</dd>
                <dd className="text-sm text-muted">{rule.hint}</dd>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href={prefillHref(id, rule.draft)}>Propose a change</Link>
              </Button>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        <Panel as="section">
          <PanelHeader title="Contract" />
          <dl className="grid gap-4 p-5 text-sm">
            <div className="grid gap-1">
              <dt className="text-muted">Contract id</dt>
              <dd><AddressPill address={id} full /></dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-muted">Wasm hash</dt>
              <dd className="flex items-start gap-1">
                {wasm.data ? (
                  <>
                    <span className="break-all font-mono text-[0.8125rem]" data-testid="wasm-hash">{wasm.data}</span>
                    <CopyButton value={wasm.data} label="Copy Wasm hash" />
                  </>
                ) : wasm.isError ? "Unavailable" : <Skeleton className="h-5 w-full" />}
              </dd>
              {wasm.data && (
                <dd className="text-muted">
                  {wasm.data === demo.wasmHash ? "Matches the build this app deploys." : "Differs from the build this app deploys. It may be an older or upgraded version."}
                </dd>
              )}
            </div>
            <div className="grid gap-1">
              <dt className="text-muted">RPC endpoint</dt>
              <dd className="break-all font-mono text-[0.8125rem]">{network.rpcUrl}</dd>
            </div>
          </dl>
        </Panel>

        <div className="grid gap-8">
          <Panel as="section">
            <PanelHeader title="Network" />
            <div className="grid gap-3 p-5">
              <Field label="Network" htmlFor="network" hint={mainnetEnabled ? undefined : "Mainnet stays disabled until the contract has been audited."}>
                <Select id="network" value="testnet" onChange={() => undefined}>
                  <option value="testnet">Testnet</option>
                  <option value="mainnet" disabled>Mainnet (disabled)</option>
                </Select>
              </Field>
              <Notice tone="warn">Steward is unaudited. Do not use it with real funds.</Notice>
            </div>
          </Panel>

          <Panel as="section">
            <PanelHeader title="This browser" description="The name and your list of treasuries are stored locally, not on chain." />
            <form
              className="grid gap-3 p-5"
              onSubmit={(event) => {
                event.preventDefault();
                saveTreasury(id, name ?? saved?.name ?? "Treasury");
              }}
            >
              <Field label="Name" htmlFor="treasury-name">
                <Input id="treasury-name" value={name ?? saved?.name ?? ""} onChange={(e) => setName(e.target.value)} placeholder="Treasury" maxLength={40} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="secondary">{saved ? "Save name" : "Add to my treasuries"}</Button>
                {saved && (
                  <Button type="button" variant="ghost" onClick={() => { forgetTreasury(id); router.push("/treasuries"); }}>
                    Remove from my list
                  </Button>
                )}
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
