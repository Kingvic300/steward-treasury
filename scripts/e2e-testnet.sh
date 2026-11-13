#!/usr/bin/env bash
# Runs the REAL Steward lifecycle on testnet through the Stellar CLI:
#
#   1. propose a transfer            4. assert the recipient's balance
#   2. approve as signer1 + signer2  5. set a spending limit, spend within it as
#   3. wait out the timelock, execute   ops, and confirm an over-limit spend fails
#
# Both proposals are created up front so the script waits out the timelock once.
# Every transaction hash is printed with a stellar.expert link.

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require stellar jq curl

CONTRACT_ID="$(deployment .contractId)"
XLM_ID="$(deployment .tokens.native.id)"
S1="$(address_of "$SIGNER1")"
S2="$(address_of "$SIGNER2")"
RECIPIENT="$(address_of "$SIGNER3")"   # signs nothing here, so its balance only moves by transfers
EXECUTOR_ADDRESS="$(address_of "$EXECUTOR")"
OPS_ADDRESS="$(address_of "$OPS")"

STROOPS=10000000
TRANSFER_AMOUNT=$((10 * STROOPS))   # 10 XLM by proposal
LIMIT_HEADROOM=$((5 * STROOPS))     # 5 XLM of fresh allowance for ops
SPEND_AMOUNT=$((2 * STROOPS))       # 2 XLM spent within the limit
LIMIT_PERIOD=86400                  # daily window

invoke() { # invoke <label> <source identity> <function> [args...]
  local label="$1" source="$2"; shift 2
  run_tx "$label" contract invoke --id "$CONTRACT_ID" --source-account "$source" --network "$NETWORK" -- "$@"
}
unquote() { tr -d '"[:space:]'; }
xlm_balance() { view "$XLM_ID" balance --id "$1" | unquote; }
state_of() { view "$CONTRACT_ID" proposal_state --id "$1" | unquote; }

log "Treasury $CONTRACT_ID"
log "$EXPLORER_URL/contract/$CONTRACT_ID"
TIMELOCK="$(view "$CONTRACT_ID" get_config | jq -r .timelock_delay)"
RECIPIENT_BEFORE="$(xlm_balance "$RECIPIENT")"
TREASURY_BEFORE="$(view "$CONTRACT_ID" balance --token "$XLM_ID" | unquote)"
log "timelock ${TIMELOCK}s, recipient balance $RECIPIENT_BEFORE, treasury balance $TREASURY_BEFORE stroops"

# ------------------------------------------------------------ 1. propose
log "1. Proposing a transfer of 10 XLM..."
TRANSFER_ACTIONS="$(jq -nc --arg token "$XLM_ID" --arg to "$RECIPIENT" --arg amount "$TRANSFER_AMOUNT" \
  '[{Transfer: {token: $token, to: $to, amount: $amount}}]')"
TRANSFER_ID="$(invoke "propose transfer" "$SIGNER1" propose \
  --proposer "$S1" --actions "$TRANSFER_ACTIONS" --memo "e2e: pay 10 XLM" | unquote)"
ok "proposal #$TRANSFER_ID created"

# The limit is "whatever ops already spent this window + 5 XLM", so the script
# behaves the same on a fresh treasury and on one it has already run against.
ALREADY_SPENT="$(view "$CONTRACT_ID" get_spending_limit --spender "$OPS_ADDRESS" --token "$XLM_ID" | jq -r '.spent // "0"' 2>/dev/null || echo 0)"
LIMIT_AMOUNT=$((ALREADY_SPENT + LIMIT_HEADROOM))
log "   Proposing a spending limit of $LIMIT_AMOUNT stroops per day for ops..."
LIMIT_ACTIONS="$(jq -nc --arg spender "$OPS_ADDRESS" --arg token "$XLM_ID" --arg amount "$LIMIT_AMOUNT" --argjson period "$LIMIT_PERIOD" \
  '[{SetSpendingLimit: {spender: $spender, token: $token, amount: $amount, period: $period}}]')"
LIMIT_ID="$(invoke "propose limit" "$SIGNER1" propose \
  --proposer "$S1" --actions "$LIMIT_ACTIONS" --memo "e2e: ops daily limit" | unquote)"
ok "proposal #$LIMIT_ID created"

