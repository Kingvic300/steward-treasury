import Link from "next/link";
import { truncateAddress } from "@/lib/format";
import { demo, explorer } from "@/lib/network";
import { Logo } from "./logo";
import { WalletButton } from "./wallet-button";

export const REPO_URL = "https://github.com/Kingvic300/steward-treasury";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/use-cases", label: "Use cases" },
  { href: "/security", label: "Security" },
  { href: "/treasuries", label: "Treasuries" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" aria-label="Steward home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-muted md:flex">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1.5">
          <WalletButton />
        </div>
      </div>
      <nav aria-label="Main" className="container-page flex gap-5 overflow-x-auto pb-3 text-sm text-muted [scrollbar-width:none] md:hidden">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="shrink-0 hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const columns = [
    { title: "Product", links: [...LINKS, { href: `/t/${demo.contractId}`, label: "Demo treasury" }, { href: "/create", label: "Create a treasury" }] },
    {
      title: "Developers",
      links: [
        { href: REPO_URL, label: "Source code" },
        { href: `${REPO_URL}/blob/main/SPEC.md`, label: "Specification" },
        { href: `${REPO_URL}/tree/main/packages/treasury-client`, label: "TypeScript client" },
        { href: `${REPO_URL}/tree/main/scripts`, label: "Deploy scripts" },
      ],
    },
    {
      title: "Community",
      links: [
        { href: `${REPO_URL}/blob/main/docs/WAVE_ISSUES.md`, label: "Open issues" },
        { href: `${REPO_URL}/blob/main/CONTRIBUTING.md`, label: "Contribute" },
        { href: `${REPO_URL}/blob/main/CODE_OF_CONDUCT.md`, label: "Code of conduct" },
        { href: `${REPO_URL}/blob/main/LICENSE`, label: "MIT license" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-background">
      <div className="container-page grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-24">
        <div className="grid content-start gap-5">
          <Link href="/" aria-label="Steward home" className="w-fit">
            <Logo />
          </Link>
          <p className="max-w-sm text-sm text-muted">
            Programmable multisig treasury for Stellar: proposals, timelocks, roles and spending limits, enforced
            by a Soroban contract.
          </p>
          <dl className="grid w-fit gap-2 rounded-lg border border-border px-4 py-3 text-xs">
            <div className="flex items-center gap-3">
              <dt className="w-20 text-muted">Network</dt>
              <dd className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-ok" />
                Stellar testnet
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="w-20 text-muted">Demo</dt>
              <dd>
                <a href={explorer.contract(demo.contractId)} target="_blank" rel="noreferrer" className="font-mono hover:text-accent">
                  {truncateAddress(demo.contractId, 6, 6)}
                </a>
              </dd>
            </div>
          </dl>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-16">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title} className="grid content-start gap-3 text-sm">
              <p className="font-medium">{column.title}</p>
              {column.links.map((link) =>
                link.href.startsWith("http") ? (
                  <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="text-muted hover:text-foreground">
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.href} href={link.href} className="text-muted hover:text-foreground">
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-5 text-xs text-muted">
          <p>MIT licensed. Unaudited software: do not hold real funds in it.</p>
          <p>Not affiliated with the Stellar Development Foundation.</p>
        </div>
      </div>
    </footer>
  );
}

/** Shared opening for the marketing pages. */
export function PageIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="container-page grid gap-5 border-b border-border pb-12 pt-14 lg:pb-16 lg:pt-20">
      <h1 className="max-w-[24ch] text-[clamp(2rem,3.4vw,3rem)] font-semibold tracking-[-0.03em]">{title}</h1>
      <p className="max-w-[40rem] text-lg leading-relaxed text-muted">{children}</p>
    </section>
  );
}
