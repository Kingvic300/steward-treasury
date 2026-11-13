#!/usr/bin/env bash
# Builds Steward and deploys a fresh demo treasury to testnet.
#
# Re-runnable: every run uploads the Wasm (a no-op if unchanged), deploys a new
# treasury instance, and rewrites deployments/testnet.json.
#
# Demo config: 2-of-3 approvers, 5 min timelock, 7 day voting period,
# 3 day execution window. Override with THRESHOLD / TIMELOCK_DELAY /
# VOTING_PERIOD / EXECUTION_WINDOW (seconds).

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require stellar jq curl

THRESHOLD="${THRESHOLD:-2}"
TIMELOCK_DELAY="${TIMELOCK_DELAY:-300}"
VOTING_PERIOD="${VOTING_PERIOD:-604800}"
EXECUTION_WINDOW="${EXECUTION_WINDOW:-259200}"
DEMO_ASSET_CODE="${DEMO_ASSET_CODE:-STWD}"
XLM_FUNDING="${XLM_FUNDING:-1000}"        # whole XLM sent to the treasury
DEMO_FUNDING="${DEMO_FUNDING:-1000000}"   # whole demo tokens minted to it
STROOPS=10000000

"$ROOT_DIR/scripts/setup-identities.sh"

DEPLOYER_ADDRESS="$(address_of "$DEPLOYER")"
S1="$(address_of "$SIGNER1")"
S2="$(address_of "$SIGNER2")"
S3="$(address_of "$SIGNER3")"
EXECUTOR_ADDRESS="$(address_of "$EXECUTOR")"
OPS_ADDRESS="$(address_of "$OPS")"

# 1. Build (the CLI optimises the Wasm as part of the build).
log "Building the contract..."
(cd "$ROOT_DIR" && stellar contract build --optimize)
WASM="$ROOT_DIR/target/wasm32v1-none/release/steward_treasury.wasm"
[[ -f "$WASM" ]] || die "build did not produce $WASM"
ok "built $(basename "$WASM") ($(wc -c <"$WASM") bytes)"

# 2. Upload.
log "Uploading the Wasm..."
WASM_HASH="$(retry contract upload --wasm "$WASM" --source-account "$DEPLOYER" --network "$NETWORK")"
[[ "$WASM_HASH" =~ ^[0-9a-f]{64}$ ]] || die "unexpected wasm hash: $WASM_HASH"
ok "wasm hash $WASM_HASH"

# 3. Deploy with constructor arguments.
log "Deploying the treasury ($THRESHOLD of 3)..."
CONFIG="$(jq -nc \
  --argjson threshold "$THRESHOLD" \
  --argjson timelock "$TIMELOCK_DELAY" \
  --argjson voting "$VOTING_PERIOD" \
  --argjson window "$EXECUTION_WINDOW" \
  '{threshold: $threshold, timelock_delay: $timelock, voting_period: $voting, execution_window: $window}')"
CONTRACT_ID="$(retry contract deploy \
  --wasm-hash "$WASM_HASH" --source-account "$DEPLOYER" --network "$NETWORK" \
  -- \
  --approvers "[\"$S1\",\"$S2\",\"$S3\"]" \
  --proposers "[\"$S1\",\"$S2\",\"$S3\"]" \
  --executors "[\"$EXECUTOR_ADDRESS\"]" \
  --config "$CONFIG")"
[[ "$CONTRACT_ID" =~ ^C[A-Z2-7]{55}$ ]] || die "unexpected contract id: $CONTRACT_ID"
ok "treasury $CONTRACT_ID"

# 4. Native XLM Stellar Asset Contract.
XLM_ID="$(stellar contract id asset --asset native --network "$NETWORK")"
ok "native XLM SAC $XLM_ID"

# 5. Demo token: a classic asset issued by the deployer, wrapped by its SAC.
DEMO_ASSET="$DEMO_ASSET_CODE:$DEPLOYER_ADDRESS"
DEMO_ID="$(stellar contract id asset --asset "$DEMO_ASSET" --network "$NETWORK")"
if stellar contract asset deploy --asset "$DEMO_ASSET" --source-account "$DEPLOYER" --network "$NETWORK" >/dev/null 2>&1; then
  ok "deployed demo token SAC $DEMO_ID ($DEMO_ASSET)"
else
  ok "demo token SAC already deployed $DEMO_ID ($DEMO_ASSET)"
fi

# 6. Fund the treasury.
log "Funding the treasury..."
run_tx "fund XLM" contract invoke --id "$XLM_ID" --source-account "$DEPLOYER" --network "$NETWORK" \
  -- transfer --from "$DEPLOYER_ADDRESS" --to "$CONTRACT_ID" --amount "$((XLM_FUNDING * STROOPS))"
run_tx "mint $DEMO_ASSET_CODE" contract invoke --id "$DEMO_ID" --source-account "$DEPLOYER" --network "$NETWORK" \
  -- mint --to "$CONTRACT_ID" --amount "$((DEMO_FUNDING * STROOPS))"

mkdir -p "$(dirname "$DEPLOYMENT_FILE")"
jq -n \
  --arg network "$NETWORK" \
  --arg passphrase "$NETWORK_PASSPHRASE" \
  --arg rpc "$RPC_URL" \
  --arg horizon "$HORIZON_URL" \
  --arg contract "$CONTRACT_ID" \
  --arg wasm "$WASM_HASH" \
  --arg xlm "$XLM_ID" \
  --arg demo "$DEMO_ID" \
  --arg demo_code "$DEMO_ASSET_CODE" \
  --arg demo_issuer "$DEPLOYER_ADDRESS" \
  --arg deployed_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg s1 "$S1" --arg s2 "$S2" --arg s3 "$S3" \
  --arg executor "$EXECUTOR_ADDRESS" --arg ops "$OPS_ADDRESS" \
  --argjson config "$CONFIG" \
  '{
    network: $network,
    networkPassphrase: $passphrase,
    rpcUrl: $rpc,
    horizonUrl: $horizon,
    contractId: $contract,
    wasmHash: $wasm,
    tokens: {
      native: {id: $xlm, symbol: "XLM", name: "Stellar Lumens", decimals: 7},
      demo: {id: $demo, symbol: $demo_code, name: "Steward Demo Token", decimals: 7, issuer: $demo_issuer}
    },
    config: $config,
    members: {approvers: [$s1, $s2, $s3], proposers: [$s1, $s2, $s3], executors: [$executor], ops: $ops},
    deployedAt: $deployed_at
  }' >"$DEPLOYMENT_FILE"

log "Wrote ${DEPLOYMENT_FILE#"$ROOT_DIR"/}"
echo
echo "Contract id : $CONTRACT_ID"
echo "Wasm hash   : $WASM_HASH"
echo "Explorer    : $EXPLORER_URL/contract/$CONTRACT_ID"
