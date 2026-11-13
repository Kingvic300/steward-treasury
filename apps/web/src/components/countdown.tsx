"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/format";

/** Current time in whole seconds, ticking once a second after mount. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function Countdown({ to, now, className }: { to: number | bigint; now: number; className?: string }) {
  return (
    <span className={className} suppressHydrationWarning>
      <span className="font-mono tabular">{formatCountdown(Number(to) - now)}</span>
    </span>
  );
}
