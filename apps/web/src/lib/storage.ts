/** Per-browser lists: saved treasuries, custom tokens, and remembered tx hashes. */
import type { TokenInfo } from "./network";

export interface SavedTreasury {
  id: string;
  name: string;
  addedAt: number;
}

const TREASURIES = "steward:treasuries";
const tokensKey = (treasury: string) => `steward:tokens:${treasury}`;
const hashesKey = (treasury: string) => `steward:tx:${treasury}`;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("steward:storage"));
  } catch {
    // Storage can be blocked (private mode); the app works without it.
  }
}

export const getTreasuries = () => read<SavedTreasury[]>(TREASURIES, []);

export function saveTreasury(id: string, name: string) {
  const rest = getTreasuries().filter((t) => t.id !== id);
  write(TREASURIES, [{ id, name: name.trim() || "Treasury", addedAt: Date.now() }, ...rest]);
}

export function forgetTreasury(id: string) {
  write(TREASURIES, getTreasuries().filter((t) => t.id !== id));
}

export const getCustomTokens = (treasury: string) => read<TokenInfo[]>(tokensKey(treasury), []);

export function addCustomToken(treasury: string, token: TokenInfo) {
  write(tokensKey(treasury), [...getCustomTokens(treasury).filter((t) => t.id !== token.id), token]);
}

export function removeCustomToken(treasury: string, id: string) {
  write(tokensKey(treasury), getCustomTokens(treasury).filter((t) => t.id !== id));
}

/** Transaction hashes this browser sent, keyed like "propose:12" or "approve:12:G…". */
export const getTxHashes = (treasury: string) => read<Record<string, string>>(hashesKey(treasury), {});

export function rememberTx(treasury: string, key: string, hash: string) {
  write(hashesKey(treasury), { ...getTxHashes(treasury), [key]: hash });
}

export function subscribe(callback: () => void) {
  window.addEventListener("steward:storage", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("steward:storage", callback);
    window.removeEventListener("storage", callback);
  };
}
