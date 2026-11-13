import { cn } from "@/lib/utils";

/** Three seals, two filled: a 2-of-3 approval. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("size-7", className)} aria-hidden>
      <circle cx="14" cy="7.5" r="5" className="fill-accent" />
      <circle cx="7" cy="19.5" r="5" className="fill-accent" />
      <circle cx="21" cy="19.5" r="4.25" className="fill-none stroke-accent" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-lg font-semibold tracking-tight", className)}>
      <LogoMark />
      Steward
    </span>
  );
}
