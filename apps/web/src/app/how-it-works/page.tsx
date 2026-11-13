import type { Metadata } from "next";
import { Ban, Check, Clock3, FileCode2, Hourglass, Play, Send, Undo2, UserPlus, X } from "lucide-react";
import { CtaCard, Frame, FrameHeader, PageHero, SectionHeading } from "@/components/marketing";
import { Seals } from "@/components/seals";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Badge, type Tone } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "How it works",
  description: "The life of a Steward proposal: propose, approve, timelock, execute, and every way it can end early.",
};

const TIMELINE: { label: string; meta: string; done: boolean; current?: boolean }[] = [
  { label: "Proposed by GAGR…MGM6", meta: "Mar 3, 09:12", done: true },
  { label: "Approved by GATI…JL5U", meta: "Mar 3, 11:40", done: true },
  { label: "Approved by GARH…7YUE", meta: "Mar 3, 14:05", done: true },
  { label: "Queued, timelock running", meta: "17h 22m left", done: false, current: true },
  { label: "Ready to execute", meta: "Mar 4, 14:05", done: false },
  { label: "Executed", meta: "Window closes Mar 7", done: false },
];

function HeroTimeline() {
  return (
    <Frame>
      <FrameHeader aside={<Badge tone="warn">Timelock</Badge>}>
        <span className="font-mono tabular">#41</span>
        <span className="truncate text-foreground">Raise the threshold to 3 of 5</span>
      </FrameHeader>
      <ol className="grid gap-0 px-5 py-5">
        {TIMELINE.map((item, index) => (
          <li key={item.label} className="grid grid-cols-[1.25rem_1fr_auto] gap-x-3">
            <span className="flex flex-col items-center">
              <span
                className={
                  item.done
                    ? "grid size-5 place-items-center rounded-full bg-accent text-on-accent"
                    : item.current
                      ? "grid size-5 place-items-center rounded-full border-2 border-accent bg-background"
                      : "grid size-5 place-items-center rounded-full border border-border-strong bg-background"
                }
              >
                {item.done && <Check className="size-3" strokeWidth={3} />}
              </span>
              {index < TIMELINE.length - 1 && <span className={item.done ? "w-px flex-1 bg-accent" : "w-px flex-1 bg-border-strong"} />}
            </span>
            <span className={item.done || item.current ? "pb-5 text-sm font-medium" : "pb-5 text-sm text-muted"}>{item.label}</span>
            <span className="pb-5 text-right font-mono text-xs tabular text-muted">{item.meta}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between border-t border-border px-5 py-3.5 text-sm">
        <span className="flex items-center gap-2">
          <Seals total={5} threshold={3} approvals={2} size="sm" />
          <span className="font-mono text-xs tabular text-muted">2 of 3</span>
        </span>
        <span className="inline-flex h-8 items-center rounded-md border border-border-strong px-3 text-xs font-medium">Cancel proposal</span>
      </div>
    </Frame>
  );
}

function ProposeStill() {
  return (
    <Frame>
      <FrameHeader>New proposal</FrameHeader>
      <div className="grid gap-2 p-4 text-sm">
        {[
          { icon: Send, text: "Transfer 12,500.00 USDC" },
          { icon: FileCode2, text: "Invoke blend_pool.supply" },
          { icon: UserPlus, text: "Add approver GD7Q…2KXA" },
        ].map((row) => (
          <span key={row.text} className="flex items-center gap-3 rounded-md bg-raised px-3 py-2.5">
            <row.icon className="size-4 text-accent" />
            {row.text}
          </span>
        ))}
        <span className="mt-1 text-xs text-muted">3 of 10 actions · memo 41 of 256 bytes</span>
      </div>
    </Frame>
  );
}

function VoteStill() {
  return (
    <Frame>
      <FrameHeader aside={<Badge tone="wait">Voting</Badge>}>Votes</FrameHeader>
      <div className="grid gap-4 p-4">
        <span className="flex items-center gap-3">
          <Seals total={3} threshold={2} approvals={1} size="md" />
          <span className="font-mono text-xs tabular text-muted">1 of 2</span>
        </span>
        <span className="flex gap-2">
          <span className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent text-sm font-medium text-on-accent">
            <Check className="size-4" /> Approve
          </span>
          <span className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border-strong text-sm font-medium">
            <X className="size-4" /> Reject
          </span>
        </span>
      </div>
    </Frame>
  );
}

function TimelockStill() {
  return (
    <Frame>
      <FrameHeader aside={<Badge tone="warn">Timelock</Badge>}>Queued</FrameHeader>
      <div className="grid gap-3 p-4">
        <span className="flex items-baseline gap-2">
          <Hourglass className="size-4 self-center text-warn" />
          <span className="font-mono text-2xl tabular">17:22:08</span>
          <span className="text-sm text-muted">until executable</span>
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-raised">
          <div className="h-full w-[28%] rounded-full bg-warn" />
        </div>
      </div>
    </Frame>
  );
}

function ExecuteStill() {
  return (
    <Frame>
      <FrameHeader aside={<Badge tone="ok">Executed</Badge>}>Receipt</FrameHeader>
      <dl className="grid gap-2 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Actions run</dt>
          <dd>3 of 3</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Transaction</dt>
          <dd className="font-mono">9f3a…c41e</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Executed by</dt>
          <dd className="font-mono">GCLN…WSPR</dd>
        </div>
      </dl>
    </Frame>
  );
}

const STAGES = [
  {
    title: "Propose",
    who: "Proposer",
    body: "Bundle one to ten actions with a short memo. Actions can send tokens, call any contract, change members or rules, set spending limits, or upgrade the treasury itself.",
    rule: "The proposal records the rules version it was created under.",
    still: <ProposeStill />,
  },
  {
    title: "Approve or reject",
    who: "Approvers",
    body: "Each approver votes once and cannot switch sides. Votes count until the voting period ends.",
    rule: "At the threshold the proposal is queued. Once the threshold is out of reach, it is rejected.",
    still: <VoteStill />,
  },
  {
    title: "Wait out the timelock",
    who: "Everyone",
    body: "A queued proposal cannot run until its timelock ends. That delay is the time members have to read what is about to happen and react.",
    rule: "The proposer can cancel at any point before execution.",
    still: <TimelockStill />,
  },
  {
    title: "Execute",
    who: "Executor",
    body: "Every action runs, in order, in one transaction. The proposal is marked executed before the first action, so it can never run twice.",
    rule: "If any action fails, the whole transaction reverts.",
    still: <ExecuteStill />,
  },
];

const ENDINGS: { name: string; tone: Tone; icon: typeof Ban; body: string }[] = [
  { name: "Rejected", tone: "danger", icon: X, body: "Enough approvers voted against it that the threshold can no longer be reached." },
  { name: "Cancelled", tone: "idle", icon: Undo2, body: "Its proposer withdrew it while it was open or waiting in the timelock." },
  { name: "Expired", tone: "idle", icon: Clock3, body: "Voting closed short of the threshold, or nobody executed it inside the window." },
  { name: "Stale", tone: "warn", icon: Ban, body: "Another proposal changed members or rules first. Approvals under old rules cannot run under new ones." },
];

const SEAL_ROWS = [
  { label: "Just proposed", approvals: 0, rejections: 0, badge: "Voting", tone: "wait" as Tone },
  { label: "One approval", approvals: 1, rejections: 0, badge: "Voting", tone: "wait" as Tone },
  { label: "Threshold reached", approvals: 2, rejections: 0, badge: "Queued", tone: "warn" as Tone },
  { label: "Two rejections", approvals: 0, rejections: 2, badge: "Rejected", tone: "danger" as Tone },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main">
        <PageHero title="From a draft to a signed, timed, executed decision" visual={<HeroTimeline />}>
          <p>
            Every change to a Steward treasury takes the same path: four stages, three roles. Nothing moves until
            the signatures are in and the clock has run.
          </p>
        </PageHero>

        <section aria-labelledby="stages" className="container-page grid gap-10 py-16 lg:py-24">
          <SectionHeading id="stages" title="Four stages">
            Each stage has one owner. The contract checks the role and the clock at every step.
          </SectionHeading>
          <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border">
            {STAGES.map((stage, index) => (
              <li key={stage.title} className="grid gap-8 bg-background p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center lg:gap-16">
                <div className="grid content-start gap-4">
                  <span className="flex items-center gap-3 text-sm text-muted">
                    <span className="grid size-7 place-items-center rounded-full border border-border-strong font-mono text-xs tabular text-foreground">
                      {index + 1}
                    </span>
                    {stage.who}
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight">{stage.title}</h3>
                  <p className="max-w-[38rem] text-muted">{stage.body}</p>
                  <p className="flex max-w-[38rem] items-start gap-2 text-sm">
                    <Play className="mt-1 size-3 shrink-0 fill-accent text-accent" />
                    {stage.rule}
                  </p>
                </div>
                <div aria-hidden className="select-none rounded-lg bg-raised p-5 sm:p-6">
                  {stage.still}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="threshold" className="border-y border-border bg-raised">
          <div className="container-page grid gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-center lg:gap-16 lg:py-24">
            <SectionHeading id="threshold" title="The threshold, drawn">
              One seal per approver. Filled seals approved, crossed seals rejected, and the line marks the
              threshold. Three approvers with a threshold of two reads the same on every screen.
            </SectionHeading>
            <Frame>
              <FrameHeader>3 approvers, threshold 2</FrameHeader>
              <dl className="divide-y divide-border">
                {SEAL_ROWS.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-4">
                    <dt className="text-sm">{row.label}</dt>
                    <dd className="flex items-center gap-4">
                      <Seals total={3} threshold={2} approvals={row.approvals} rejections={row.rejections} size="md" />
                      <Badge tone={row.tone} className="w-20 justify-center">
                        {row.badge}
                      </Badge>
                    </dd>
                  </div>
                ))}
              </dl>
            </Frame>
          </div>
        </section>

        <section aria-labelledby="endings" className="container-page grid gap-10 py-16 lg:py-24">
          <SectionHeading id="endings" title="Four ways a proposal ends early">
            Not every proposal should run. Each early ending is final.
          </SectionHeading>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ENDINGS.map((ending) => (
              <div key={ending.name} className="grid content-start gap-4 rounded-xl border border-border p-6">
                <dt>
                  <Badge tone={ending.tone}>
                    <ending.icon className="size-3" aria-hidden />
                    {ending.name}
                  </Badge>
                </dt>
                <dd className="text-sm text-muted">{ending.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="limits" className="border-t border-border">
          <div className="container-page grid gap-10 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-center lg:gap-16 lg:py-24">
            <div className="grid gap-6">
              <SectionHeading id="limits" title="Spending limits: the fast lane">
                A proposal can give one address an allowance of one token per period. Inside it, that address pays
                directly: no vote, no timelock.
              </SectionHeading>
              <ul className="grid max-w-[36rem] gap-2 text-muted">
                <li>Periods are fixed windows on the clock, for example each UTC day.</li>
                <li>Unused allowance does not carry over.</li>
                <li>Only a proposal can create, change or remove a limit.</li>
              </ul>
            </div>
            <Frame>
              <FrameHeader aside={<span className="text-xs text-muted">resets in 6h 12m</span>}>Operations wallet · daily</FrameHeader>
              <div className="grid gap-3 p-5">
                <div className="h-2 overflow-hidden rounded-full bg-raised">
                  <div className="h-full w-[68%] rounded-full bg-accent" />
                </div>
                <div className="flex items-baseline justify-between font-mono tabular">
                  <span>
                    340.00 XLM <span className="text-sm text-muted">of 500.00</span>
                  </span>
                  <span className="text-sm text-muted">160.00 left</span>
                </div>
                <span className="mt-2 inline-flex h-9 w-fit items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent">Spend</span>
              </div>
            </Frame>
          </div>
        </section>

        <CtaCard title="Try the whole path on testnet">
          Create a treasury, propose a payment, approve it with a second key and execute it after the timelock.
        </CtaCard>
      </main>
      <SiteFooter />
    </div>
  );
}
