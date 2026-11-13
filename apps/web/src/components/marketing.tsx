import { cn } from "@/lib/utils";
import { LandingCta } from "./landing-cta";

/**
 * Opening for the marketing pages: copy on the left, a still of the product on
 * the right. Stacks on small screens with the copy first.
 */
export function PageHero({
  title,
  children,
  visual,
}: {
  title: string;
  children: React.ReactNode;
  visual: React.ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] lg:gap-16 lg:py-20">
        <div className="grid content-center gap-6">
          <h1 className="max-w-[20ch] text-[clamp(2rem,3.4vw,3rem)] font-semibold tracking-[-0.03em]">{title}</h1>
          <div className="grid max-w-[36rem] gap-4 text-lg leading-relaxed text-muted">{children}</div>
        </div>
        <div aria-hidden className="select-none">
          {visual}
        </div>
      </div>
    </section>
  );
}

/** A floating product surface: the card every still on the site is drawn in. */
export function Frame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-strong bg-background shadow-[0_1px_2px_rgb(16_22_42/0.04),0_16px_40px_-16px_rgb(16_22_42/0.16)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FrameHeader({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 text-sm">
      <span className="flex min-w-0 items-center gap-2 text-muted">{children}</span>
      {aside}
    </div>
  );
}

export function SectionHeading({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      <h2 id={id} className="max-w-[26ch] text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {children && <p className="max-w-[40rem] text-lg text-muted">{children}</p>}
    </div>
  );
}

/** Closing card shared by the marketing pages. */
export function CtaCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label="Get started" className="border-t border-border bg-raised">
      <div className="container-page py-14 lg:py-20">
        <div className="grid gap-8 rounded-xl border border-border-strong bg-background p-8 sm:p-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-3">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
            <p className="max-w-[38rem] text-lg text-muted">{children}</p>
          </div>
          <LandingCta />
        </div>
      </div>
    </section>
  );
}
