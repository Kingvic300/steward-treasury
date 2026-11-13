import deployment from "@deployments/testnet.json";

export interface TokenInfo {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
}

export const network = {
  name: deployment.network,
  passphrase: deployment.networkPassphrase,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || deployment.rpcUrl,
  horizonUrl: deployment.horizonUrl,
  explorerUrl: "https://stellar.expert/explorer/testnet",
  friendbotUrl: "https://friendbot.stellar.org",
} as const;

/** The demo treasury deployed by scripts/deploy.sh. */
export const demo = {
  contractId: deployment.contractId,
  wasmHash: deployment.wasmHash,
  deployedAt: deployment.deployedAt,
} as const;

export const knownTokens: TokenInfo[] = [deployment.tokens.native, deployment.tokens.demo].map(
  ({ id, symbol, name, decimals }) => ({ id, symbol, name, decimals }),
);

export const mainnetEnabled = process.env.NEXT_PUBLIC_ENABLE_MAINNET === "true";
export const testWalletEnabled = process.env.NEXT_PUBLIC_ENABLE_TEST_WALLET === "true";

export const explorer = {
  tx: (hash: string) => `${network.explorerUrl}/tx/${hash}`,
  account: (address: string) => `${network.explorerUrl}/account/${address}`,
  contract: (id: string) => `${network.explorerUrl}/contract/${id}`,
  address: (address: string) =>
    address.startsWith("C") ? explorer.contract(address) : explorer.account(address),
};
