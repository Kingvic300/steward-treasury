"use client";

/**
 * Wallet connection through Stellar Wallets Kit (Freighter, xBull, Albedo,
 * Lobstr, Hana). The kit is loaded on demand so it never runs on the server.
 *
 * When NEXT_PUBLIC_ENABLE_TEST_WALLET is "true" a local test wallet replaces
 * the kit: it signs with a secret key read from localStorage. Playwright uses
 * it to drive real testnet transactions. It must never be enabled in production.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WalletPicker, type PickerStatus, type WalletOption } from "@/components/wallet-picker";
import { network, testWalletEnabled } from "./network";
import type { Signer } from "./treasury";

const ADDRESS_KEY = "steward:wallet-address";
export const TEST_SECRET_KEY = "steward:test-wallet-secret";

interface WalletContext {
  address: string | null;
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

let kitReady: Promise<typeof import("@creit.tech/stellar-wallets-kit/sdk")> | null = null;

interface KitModule {
  productId: string;
  productName: string;
  productIcon: string;
  productUrl: string;
  isAvailable: () => Promise<boolean>;
}
let kitModules: KitModule[] = [];

/** Freighter's extension is published as "Varial" in the kit; people know it as Freighter. */
const DISPLAY_NAMES: Record<string, string> = { varial: "Freighter" };

/**
 * The kit gives each wallet one second to answer "are you installed?". Firefox
 * extensions often take longer, so ask again with a longer allowance.
 */
async function detectWallets(): Promise<{ id: string; name: string; icon: string; url: string; isAvailable: boolean }[]> {
  return Promise.all(
    kitModules.map(async (mod) => {
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 4000));
      const isAvailable = await Promise.race([mod.isAvailable().catch(() => false), timeout]);
      return { id: mod.productId, name: DISPLAY_NAMES[mod.productId] ?? mod.productName, icon: mod.productIcon, url: mod.productUrl, isAvailable };
    }),
  );
}

interface LegacyXBullSdk {
  getAddress?: unknown;
  signTransaction?: unknown;
  connect?: (permissions: { canRequestPublicKey: boolean; canRequestSign: boolean }) => Promise<unknown>;
  getPublicKey?: () => Promise<string>;
  signXDR?: (xdr: string, options?: { network?: string; publicKey?: string }) => Promise<string>;
}

/**
 * Older xBull extensions inject `window.xBullSDK` with connect/getPublicKey/signXDR,
 * while the kit's xBull bridge expects getAddress/signTransaction. Add the newer
 * methods on top of the older ones so both extension versions work.
 */
function shimLegacyXBull() {
  const sdk = (window as unknown as { xBullSDK?: LegacyXBullSdk }).xBullSDK;
  if (!sdk || typeof sdk.getAddress === "function") return;
  if (typeof sdk.getPublicKey !== "function" || typeof sdk.signXDR !== "function") return;
  sdk.getAddress = async () => {
    await sdk.connect?.({ canRequestPublicKey: true, canRequestSign: true });
    return { address: await sdk.getPublicKey!() };
  };
  sdk.signTransaction = async ({ xdr, opts }: { xdr: string; opts?: { networkPassphrase?: string; address?: string } }) => ({
    signedTxXdr: await sdk.signXDR!(xdr, { network: opts?.networkPassphrase, publicKey: opts?.address }),
  });
}

