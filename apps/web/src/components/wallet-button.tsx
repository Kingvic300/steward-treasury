"use client";

import { LogOut, Wallet } from "lucide-react";
import { truncateAddress } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { CopyButton } from "./address";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/misc";
import { Tooltip } from "./ui/tooltip";

export function WalletButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { address, restoring, connecting, connect, disconnect } = useWallet();

  if (restoring) return <Skeleton className="h-10 w-36" />;

  if (!address) {
    return (
      <Button size={size} onClick={connect} loading={connecting} data-testid="connect-wallet">
        <Wallet aria-hidden />
        Connect wallet
      </Button>
    );
  }

  return (
    <div className="inline-flex h-10 items-center gap-1 rounded-md border border-border-strong bg-surface pl-3 pr-1" data-testid="wallet-connected">
      <span aria-hidden className="size-2 rounded-full bg-ok" />
      <span className="ml-1 font-mono text-[0.8125rem]" title={address}>
        {truncateAddress(address)}
      </span>
      <CopyButton value={address} label="Copy your address" />
      <Tooltip label="Disconnect">
        <button
          type="button"
          onClick={disconnect}
          aria-label="Disconnect wallet"
          className="rounded p-1.5 text-muted hover:bg-raised hover:text-foreground"
        >
          <LogOut className="size-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
