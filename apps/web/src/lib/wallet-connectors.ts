/**
 * One connector per wallet. Each connector talks to its wallet directly, so a
 * session does not depend on Stellar Wallets Kit's global state.
 *
 * - Freighter, Albedo, LOBSTR and Hana use the kit's wallet modules as transport.
 * - xBull uses xBull Wallet Connect with `preferredTarget: "website"`. The default
 *   ("extension") calls `window.xBullSDK.getAddress()`, which some installed
 *   extension versions do not have, and others leave on a blank "Site connection"
 *   window. The website target opens xBull's own approval flow instead, and still
 *   hands off to the extension when one is installed.
 */
import type { xBullWalletConnect } from "@creit.tech/xbull-wallet-connect";

export interface WalletConnector {
  id: string;
  name: string;
  icon: string;
  url: string;
  isAvailable: () => Promise<boolean>;
  getAddress: () => Promise<string>;
  signTransaction: (xdr: string, opts: { networkPassphrase: string; address: string }) => Promise<string>;
}

interface KitModule {
  productId: string;
  productName: string;
  productIcon: string;
  productUrl: string;
  isAvailable: () => Promise<boolean>;
  getAddress: () => Promise<{ address: string }>;
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ) => Promise<{ signedTxXdr: string }>;
}

export const CONNECT_TIMEOUT_MS = 30_000;
export const SIGN_TIMEOUT_MS = 120_000;

export async function withTimeout<T>(promise: Promise<T>, label: string, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} did not answer within ${Math.round(ms / 1000)} seconds. Check the wallet window and try again.`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let xbullBridge: xBullWalletConnect | undefined;

async function freshXBullBridge(): Promise<xBullWalletConnect> {
  const { xBullWalletConnect } = await import("@creit.tech/xbull-wallet-connect");
  xbullBridge?.closeConnections();
  xbullBridge = new xBullWalletConnect({ preferredTarget: "website" });
  return xbullBridge;
}

async function xbullBridgeForSigning(): Promise<xBullWalletConnect> {
  return xbullBridge ?? freshXBullBridge();
}

export function closeXBullBridge() {
  xbullBridge?.closeConnections();
  xbullBridge = undefined;
}

const xbull: WalletConnector = {
  id: "xbull",
  name: "xBull",
  icon: "https://stellar.creit.tech/wallet-icons/xbull.png",
  url: "https://xbull.app",
  // The bridge falls back to xBull's web app, so xBull is always usable.
  isAvailable: async () => true,
  getAddress: async () => {
    // A fresh bridge per attempt: a retried connect must not inherit listeners from an abandoned one.
    const bridge = await freshXBullBridge();
    const address = await bridge.connect();
    if (!address) throw new Error("xBull did not share an address.");
    return address;
  },
  signTransaction: async (xdr, { networkPassphrase, address }) => {
    const bridge = await xbullBridgeForSigning();
    const signed = await bridge.sign({ xdr, publicKey: address, network: networkPassphrase });
    if (!signed) throw new Error("xBull declined to sign.");
    return signed;
  },
};

/** Freighter's module is named "Varial" in the kit; people know it as Freighter. */
const DISPLAY_NAMES: Record<string, string> = { varial: "Freighter" };

function fromKitModule(mod: KitModule): WalletConnector {
  return {
    id: mod.productId,
    name: DISPLAY_NAMES[mod.productId] ?? mod.productName,
    icon: mod.productIcon,
    url: mod.productUrl,
    isAvailable: () => mod.isAvailable(),
    getAddress: async () => (await mod.getAddress()).address,
    signTransaction: async (xdr, opts) => (await mod.signTransaction(xdr, opts)).signedTxXdr,
  };
}

let connectorsReady: Promise<WalletConnector[]> | null = null;

/** Loaded on demand so wallet code never runs on the server. */
export function loadConnectors(): Promise<WalletConnector[]> {
  connectorsReady ??= (async () => {
    const [sdk, types, freighter, albedo, lobstr, hana] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/types"),
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/albedo"),
      import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
      import("@creit.tech/stellar-wallets-kit/modules/hana"),
    ]);
    const modules = [new freighter.FreighterModule(), new albedo.AlbedoModule(), new lobstr.LobstrModule(), new hana.HanaModule()];
    // Some modules read the selected network from the kit, so it is still initialised.
    sdk.StellarWalletsKit.init({ network: types.Networks.TESTNET, modules });
    const kitConnectors = (modules as unknown as KitModule[]).map(fromKitModule);
    return [kitConnectors[0]!, xbull, ...kitConnectors.slice(1)];
  })();
  return connectorsReady;
}

/** Firefox extensions can take a few seconds to say they are installed. */
export async function detectAvailability(connectors: WalletConnector[]) {
  return Promise.all(
    connectors.map(async (connector) => {
      const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 4000));
      const isAvailable = await Promise.race([connector.isAvailable().catch(() => false), timeout]);
      return { id: connector.id, name: connector.name, icon: connector.icon, url: connector.url, isAvailable };
    }),
  );
}
