"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { truncateAddress } from "@/lib/format";
import { explorer } from "@/lib/network";
import { cn } from "@/lib/utils";
import { Tooltip } from "./ui/tooltip";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip label={copied ? "Copied" : label}>
      <button
        type="button"
        aria-label={copied ? "Copied" : label}
        onClick={async (event) => {
          event.preventDefault();
          event.stopPropagation();
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded p-1 text-muted hover:bg-raised hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      </button>
    </Tooltip>
  );
}

export function ExplorerLink({ href, label }: { href: string; label: string }) {
  return (
    <Tooltip label={label}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        className="rounded p-1 text-muted hover:bg-raised hover:text-foreground"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </Tooltip>
  );
}

/** A truncated address with copy and stellar.expert actions. */
export function AddressPill({
  address,
  you,
  full,
  className,
}: {
  address: string;
  /** Marks the connected wallet. */
  you?: boolean;
  /** Show the whole address where there is room (it still wraps safely). */
  full?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-0.5", className)}>
      <span className={cn("font-mono text-[0.8125rem]", full ? "break-all" : "whitespace-nowrap")} title={address}>
        {full ? address : truncateAddress(address, 5, 5)}
      </span>
      {you && <span className="ml-1 rounded bg-accent-soft px-1.5 py-px text-[0.6875rem] font-medium text-accent">you</span>}
      <CopyButton value={address} label="Copy address" />
      <ExplorerLink href={explorer.address(address)} label="View on stellar.expert" />
    </span>
  );
}

export function TxLink({ hash, className }: { hash: string; className?: string }) {
  return (
    <a
      href={explorer.tx(hash)}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-1 font-mono text-[0.8125rem] text-accent hover:underline", className)}
    >
      {truncateAddress(hash, 6, 6)}
      <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">View transaction on stellar.expert</span>
    </a>
  );
}
