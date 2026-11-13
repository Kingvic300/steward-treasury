#!/usr/bin/env bash
# Regenerates the TypeScript client in packages/treasury-client from the
# deployed contract. Never hand-edit the generated src/index.ts.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require stellar jq

CONTRACT_ID="$(deployment .contractId)"
OUT="$ROOT_DIR/packages/treasury-client"

log "Generating bindings for $CONTRACT_ID..."
retry contract bindings typescript --network "$NETWORK" --id "$CONTRACT_ID" \
  --output-dir "$OUT" --overwrite

# The generator names the package after the output directory; pin the workspace name.
jq '.name = "@steward/treasury-client" | .private = true' "$OUT/package.json" >"$OUT/package.json.tmp"
mv "$OUT/package.json.tmp" "$OUT/package.json"
ok "wrote ${OUT#"$ROOT_DIR"/}"
