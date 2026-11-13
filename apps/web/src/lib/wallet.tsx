"use client";

/**
 * Wallet session for the app: Freighter, xBull, Albedo, LOBSTR and Hana, chosen
 * in Steward's own picker. Each wallet has a connector (see wallet-connectors.ts).
 * The chosen wallet's id is stored so signing after a reload uses the same wallet.
 *
 * When NEXT_PUBLIC_ENABLE_TEST_WALLET is "true" a local test wallet replaces
 * the picker: it signs with a secret key read from localStorage. Playwright uses
 * it to drive real testnet transactions. It must never be enabled in production.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WalletPicker, type PickerStatus, type WalletOption } from "@/components/wallet-picker";
import { network, testWalletEnabled } from "./network";
import type { Signer } from "./treasury";
import {
  CONNECT_TIMEOUT_MS,
  SIGN_TIMEOUT_MS,
  closeXBullBridge,
  detectAvailability,
  loadConnectors,
  withTimeout,
} from "./wallet-connectors";

const ADDRESS_KEY = "steward:wallet-address";
const WALLET_ID_KEY = "steward:wallet-id";
export const TEST_SECRET_KEY = "steward:test-wallet-secret";

interface WalletContext {
  address: string | null;
  /** The connected wallet's id, for example "freighter" or "xbull". */
  walletId: string | null;
  /** True until the stored session has been read on first load. */
  restoring: boolean;
  connecting: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  signer: Signer | null;
  /** A signer for an address that was connected moments ago, before React re-renders. */
  signerFor: (address: string) => Signer;
}

const Context = createContext<WalletContext | null>(null);

const usingTestWallet = () => testWalletEnabled && !!window.localStorage.getItem(TEST_SECRET_KEY);

async function testWallet() {
  const { Keypair, TransactionBuilder } = await import("@stellar/stellar-sdk");
  const secret = window.localStorage.getItem(TEST_SECRET_KEY);
  if (!secret) throw new Error("Test wallet: no secret key in localStorage.");
  const keypair = Keypair.fromSecret(secret);
  return {
    address: keypair.publicKey(),
    signTransaction: async (xdr: string) => {
      const tx = TransactionBuilder.fromXDR(xdr, network.passphrase);
      tx.sign(keypair);
      return { signedTxXdr: tx.toXDR(), signerAddress: keypair.publicKey() };
    },
  };
}

function readStored(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the session lasts until reload.
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [pickerStatus, setPickerStatus] = useState<PickerStatus>({ name: "loading" });
  const resolvePick = useRef<((address: string | null) => void) | null>(null);
  /** Bumped when the picker closes or another wallet is chosen, so late answers are ignored. */
  const pickAttempt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (usingTestWallet()) {
          const wallet = await testWallet();
          if (!cancelled) {
            setAddress(wallet.address);
            setWalletId("test");
          }
        } else {
          const stored = readStored(ADDRESS_KEY);
          const storedId = readStored(WALLET_ID_KEY);
          // Sessions from before wallet ids were stored cannot sign; drop them.
          if (stored && storedId && !cancelled) {
            setAddress(stored);
            setWalletId(storedId);
          }
        }
      } catch {
        // No session to restore.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finishPick = useCallback((result: string | null) => {
    pickAttempt.current++;
    resolvePick.current?.(result);
    resolvePick.current = null;
    setPickerOpen(false);
    setConnecting(false);
  }, []);

  const connect = useCallback(async () => {
    if (usingTestWallet()) {
      const next = (await testWallet()).address;
      setAddress(next);
      setWalletId("test");
      return next;
    }
    setPickerStatus({ name: "loading" });
    setPickerOpen(true);
    const picked = new Promise<string | null>((resolve) => {
      resolvePick.current?.(null);
      resolvePick.current = resolve;
    });
    try {
      setWallets(await detectAvailability(await loadConnectors()));
    } catch {
      setWallets([]);
    }
    setPickerStatus((status) => (status.name === "loading" ? { name: "idle" } : status));
    return picked;
  }, []);

  const pick = useCallback(
    async (wallet: WalletOption) => {
      const attempt = ++pickAttempt.current;
      setPickerStatus({ name: "connecting", id: wallet.id });
      setConnecting(true);
      try {
        const connector = (await loadConnectors()).find((c) => c.id === wallet.id);
        if (!connector) throw new Error(`${wallet.name} is not supported.`);
        const next = await withTimeout(connector.getAddress(), wallet.name, CONNECT_TIMEOUT_MS);
        if (attempt !== pickAttempt.current) return;
        writeStored(ADDRESS_KEY, next);
        writeStored(WALLET_ID_KEY, wallet.id);
        setAddress(next);
        setWalletId(wallet.id);
        setPickerStatus({ name: "idle" });
        finishPick(next);
      } catch (error) {
        if (attempt !== pickAttempt.current) return;
        const message =
          (error as { message?: string })?.message || `${wallet.name} did not share an address. Unlock it and try again.`;
        setPickerStatus({ name: "failed", id: wallet.id, message });
        setConnecting(false);
      }
    },
    [finishPick],
  );

  const disconnect = useCallback(async () => {
    writeStored(ADDRESS_KEY, null);
    writeStored(WALLET_ID_KEY, null);
    setAddress(null);
    setWalletId(null);
    closeXBullBridge();
  }, []);

  const signerFor = useCallback(
    (forAddress: string): Signer => ({
      publicKey: forAddress,
      signTransaction: async (xdr, options) => {
        if (usingTestWallet()) return (await testWallet()).signTransaction(xdr);
        const id = readStored(WALLET_ID_KEY);
        const connector = (await loadConnectors()).find((c) => c.id === id);
        if (!connector) throw new Error("No wallet is connected. Connect a wallet and try again.");
        const signedTxXdr = await withTimeout(
          connector.signTransaction(xdr, {
            networkPassphrase: options?.networkPassphrase ?? network.passphrase,
            address: forAddress,
          }),
          connector.name,
          SIGN_TIMEOUT_MS,
        );
        return { signedTxXdr, signerAddress: forAddress };
      },
    }),
    [],
  );

  const signer = useMemo(() => (address ? signerFor(address) : null), [address, signerFor]);

  const value = useMemo(
    () => ({ address, walletId, restoring, connecting, connect, disconnect, signer, signerFor }),
    [address, walletId, restoring, connecting, connect, disconnect, signer, signerFor],
  );

  return (
    <Context.Provider value={value}>
      {children}
      <WalletPicker open={pickerOpen} wallets={wallets} status={pickerStatus} onPick={pick} onClose={() => finishPick(null)} />
    </Context.Provider>
  );
}

export function useWallet(): WalletContext {
  const context = useContext(Context);
  if (!context) throw new Error("useWallet must be used inside <WalletProvider>");
  return context;
}
