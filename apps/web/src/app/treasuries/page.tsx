"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddressPill } from "@/components/address";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { isContract } from "@/lib/actions";
import { demo } from "@/lib/network";
import { forgetTreasury } from "@/lib/storage";
import { useSavedTreasuries } from "@/lib/use-tokens";

export default function TreasuriesPage() {
  const saved = useSavedTreasuries();
  const router = useRouter();
  const [id, setId] = useState("");
  const [error, setError] = useState<string>();
  const list = [...saved, ...(saved.some((t) => t.id === demo.contractId) ? [] : [{ id: demo.contractId, name: "Demo treasury", addedAt: 0 }])];

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main id="main" className="container-page grid gap-12 py-14 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="text-3xl font-semibold tracking-tight">Treasuries</h1>
          <Button asChild size="lg">
            <Link href="/create">Create a treasury</Link>
          </Button>
        </div>

        <ul className="border-t border-foreground" data-testid="treasury-list">
          {list.map((treasury) => (
            <li key={treasury.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5">
              <div className="grid gap-1">
                <Link href={`/t/${treasury.id}`} className="text-xl font-semibold hover:text-accent">
                  {treasury.name}
                </Link>
                <AddressPill address={treasury.id} />
              </div>
              <div className="flex gap-2">
                {treasury.addedAt > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => forgetTreasury(treasury.id)}>
                    Remove from list
                  </Button>
                )}
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/t/${treasury.id}`}>Open</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <form
          className="grid max-w-2xl gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isContract(id.trim())) return setError("Enter a contract address: it starts with C and has 56 characters.");
            router.push(`/t/${id.trim()}`);
          }}
        >
          <Field label="Open a treasury by address" htmlFor="open-id" error={error} hint="This list is kept in this browser only.">
            <div className="flex gap-2">
              <Input id="open-id" value={id} onChange={(e) => { setId(e.target.value); setError(undefined); }} placeholder="C…" className="font-mono" spellCheck={false} />
              <Button type="submit" variant="secondary">Open</Button>
            </div>
          </Field>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
