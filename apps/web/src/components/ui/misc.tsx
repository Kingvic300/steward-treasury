import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("rounded-md bg-raised", className)} {...props} />;
}

/** The app's one surface treatment. Use `as="section"` with a heading inside. */
export function Panel({
  className,
  as = "div",
  ...props
}: React.ComponentProps<"div"> & { as?: "div" | "section" | "article" | "aside" | "li" }) {
  const Component = as as "div";
  return <Component className={cn("rounded-lg border border-border bg-surface", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <div className="grid gap-0.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid justify-items-start gap-3 px-5 py-8", className)}>
      <div className="grid gap-1">
        <p className="font-medium">{title}</p>
        {children && <p className="max-w-prose text-sm text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  ok: "bg-ok-soft text-ok",
  wait: "bg-wait-soft text-wait",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  idle: "bg-idle-soft text-idle",
  accent: "bg-accent-soft text-accent",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = "idle", className, ...props }: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Notice({
  tone = "idle",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "note"}
      className={cn("grid gap-1 rounded-md px-4 py-3 text-sm", TONES[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      <div className="text-foreground/90">{children}</div>
    </div>
  );
}
