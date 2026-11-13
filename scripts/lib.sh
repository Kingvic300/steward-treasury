#!/usr/bin/env bash
# Shared helpers for the Steward testnet scripts. Source this file; do not run it.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR

export NETWORK="${STELLAR_NETWORK:-testnet}"
export RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
export NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
export HORIZON_URL="${STELLAR_HORIZON_URL:-https://horizon-testnet.stellar.org}"
export EXPLORER_URL="https://stellar.expert/explorer/testnet"
export DEPLOYMENT_FILE="$ROOT_DIR/deployments/testnet.json"

# Identity names. Override the prefix to keep several sets side by side.
IDENTITY_PREFIX="${STEWARD_IDENTITY_PREFIX:-}"
export DEPLOYER="${IDENTITY_PREFIX}deployer"
export SIGNER1="${IDENTITY_PREFIX}signer1"
export SIGNER2="${IDENTITY_PREFIX}signer2"
export SIGNER3="${IDENTITY_PREFIX}signer3"
export EXECUTOR="${IDENTITY_PREFIX}executor"
export OPS="${IDENTITY_PREFIX}ops"
IDENTITIES=("$DEPLOYER" "$SIGNER1" "$SIGNER2" "$SIGNER3" "$EXECUTOR" "$OPS")

if [[ "$NETWORK" != "testnet" ]]; then
  echo "error: these scripts only target testnet (got NETWORK=$NETWORK)." >&2
  echo "Steward is unaudited and must not be deployed to mainnet." >&2
  exit 1
fi

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*" >&2; }
ok()   { printf '\033[1;32m ok\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[1;33mwarn\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31merror\033[0m %s\n' "$*" >&2; exit 1; }

require() {
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || die "missing required tool: $tool"
  done
}

address_of() { stellar keys address "$1"; }

account_exists() {
  local status
  status="$(curl -s -o /dev/null -w '%{http_code}' "$HORIZON_URL/accounts/$1")"
  [[ "$status" == "200" ]]
}

tx_link() { echo "$EXPLORER_URL/tx/$1"; }

# Every hash printed by `run_tx`, so scripts can summarise at the end.
TX_LOG="${TX_LOG:-$(mktemp)}"
export TX_LOG

# run_tx <label> <stellar args...>
# Runs a state-changing CLI command, prints the tx hash with an explorer link,
# and writes the command's stdout (the contract's return value) to stdout.
run_tx() {
  local label="$1"; shift
  local stderr_file hash status=0
  stderr_file="$(mktemp)"
  # Public testnet RPC times out now and then; retry only on transport errors,
  # never on a contract error.
  local attempt
  for attempt in 1 2 3 4; do
    status=0
    stellar "$@" 2>"$stderr_file" || status=$?
    if [[ $status -eq 0 ]] || ! grep -qiE 'timeout|timed out|connection (reset|refused|closed)|bad gateway|service unavailable|too many requests|TryAgainLater' "$stderr_file"; then
      break
    fi
    warn "$label: network error, retrying ($attempt/4)..."
    sleep $((attempt * 5))
  done
  hash="$(grep -oE '[0-9a-f]{64}' "$stderr_file" | head -n1 || true)"
  if [[ $status -ne 0 ]]; then
    cat "$stderr_file" >&2
    rm -f "$stderr_file"
    return $status
  fi
  rm -f "$stderr_file"
  if [[ -n "$hash" ]]; then
    printf '\033[1;32m tx\033[0m %-28s %s\n' "$label" "$(tx_link "$hash")" >&2
    echo "$label $hash" >>"$TX_LOG"
  else
    warn "$label: no transaction hash found in CLI output"
  fi
}

# expect_fail <label> <expected substring> <stellar args...>
# Succeeds only if the command fails and its output mentions the substring.
expect_fail() {
  local label="$1" expected="$2"; shift 2
  local output
  if output="$(stellar "$@" 2>&1)"; then
    die "$label: expected failure, but the command succeeded"
  fi
  if ! grep -q -- "$expected" <<<"$output"; then
    echo "$output" >&2
    die "$label: failed, but not with '$expected'"
  fi
  ok "$label: rejected as expected ($expected)"
}

# view <contract id> <function> [args...]: read-only call (simulation only).
# Retries, because the public RPC drops requests now and then.
view() {
  local contract="$1"; shift
  local attempt output
  for attempt in 1 2 3 4 5; do
    if output="$(stellar contract invoke --id "$contract" --source-account "$DEPLOYER" \
      --network "$NETWORK" --send=no -- "$@" 2>/dev/null)"; then
      echo "$output"
      return 0
    fi
    sleep $((attempt * 3))
  done
  die "read call failed after 5 attempts: $*"
}

# retry <stellar args...>: for idempotent CLI calls (upload, deploy, reads).
retry() {
  local attempt
  for attempt in 1 2 3 4; do
    if stellar "$@"; then
      return 0
    fi
    warn "command failed, retrying ($attempt/4)..."
    sleep $((attempt * 5))
  done
  return 1
}

deployment() {
  [[ -f "$DEPLOYMENT_FILE" ]] || die "no deployment found: run scripts/deploy.sh first"
  jq -er "$1" "$DEPLOYMENT_FILE"
}
