import { Seals } from "./seals";
import { Badge, type Tone } from "./ui/misc";

const STAGES: { name: string; who: string; status: string; tone: Tone; approvals: number; detail: string }[] = [
  { name: "Proposed", who: "Proposer", status: "Voting", tone: "wait", approvals: 0, detail: "Two actions bundled. Voting stays open for 7 days." },
  { name: "Approved", who: "Approvers", status: "Voting", tone: "wait", approvals: 1, detail: "First approval is in. One more reaches the threshold." },
  { name: "Timelock", who: "Everyone", status: "Timelock", tone: "warn", approvals: 2, detail: "Threshold reached. 24 hours to inspect it or cancel." },
  { name: "Ready", who: "Executor", status: "Ready", tone: "accent", approvals: 2, detail: "Timelock over. Executable for the next 3 days." },
  { name: "Executed", who: "On chain", status: "Executed", tone: "ok", approvals: 2, detail: "Both actions ran in one atomic transaction." },
];

/**
 * One proposal shown at each of the five stations of its life, side by side
 * across the full width of the page.
 */
export function LifecycleBoard() {
  return (
    <figure className="border-y border-border">
      <figcaption className="container-page flex flex-wrap items-baseline justify-between gap-x-10 gap-y-2 border-b border-border py-5">
        <p className="text-lg font-medium">
          <span className="mr-3 font-mono text-sm text-muted">#42</span>
          March contributor payouts
        </p>
        <ul className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted">
          <li>
            Send <span className="font-mono text-foreground">12,500.00 USDC</span> to the design guild
          </li>
          <li>
            Let ops spend <span className="font-mono text-foreground">500.00 XLM</span> a day
          </li>
        </ul>
      </figcaption>

      <ol className="grid md:grid-cols-5">
        {STAGES.map((stage, index) => (
          <li
            key={stage.name}
            className="grid content-start gap-6 border-b border-border px-[clamp(1rem,4vw,4.5rem)] py-7 last:border-b-0 md:border-b-0 md:border-r md:px-7 md:py-10 md:last:border-r-0 md:first:pl-[clamp(1rem,4vw,4.5rem)] md:last:pr-[clamp(1rem,4vw,4.5rem)]"
          >
            <div className="flex items-center justify-between gap-3 border-t-2 pt-4" style={{ borderColor: index <= 2 ? "var(--accent)" : "var(--border-strong)" }}>
              <span className="font-mono text-sm tabular text-muted">{index + 1} of 5</span>
              <Badge tone={stage.tone}>{stage.status}</Badge>
            </div>
            <div className="grid gap-1">
              <h3 className="text-xl font-semibold tracking-tight">{stage.name}</h3>
              <p className="text-sm text-muted">{stage.who}</p>
            </div>
            <div className="flex items-center gap-3">
              <Seals total={3} threshold={2} approvals={stage.approvals} size="lg" />
              <span className="font-mono text-sm tabular text-muted">{stage.approvals} of 2</span>
            </div>
            <p className="text-sm leading-relaxed text-muted">{stage.detail}</p>
          </li>
        ))}
      </ol>
    </figure>
  );
}
