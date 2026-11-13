"use client";

import { useMemo, useSyncExternalStore } from "react";
import { knownTokens, type TokenInfo } from "./network";
import { getTreasuries, getTxHashes, subscribe, type SavedTreasury } from "./storage";

const EMPTY = "[]";

function useStored(key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? EMPTY,
    () => EMPTY,
  );
}

/** Tokens shown for a treasury: the deployment's known tokens plus any the user added. */
export function useTokens(treasuryId: string): TokenInfo[] {
  const raw = useStored(`steward:tokens:${treasuryId}`);
  return useMemo(() => {
    let custom: TokenInfo[] = [];
    try {
      custom = JSON.parse(raw) as TokenInfo[];
    } catch {
      custom = [];
    }
    return [...knownTokens, ...custom.filter((token) => !knownTokens.some((known) => known.id === token.id))];
  }, [raw]);
}

export function useSavedTreasuries(): SavedTreasury[] {
  const raw = useStored("steward:treasuries");
  return useMemo(() => {
    void raw;
    return getTreasuries();
  }, [raw]);
}

/** Hashes of transactions this browser sent for a treasury. */
export function useTxHashes(treasuryId: string): Record<string, string> {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(`steward:tx:${treasuryId}`) ?? "{}",
    () => "{}",
  );
  return useMemo(() => {
    void raw;
    return getTxHashes(treasuryId);
  }, [raw, treasuryId]);
}
