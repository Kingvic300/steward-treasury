#!/usr/bin/env bash
# Creates and funds the testnet identities Steward's scripts use.
#
# Idempotent: existing keys are kept, and accounts that vanished in a testnet
# reset are funded again through Friendbot.
#
# Keys live in the Stellar CLI config directory (never in this repository).

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require stellar curl

# Friendbot is rate limited and the CLI can report success when funding failed,
# so trust only what Horizon says and retry.
ensure_funded() {
  local name="$1" address attempt
  address="$(address_of "$name")"
  for attempt in 1 2 3 4 5; do
    if account_exists "$address"; then
      return 0
    fi
    stellar keys fund "$name" --network "$NETWORK" >/dev/null 2>&1 || true
    sleep $((attempt * 2))
  done
  account_exists "$address"
}

for name in "${IDENTITIES[@]}"; do
  if stellar keys address "$name" >/dev/null 2>&1; then
    if account_exists "$(address_of "$name")"; then
      ok "$name exists and is funded ($(address_of "$name"))"
      continue
    fi
    log "$name exists but has no account on $NETWORK (testnet reset?). Funding..."
  else
    log "Generating $name..."
    stellar keys generate "$name" --network "$NETWORK" >/dev/null 2>&1 \
      || die "could not generate key $name"
  fi
  ensure_funded "$name" || die "Friendbot could not fund $name; try again in a minute"
  ok "$name funded ($(address_of "$name"))"
done

log "Identities ready:"
for name in "${IDENTITIES[@]}"; do
  printf '  %-10s %s\n' "$name" "$(address_of "$name")" >&2
done
