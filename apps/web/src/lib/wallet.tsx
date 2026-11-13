"use client";

/**
 * Wallet connection through Stellar Wallets Kit (Freighter, xBull, Albedo,
 * Lobstr, Hana). The kit is loaded on demand so it never runs on the server.
 *
 * When NEXT_PUBLIC_ENABLE_TEST_WALLET is "true" a local test wallet replaces
 * the kit: it signs with a secret key read from localStorage. Playwright uses
 * it to drive real testnet transactions. It must never be enabled in production.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

function loadKit() {
  kitReady ??= (async () => {
    const [sdk, types, freighter, xbull, albedo, lobstr, hana] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/types"),
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/xbull"),
      import("@creit.tech/stellar-wallets-kit/modules/albedo"),
      import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
      import("@creit.tech/stellar-wallets-kit/modules/hana"),
    ]);
    sdk.StellarWalletsKit.init({
      network: types.Networks.TESTNET,
      modules: [
        new freighter.FreighterModule(),
        new xbull.xBullModule(),
        new albedo.AlbedoModule(),
        new lobstr.LobstrModule(),
        new hana.HanaModule(),
      ],
    });
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

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      let next: string;
      if (testWalletEnabled && window.localStorage.getItem(TEST_SECRET_KEY)) {
        next = (await testWallet()).address;
      } else {
        const kit = await loadKit();
        next = (await kit.StellarWalletsKit.authModal()).address;
        window.localStorage.setItem(ADDRESS_KEY, next);
      }
      setAddress(next);
      return next;
    } catch {
      return null; // The person closed the wallet picker.
    } finally {
      setConnecting(false);
    }
  }, []);

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
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWallet(): WalletContext {
  const context = useContext(Context);
  if (!context) throw new Error("useWallet must be used inside <WalletProvider>");
  return context;
}
