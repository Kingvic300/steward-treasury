"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Check, Droplets, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { truncateAddress } from "@/lib/format";
import { demo, network } from "@/lib/network";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

type AccountState = { funded: false } | { funded: true; xlm: string };

async function fetchAccount(address: string): Promise<AccountState> {
  const response = await fetch(`${network.horizonUrl}/accounts/${address}`, { headers: { Accept: "application/json" } });
  // A Stellar account does not exist until it receives its first XLM.
  if (response.status === 404) return { funded: false };
  if (!response.ok) throw new Error("Could not read your account from the network.");
  const account = (await response.json()) as { balances?: { asset_type: string; balance: string }[] };
  const native = account.balances?.find((b) => b.asset_type === "native");
  return { funded: true, xlm: native?.balance ?? "0" };
}

/**
 * First screen after a wallet connects with no treasuries saved yet:
 * fund the account on testnet, then create a treasury or open the demo.
 */
export function Onboarding({ address }: { address: string }) {
  const queryClient = useQueryClient();
  const [funding, setFunding] = useState(false);
  const account = useQuery({ queryKey: ["account", address], queryFn: () => fetchAccount(address), refetchInterval: 15_000 });
  const funded = account.data?.funded === true;
  const xlm = account.data?.funded ? Number(account.data.xlm) : 0;

  async function fund() {
    setFunding(true);
    try {
      const response = await fetch(`${network.friendbotUrl}?addr=${encodeURIComponent(address)}`);
      if (!response.ok && response.status !== 400) throw new Error();
      // Friendbot answers 400 when the account is already funded; either way, re-read it.
      await queryClient.invalidateQueries({ queryKey: ["account", address] });
      toast.success("Account funded with 10,000 testnet XLM");
    } catch {
      toast.error("Friendbot did not respond. Try again in a moment.");
    } finally {
      setFunding(false);
    }
  }

  const steps = [
    {
      title: "Connect a wallet",
      body: (
        <>
          Connected as <span className="font-mono text-foreground">{truncateAddress(address)}</span>.
        </>
      ),
      done: true,
    },
    {
      title: "Fund your testnet account",
      body: account.isLoading
        ? "Checking your account…"
        : funded
          ? `Balance: ${xlm.toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM. Enough to deploy and vote.`
          : "Deploying and voting cost a small network fee. Friendbot sends free testnet XLM.",
      done: funded,
      action: !funded && !account.isLoading && (
        <Button size="sm" variant="secondary" onClick={fund} loading={funding} data-testid="fund-account">
          <Droplets /> Get testnet XLM
        </Button>
      ),
    },
    {
      title: "Create your treasury",
      body: "Choose members, roles, a threshold and a timelock. About two minutes.",
      done: false,
      action: (
        <Button size="sm" asChild>
          <Link href="/create">
            <Plus /> Create a treasury
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <section aria-labelledby="onboarding-title" className="overflow-hidden rounded-xl border border-border-strong bg-background" data-testid="onboarding">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid gap-6 p-6 sm:p-8">
          <div className="grid gap-2">
            <h2 id="onboarding-title" className="text-xl font-semibold tracking-tight">
              Welcome to Steward
            </h2>
            <p className="text-muted">Three steps to your own multisig treasury on Stellar testnet.</p>
          </div>
          <ol className="grid gap-0">
            {steps.map((step, index) => {
              const current = !step.done && steps.slice(0, index).every((s) => s.done);
              return (
                <li key={step.title} className="grid grid-cols-[1.75rem_1fr] gap-x-4">
                  <span className="flex flex-col items-center">
                    <span
                      className={cn(
                        "grid size-7 place-items-center rounded-full border text-xs tabular",
                        step.done ? "border-accent bg-accent text-on-accent" : current ? "border-accent text-accent" : "border-border-strong text-muted",
                      )}
                    >
                      {step.done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                    </span>
                    {index < steps.length - 1 && <span className={cn("w-px flex-1", step.done ? "bg-accent" : "bg-border-strong")} />}
                  </span>
                  <div className={cn("grid gap-2 pt-0.5", index < steps.length - 1 && "pb-6")}>
                    <p className={cn("font-medium", !step.done && !current && "text-muted")}>{step.title}</p>
                    <p className="text-sm text-muted">{step.body}</p>
                    {step.action && <div>{step.action}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid content-between gap-6 border-t border-border bg-raised p-6 sm:p-8 lg:border-l lg:border-t-0">
          <div className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" aria-hidden /> Look around first
            </span>
            <p className="text-sm text-muted">
              The demo treasury is live on testnet with three approvers and a threshold of two. Open it to see
              proposals, votes and spending limits before setting up your own.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href={`/t/${demo.contractId}`}>
              Open the demo treasury <ArrowRight />
            </Link>
          </Button>
          {account.isError && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Network is slow; retrying.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