function loadKit() {
  kitReady ??= (async () => {
    shimLegacyXBull();
    const [sdk, types, freighter, xbull, albedo, lobstr, hana] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/types"),
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/xbull"),
      import("@creit.tech/stellar-wallets-kit/modules/albedo"),
      import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
      import("@creit.tech/stellar-wallets-kit/modules/hana"),
    ]);
    const modules = [
      new freighter.FreighterModule(),
      new xbull.xBullModule(),
      new albedo.AlbedoModule(),
      new lobstr.LobstrModule(),
      new hana.HanaModule(),
    ];
    kitModules = modules as unknown as KitModule[];
    sdk.StellarWalletsKit.init({ network: types.Networks.TESTNET, modules });
    return sdk;
  })();
  return kitReady;
}

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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [pickerStatus, setPickerStatus] = useState<PickerStatus>({ name: "loading" });
  const resolvePick = useRef<((address: string | null) => void) | null>(null);
  /** Bumped when the picker closes, so a wallet that answers late is ignored. */
  const pickAttempt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (testWalletEnabled && window.localStorage.getItem(TEST_SECRET_KEY)) {
          const wallet = await testWallet();
          if (!cancelled) setAddress(wallet.address);
        } else {
          const stored = window.localStorage.getItem(ADDRESS_KEY);
          if (stored && !cancelled) setAddress(stored);
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
  }, []);

  const connect = useCallback(async () => {
    if (testWalletEnabled && window.localStorage.getItem(TEST_SECRET_KEY)) {
      const next = (await testWallet()).address;
      setAddress(next);
      return next;
    }
    setPickerStatus({ name: "loading" });
    setPickerOpen(true);
    const picked = new Promise<string | null>((resolve) => {
      resolvePick.current?.(null);
      resolvePick.current = resolve;
    });
    try {
      const kit = await loadKit();
      await kit.StellarWalletsKit.refreshSupportedWallets();
      setWallets(await detectWallets());
      setPickerStatus({ name: "idle" });
    } catch {
      setWallets([]);
      setPickerStatus({ name: "idle" });
    }
    const next = await picked;
    setConnecting(false);
    return next;
  }, []);

  const pick = useCallback(
    async (wallet: WalletOption) => {
      const attempt = ++pickAttempt.current;
      setPickerStatus({ name: "connecting", id: wallet.id });
      setConnecting(true);
      try {
        const kit = await loadKit();
        shimLegacyXBull();
        kit.StellarWalletsKit.setWallet(wallet.id);
        const { address: next } = await kit.StellarWalletsKit.fetchAddress();
        if (attempt !== pickAttempt.current) return; // The person closed the picker meanwhile.
        window.localStorage.setItem(ADDRESS_KEY, next);
        setAddress(next);
        setPickerStatus({ name: "idle" });
        finishPick(next);
      } catch (error) {
        if (attempt !== pickAttempt.current) return;
        const message =
          (error as { message?: string })?.message || `${wallet.name} did not share an address. Unlock it and try again.`;
        setPickerStatus({ name: "failed", id: wallet.id, message });
      } finally {
        setConnecting(false);
      }
    },
    [finishPick],
  );

  const disconnect = useCallback(async () => {
    window.localStorage.removeItem(ADDRESS_KEY);
    setAddress(null);
    if (kitReady) {
      try {
        await (await kitReady).StellarWalletsKit.disconnect();
      } catch {
        // Already disconnected.
      }
    }
  }, []);

  const signerFor = useCallback(
    (forAddress: string): Signer => ({
      publicKey: forAddress,
      signTransaction: async (xdr, options) => {
        if (testWalletEnabled && window.localStorage.getItem(TEST_SECRET_KEY)) {
          return (await testWallet()).signTransaction(xdr);
        }
        const kit = await loadKit();
        return kit.StellarWalletsKit.signTransaction(xdr, {
          networkPassphrase: options?.networkPassphrase ?? network.passphrase,
          address: forAddress,
        });
      },
    }),
    [],
  );

  const signer = useMemo(() => (address ? signerFor(address) : null), [address, signerFor]);

  const value = useMemo(
    () => ({ address, restoring, connecting, connect, disconnect, signer, signerFor }),
    [address, restoring, connecting, connect, disconnect, signer, signerFor],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <WalletPicker
        open={pickerOpen}
        wallets={wallets}
        status={pickerStatus}
        onPick={pick}
        onClose={() => {
          finishPick(null);
          setConnecting(false);
        }}
      />
    </Context.Provider>
  );
}

export function useWallet(): WalletContext {
  const context = useContext(Context);
  if (!context) throw new Error("useWallet must be used inside <WalletProvider>");
  return context;
}
