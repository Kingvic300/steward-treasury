"use client";

import Link from "next/link";
import { use } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { isContract } from "@/lib/actions";
import { demo } from "@/lib/network";
import { useSavedTreasuries } from "@/lib/use-tokens";

export default function TreasuryLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const saved = useSavedTreasuries();

  if (!isContract(id)) {
    return (
      <main id="main" className="container-page grid min-h-dvh content-center justify-items-start gap-4">
        <h1 className="text-2xl font-semibold">This is not a treasury address</h1>
        <p className="max-w-prose text-muted">
          A treasury address starts with C and is 56 characters long. Check the link, or pick a treasury from your list.
        </p>
        <Button asChild>
          <Link href="/treasuries">Your treasuries</Link>
        </Button>
      </main>
    );
  }

  const name = saved.find((t) => t.id === id)?.name ?? (id === demo.contractId ? "Demo treasury" : "Treasury");
  return (
    <AppShell treasuryId={id} name={name}>
      {children}
    </AppShell>
  );
}
