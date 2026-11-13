"use client";

import { Dialog as Primitive } from "radix-ui";
import { ArrowUpRight, ChevronRight, Loader2, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WalletOption {
  id: string;
  name: string;
  icon: string;
  url: string;
  isAvailable: boolean;
}

export type PickerStatus =
  | { name: "loading" }
  | { name: "idle" }
  | { name: "connecting"; id: string }
  | { name: "failed"; id: string; message: string };

/**
 * Steward's own wallet chooser. Stellar Wallets Kit still talks to the wallets;
 * this only replaces its modal so the picker matches the rest of the app.
 */
export function WalletPicker({
  open,
  wallets,
  status,
  onPick,
  onClose,
}: {
  open: boolean;
  wallets: WalletOption[];
  status: PickerStatus;
  onPick: (wallet: WalletOption) => void;
  onClose: () => void;
}) {
  const installed = wallets.filter((w) => w.isAvailable);
  const others = wallets.filter((w) => !w.isAvailable);
  const busy = status.name === "connecting";

  return (
    <Primitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px]" />
        <Primitive.Content
          data-testid="wallet-picker"
          className="fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[26rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border-strong bg-background shadow-[0_24px_64px_-16px_rgb(16_22_42/0.35)]"
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="grid gap-1">
              <Primitive.Title className="text-lg font-semibold tracking-tight">Connect a wallet</Primitive.Title>
              <Primitive.Description className="text-sm text-muted">
                Choose the wallet that holds your treasury key.
              </Primitive.Description>
            </div>
            <Primitive.Close
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-md p-1.5 text-muted hover:bg-raised hover:text-foreground disabled:opacity-40"
            >
              <X className="size-4" />
            </Primitive.Close>
          </div>

          <div className="grid gap-5 overflow-y-auto px-4 pb-4">
            {status.name === "loading" ? (
              <ul className="grid gap-1.5" aria-label="Looking for wallets">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
                    <span className="size-9 rounded-lg bg-raised" />
                    <span className="h-3.5 w-28 rounded bg-raised" />
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <WalletGroup
                  label={installed.length ? "Detected in this browser" : "No wallet detected"}
                  empty={installed.length === 0 ? "Install one of the wallets below, then reopen this window." : undefined}
                >
                  {installed.map((wallet) => (
                    <WalletRow key={wallet.id} wallet={wallet} status={status} onPick={onPick} disabled={busy && status.id === wallet.id} />
                  ))}
                </WalletGroup>
                {others.length > 0 && (
                  <WalletGroup label="Other wallets">
                    {others.map((wallet) => (
                      <WalletRow key={wallet.id} wallet={wallet} status={status} onPick={onPick} disabled={busy && status.id === wallet.id} />
                    ))}
                  </WalletGroup>
                )}
              </>
            )}
          </div>

          <div className="flex items-start gap-2.5 border-t border-border bg-raised px-6 py-4 text-xs text-muted">
            <ShieldCheck className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
            <p>
              Steward never sees your secret key. Your wallet signs each transaction after you review it. Use a
              wallet set to Stellar testnet.
            </p>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

function WalletGroup({ label, empty, children }: { label: string; empty?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="px-3 text-xs font-medium text-muted">{label}</p>
      {empty ? <p className="px-3 text-sm text-muted">{empty}</p> : <ul className="grid gap-1">{children}</ul>}
    </div>
  );
}

function WalletRow({
  wallet,
  status,
  onPick,
  disabled,
}: {
  wallet: WalletOption;
  status: PickerStatus;
  onPick: (wallet: WalletOption) => void;
  disabled: boolean;
}) {
  const connecting = status.name === "connecting" && status.id === wallet.id;
  const failed = status.name === "failed" && status.id === wallet.id ? status.message : undefined;

  const icon = (
    // eslint-disable-next-line @next/next/no-img-element -- icons are data URIs or remote logos from the kit
    <img src={wallet.icon} alt="" className="size-9 shrink-0 rounded-lg border border-border bg-background object-contain p-1" />
  );

  if (!wallet.isAvailable) {
    return (
      <li>
        <a
          href={wallet.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted hover:bg-raised hover:text-foreground"
        >
          <span className="opacity-60 grayscale">{icon}</span>
          <span className="flex-1 text-sm font-medium">{wallet.name}</span>
          <span className="inline-flex items-center gap-1 text-xs">
            Install <ArrowUpRight className="size-3.5" />
          </span>
        </a>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick(wallet)}
        data-testid={`wallet-${wallet.id}`}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left disabled:cursor-default",
          connecting ? "border-accent bg-accent-soft" : failed ? "border-danger/40" : "border-transparent hover:border-border hover:bg-raised",
          disabled && !connecting && "opacity-50",
        )}
      >
        {icon}
        <span className="grid flex-1 gap-0.5">
          <span className="text-sm font-medium">{wallet.name}</span>
          {connecting && (
            <span className="text-xs text-accent">
              Approve the request in {wallet.name}. If its window stays blank, unlock {wallet.name} from the browser
              toolbar, then try again.
            </span>
          )}
          {failed && <span className="text-xs text-danger">{failed}</span>}
        </span>
        {connecting ? (
          <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
        ) : (
          <ChevronRight className="size-4 text-muted" aria-hidden />
        )}
      </button>
    </li>
  );
}