# ------------------------------------------------------------ 2. approve
log "2. Approving as signer1 and signer2..."
for id in "$TRANSFER_ID" "$LIMIT_ID"; do
  invoke "approve #$id (signer1)" "$SIGNER1" approve --approver "$S1" --id "$id" >/dev/null
  [[ "$(state_of "$id")" == "0" ]] || die "proposal #$id should still be Pending after 1 of 2 approvals"
  invoke "approve #$id (signer2)" "$SIGNER2" approve --approver "$S2" --id "$id" >/dev/null
  [[ "$(state_of "$id")" == "1" ]] || die "proposal #$id should be Queued after 2 of 2 approvals"
done
ok "both proposals are queued"

expect_fail "early execute" "#20" contract invoke --id "$CONTRACT_ID" --source-account "$EXECUTOR" \
  --network "$NETWORK" -- execute --executor "$EXECUTOR_ADDRESS" --id "$TRANSFER_ID"

# ------------------------------------------------- 3. timelock, then execute
log "3. Waiting out the ${TIMELOCK}s timelock..."
DEADLINE=$((SECONDS + TIMELOCK + 180))
until [[ "$(state_of "$LIMIT_ID")" == "2" ]]; do
  (( SECONDS < DEADLINE )) || die "proposals did not become Ready in time"
  sleep 15
done
ok "timelock elapsed; proposals are ready"

invoke "execute #$TRANSFER_ID" "$EXECUTOR" execute --executor "$EXECUTOR_ADDRESS" --id "$TRANSFER_ID" >/dev/null
invoke "execute #$LIMIT_ID" "$EXECUTOR" execute --executor "$EXECUTOR_ADDRESS" --id "$LIMIT_ID" >/dev/null
[[ "$(state_of "$TRANSFER_ID")" == "3" ]] || die "transfer proposal is not Executed"

expect_fail "replay execute" "#30" contract invoke --id "$CONTRACT_ID" --source-account "$EXECUTOR" \
  --network "$NETWORK" -- execute --executor "$EXECUTOR_ADDRESS" --id "$TRANSFER_ID"

# ----------------------------------------------------- 4. assert the balance
log "4. Checking the recipient's balance..."
RECIPIENT_AFTER="$(xlm_balance "$RECIPIENT")"
[[ "$RECIPIENT_AFTER" == "$((RECIPIENT_BEFORE + TRANSFER_AMOUNT))" ]] \
  || die "recipient balance is $RECIPIENT_AFTER, expected $((RECIPIENT_BEFORE + TRANSFER_AMOUNT))"
ok "recipient received exactly $TRANSFER_AMOUNT stroops ($RECIPIENT_BEFORE -> $RECIPIENT_AFTER)"

# --------------------------------------------------------- 5. spending limit
log "5. Spending as ops within the limit..."
invoke "spend 2 XLM (ops)" "$OPS" spend \
  --spender "$OPS_ADDRESS" --token "$XLM_ID" --to "$RECIPIENT" --amount "$SPEND_AMOUNT" >/dev/null
RECIPIENT_FINAL="$(xlm_balance "$RECIPIENT")"
[[ "$RECIPIENT_FINAL" == "$((RECIPIENT_AFTER + SPEND_AMOUNT))" ]] \
  || die "recipient balance is $RECIPIENT_FINAL after the spend, expected $((RECIPIENT_AFTER + SPEND_AMOUNT))"
ok "ops spent $SPEND_AMOUNT stroops with no proposal"

LIMIT_NOW="$(view "$CONTRACT_ID" get_spending_limit --spender "$OPS_ADDRESS" --token "$XLM_ID")"
REMAINING=$(( $(jq -r .amount <<<"$LIMIT_NOW") - $(jq -r .spent <<<"$LIMIT_NOW") ))
log "   $REMAINING stroops left this window; trying to spend one stroop more..."
expect_fail "over-limit spend" "#28" contract invoke --id "$CONTRACT_ID" --source-account "$OPS" \
  --network "$NETWORK" -- spend --spender "$OPS_ADDRESS" --token "$XLM_ID" --to "$RECIPIENT" --amount "$((REMAINING + 1))"

TREASURY_AFTER="$(view "$CONTRACT_ID" balance --token "$XLM_ID" | unquote)"
[[ "$TREASURY_AFTER" == "$((TREASURY_BEFORE - TRANSFER_AMOUNT - SPEND_AMOUNT))" ]] \
  || die "treasury balance is $TREASURY_AFTER, expected $((TREASURY_BEFORE - TRANSFER_AMOUNT - SPEND_AMOUNT))"

echo
log "E2E PASSED. Transactions:"
while read -r line; do
  hash="${line##* }"
  printf '  %-28s %s\n' "${line% *}" "$(tx_link "$hash")"
done <"$TX_LOG"
