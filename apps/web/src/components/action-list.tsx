import type { Action } from "@steward/treasury-client";
import { ArrowUpRight, Code2, Gauge, Settings2, ShieldAlert, UserMinus, UserPlus, Wallet } from "lucide-react";
import { describeAction } from "@/lib/actions";
import { stringifyWithBigInt } from "@/lib/format";
import type { TokenInfo } from "@/lib/network";
import { AddressPill } from "./address";

const ICONS: Record<Action["tag"], typeof Wallet> = {
  Transfer: ArrowUpRight,
  Invoke: Code2,
  AddMember: UserPlus,
  RemoveMember: UserMinus,
  SetThreshold: Settings2,
  SetTimelockDelay: Settings2,
  SetVotingPeriod: Settings2,
  SetExecutionWindow: Settings2,
  SetSpendingLimit: Gauge,
  RemoveSpendingLimit: Gauge,
  Upgrade: ShieldAlert,
};

function addressesIn(action: Action): { label: string; address: string }[] {
  switch (action.tag) {
    case "Transfer":
      return [{ label: "Recipient", address: action.values[0].to }, { label: "Token", address: action.values[0].token }];
    case "Invoke":
      return [{ label: "Contract", address: action.values[0].contract }];
    case "AddMember":
    case "RemoveMember":
      return [{ label: "Address", address: action.values[0].account }];
    case "SetSpendingLimit":
    case "RemoveSpendingLimit":
      return [{ label: "Spender", address: action.values[0].spender }, { label: "Token", address: action.values[0].token }];
    default:
      return [];
  }
}

/** Actions decoded into plain words, in the order they will run. */
export function ActionList({ actions, tokens }: { actions: readonly Action[]; tokens: TokenInfo[] }) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-md border border-border bg-border">
      {actions.map((action, index) => {
        const summary = describeAction(action, tokens);
        const Icon = ICONS[action.tag];
        return (
          <li key={index} className="grid gap-2 bg-surface px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-xs tabular text-muted">{index + 1}</span>
              <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <div className="grid min-w-0 gap-0.5">
                <p className="font-medium">{summary.title}</p>
                <p className="text-sm text-muted">{summary.detail}</p>
              </div>
            </div>
            <dl className="ml-[3.25rem] grid gap-1 text-sm">
              {addressesIn(action).map((item) => (
                <div key={item.label} className="flex flex-wrap items-center gap-x-2">
                  <dt className="w-20 text-muted">{item.label}</dt>
                  <dd>
                    <AddressPill address={item.address} />
                  </dd>
                </div>
              ))}
            </dl>
            {action.tag === "Invoke" && action.values[0].args.length > 0 && (
              <details className="ml-[3.25rem] text-sm">
                <summary className="text-muted hover:text-foreground">Arguments</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-raised p-3 font-mono text-xs">
                  {stringifyWithBigInt(action.values[0].args)}
                </pre>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
