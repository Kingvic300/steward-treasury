"use client";

import { LogOut, Wallet } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { truncateAddress } from "@/lib/format";
import { useWallet } from "@/lib/wallet";
import { CopyButton } from "./address";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/misc";
import { Tooltip } from "./ui/tooltip";

export function WalletButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { address, restoring, connecting, connect, disconnect } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  // Inside the app (a treasury, the wizard) connecting keeps you where you are.
  // Anywhere else, a new connection opens the app.
  const inApp = pathname.startsWith("/t/") || pathname.startsWith("/create") || pathname.startsWith("/treasuries");

  if (restoring) return <Skeleton className="h-10 w-36" />;

  if (!address) {
    return (
      <Button
        size={size}
        onClick={async () => {
          if ((await connect()) && !inApp) router.push("/treasuries");
        }}
        loading={connecting}
        data-testid="connect-wallet"
      >
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
