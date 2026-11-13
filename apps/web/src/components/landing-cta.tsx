"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { demo } from "@/lib/network";
import { useWallet } from "@/lib/wallet";
import { Button } from "./ui/button";

export function LandingCta() {
  const { address, connect, connecting } = useWallet();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-3">
      {address ? (
        <Button asChild size="lg">
          <Link href="/create">Create a treasury</Link>
        </Button>
      ) : (
        <Button
          size="lg"
          loading={connecting}
          onClick={async () => {
            if (await connect()) router.push("/create");
          }}
        >
          Connect wallet
        </Button>
      )}
      <Button asChild size="lg" variant="secondary">
        <Link href={`/t/${demo.contractId}`}>Open the demo treasury</Link>
      </Button>
    </div>
  );
}
