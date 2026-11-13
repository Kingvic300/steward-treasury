use soroban_sdk::{
    contract, contractimpl, panic_with_error, symbol_short, token, Address, ContractExecutable,
    Env, String, Symbol, Val, Vec,
};
use stellar_access::access_control;

use crate::errors::TreasuryError;
use crate::events;
use crate::rules::{self, Tally};
use crate::storage;
use crate::types::{
    Action, Config, Proposal, ProposalState, ProposalStatus, Role, SpendingLimit,
    SpendingLimitEntry, SpendingLimitKey, Vote, MAX_ACTIONS, MAX_APPROVERS, MAX_MEMBERS_PER_ROLE,
    MAX_MEMO_BYTES, MAX_PAGE_SIZE, MAX_SPENDING_LIMITS,
};

fn role_symbol(role: Role) -> Symbol {
    match role {
        Role::Proposer => symbol_short!("proposer"),
        Role::Approver => symbol_short!("approver"),
        Role::Executor => symbol_short!("executor"),
    }
}

fn holds_role(e: &Env, account: &Address, role: Role) -> bool {
    access_control::has_role(e, account, &role_symbol(role)).is_some()
}

fn role_count(e: &Env, role: Role) -> u32 {
    access_control::get_role_member_count(e, &role_symbol(role))
}

/// Grants `role` and immediately extends the TTL of the entries OpenZeppelin
/// just wrote. Without this a new member's role entries would start at the
/// network's minimum persistent TTL instead of the 90 days existing members get.
fn grant(e: &Env, account: &Address, role: Role) {
    let symbol = role_symbol(role);
    let treasury = e.current_contract_address();
    access_control::grant_role_no_auth(e, account, &symbol, &treasury);
    // Both readers extend the TTL of the entry they touch.
    if let Some(index) = access_control::has_role(e, account, &symbol) {
        access_control::get_role_member(e, &symbol, index);
    }
}

fn role_cap(role: Role) -> u32 {
    match role {
        Role::Approver => MAX_APPROVERS,
        Role::Proposer | Role::Executor => MAX_MEMBERS_PER_ROLE,
    }
}

fn has_duplicates(list: &Vec<Address>) -> bool {
    let len = list.len();
    for i in 0..len {
        for j in (i + 1)..len {
            if list.get_unchecked(i) == list.get_unchecked(j) {
                return true;
            }
        }
    }
    false
}

fn validate_role_list(list: &Vec<Address>, role: Role) -> Result<(), TreasuryError> {
    if list.is_empty() {
        return Err(TreasuryError::EmptyRole);
    }
    if list.len() > role_cap(role) {
        return Err(TreasuryError::TooManyMembers);
    }
    if has_duplicates(list) {
        return Err(TreasuryError::DuplicateMember);
    }
    Ok(())
}

fn validate_config(config: &Config, approver_count: u32) -> Result<(), TreasuryError> {
    if config.threshold == 0 || config.threshold > approver_count {
        return Err(TreasuryError::InvalidThreshold);
    }
    if config.voting_period == 0 || config.execution_window == 0 {
        return Err(TreasuryError::InvalidDuration);
    }
    Ok(())
}

/// Checks that can be made when a proposal is created. Checks that depend on
/// state at execution time (membership, balances) happen in `run_action`.
fn validate_action(action: &Action) -> Result<(), TreasuryError> {
    match action {
        Action::Transfer(t) if t.amount <= 0 => Err(TreasuryError::InvalidAmount),
        Action::SetThreshold(0) => Err(TreasuryError::InvalidThreshold),
        Action::SetVotingPeriod(0) | Action::SetExecutionWindow(0) => {
            Err(TreasuryError::InvalidDuration)
        }
        Action::SetSpendingLimit(l) if l.amount <= 0 => Err(TreasuryError::InvalidAmount),
        Action::SetSpendingLimit(l) if l.period == 0 => Err(TreasuryError::InvalidPeriod),
        _ => Ok(()),
    }
}

fn derive_state(e: &Env, proposal: &Proposal, config: &Config, version: u32) -> ProposalState {
    let now = e.ledger().timestamp();
    match proposal.status {
        ProposalStatus::Executed => ProposalState::Executed,
        ProposalStatus::Cancelled => ProposalState::Cancelled,
        ProposalStatus::Rejected => ProposalState::Rejected,
        _ if proposal.config_version != version => ProposalState::Stale,
        ProposalStatus::Pending => {
            if now > proposal.voting_ends_at {
                ProposalState::Expired
            } else {
                ProposalState::Pending
            }
        }
        ProposalStatus::Queued => {
            let eta = proposal.eta.unwrap_or(u64::MAX);
            if now < eta {
                ProposalState::Queued
            } else if now > eta.saturating_add(config.execution_window) {
                ProposalState::Expired
            } else {
                ProposalState::Ready
            }
        }
    }
}

fn cast_vote(
    e: &Env,
    voter: &Address,
    id: u64,
    approve: bool,
) -> Result<ProposalStatus, TreasuryError> {
    voter.require_auth();
    storage::extend_instance(e);
    if !holds_role(e, voter, Role::Approver) {
        return Err(TreasuryError::NotApprover);
    }

    let mut proposal = storage::get_proposal(e, id)?;
    if proposal.status != ProposalStatus::Pending {
        return Err(TreasuryError::ProposalNotPending);
    }
    if proposal.config_version != storage::get_config_version(e) {
        return Err(TreasuryError::ProposalStale);
    }
    let now = e.ledger().timestamp();
    if now > proposal.voting_ends_at {
        return Err(TreasuryError::VotingClosed);
    }
    if proposal.votes.iter().any(|v| &v.voter == voter) {
        return Err(TreasuryError::AlreadyVoted);
    }

    proposal.votes.push_back(Vote {
        voter: voter.clone(),
        approve,
        timestamp: now,
    });
    if approve {
        proposal.approvals = proposal
            .approvals
            .checked_add(1)
            .ok_or(TreasuryError::Overflow)?;
    } else {
        proposal.rejections = proposal
            .rejections
            .checked_add(1)
            .ok_or(TreasuryError::Overflow)?;
    }

    events::Voted {
        id,
        voter: voter.clone(),
        approve,
        approvals: proposal.approvals,
        rejections: proposal.rejections,
    }
    .publish(e);

    let config = storage::get_config(e);
    match rules::tally(
        role_count(e, Role::Approver),
        config.threshold,
        proposal.approvals,
        proposal.rejections,
    ) {
        Tally::Queue => {
            let eta = now
                .checked_add(config.timelock_delay)
                .ok_or(TreasuryError::Overflow)?;
            proposal.status = ProposalStatus::Queued;
            proposal.queued_at = Some(now);
            proposal.eta = Some(eta);
            events::ProposalQueued { id, eta }.publish(e);
        }
        Tally::Reject => {
            proposal.status = ProposalStatus::Rejected;
            proposal.closed_at = Some(now);
            events::ProposalRejected { id }.publish(e);
        }
        Tally::Open => {}
    }

    storage::set_proposal(e, &proposal);
    Ok(proposal.status)
}

/// Runs one action. Sets `governance_changed` when membership, config or code
/// changed, so the caller can re-check invariants and bump the config version.
fn run_action(e: &Env, action: Action, governance_changed: &mut bool) -> Result<(), TreasuryError> {
    let treasury = e.current_contract_address();
    match action {
        Action::Transfer(t) => {
            if t.amount <= 0 {
                return Err(TreasuryError::InvalidAmount);
            }
            token::TokenClient::new(e, &t.token).transfer(&treasury, &t.to, &t.amount);
        }
        Action::Invoke(i) => {
            // The treasury is the direct invoker, so the host satisfies any
            // `require_auth` on the treasury's address inside this call.
            e.invoke_contract::<Val>(&i.contract, &i.function, i.args);
        }
        Action::AddMember(m) => {
            if holds_role(e, &m.account, m.role) {
                return Err(TreasuryError::MemberAlreadyExists);
            }
            if role_count(e, m.role) >= role_cap(m.role) {
                return Err(TreasuryError::TooManyMembers);
            }
            grant(e, &m.account, m.role);
            events::MemberAdded {
                account: m.account,
                role: m.role,
            }
            .publish(e);
            *governance_changed = true;
        }
        Action::RemoveMember(m) => {
            if !holds_role(e, &m.account, m.role) {
                return Err(TreasuryError::MemberNotFound);
            }
            if role_count(e, m.role) <= 1 {
                return Err(TreasuryError::LastMember);
            }
            access_control::revoke_role_no_auth(e, &m.account, &role_symbol(m.role), &treasury);
            events::MemberRemoved {
                account: m.account,
                role: m.role,
            }
            .publish(e);
            *governance_changed = true;
        }
        Action::SetThreshold(threshold) => {
            if threshold == 0 {
                return Err(TreasuryError::InvalidThreshold);
            }
            let mut config = storage::get_config(e);
            config.threshold = threshold;
            storage::set_config(e, &config);
            *governance_changed = true;
        }
        Action::SetTimelockDelay(delay) => {
            let mut config = storage::get_config(e);
            config.timelock_delay = delay;
            storage::set_config(e, &config);
            *governance_changed = true;
        }
        Action::SetVotingPeriod(period) => {
            if period == 0 {
                return Err(TreasuryError::InvalidDuration);
            }
            let mut config = storage::get_config(e);
            config.voting_period = period;
            storage::set_config(e, &config);
            *governance_changed = true;
        }
        Action::SetExecutionWindow(window) => {
            if window == 0 {
                return Err(TreasuryError::InvalidDuration);
            }
            let mut config = storage::get_config(e);
            config.execution_window = window;
            storage::set_config(e, &config);
            *governance_changed = true;
        }
        Action::SetSpendingLimit(l) => {
            if l.amount <= 0 {
                return Err(TreasuryError::InvalidAmount);
            }
            if l.period == 0 {
                return Err(TreasuryError::InvalidPeriod);
            }
            let key = SpendingLimitKey {
                spender: l.spender.clone(),
                token: l.token.clone(),
            };
            let now = e.ledger().timestamp();
            // Replacing a limit must never refund the current window: whatever
            // was spent in the still-running old window carries into the new one.
            let spent = match storage::get_limit(e, &key) {
                Some(old) => rules::roll_window(&old, now).spent,
                None => {
                    let mut index = storage::get_limit_index(e);
                    if index.len() >= MAX_SPENDING_LIMITS {
                        return Err(TreasuryError::TooManySpendingLimits);
                    }
                    index.push_back(key.clone());
                    storage::set_limit_index(e, &index);
                    0
                }
            };
            storage::set_limit(
                e,
                &key,
                &SpendingLimit {
                    amount: l.amount,
                    period: l.period,
                    spent,
                    window_start: rules::window_start(now, l.period),
                },
            );
            events::SpendingLimitSet {
                spender: l.spender,
                token: l.token,
                amount: l.amount,
                period: l.period,
            }
            .publish(e);
        }
        Action::RemoveSpendingLimit(key) => {
            if storage::get_limit(e, &key).is_none() {
                return Err(TreasuryError::NoSpendingLimit);
            }
            storage::remove_limit(e, &key);
            let mut index = storage::get_limit_index(e);
            if let Some(position) = index.first_index_of(&key) {
                index.remove(position);
                storage::set_limit_index(e, &index);
            }
            events::SpendingLimitRemoved {
                spender: key.spender,
                token: key.token,
            }
            .publish(e);
        }
        Action::Upgrade(wasm_hash) => {
            e.deployer()
                .update_current_contract(ContractExecutable::Wasm(wasm_hash.clone()));
            events::Upgraded { wasm_hash }.publish(e);
            *governance_changed = true;
        }
    }
    Ok(())
}

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    /// Deploys a treasury.
    ///
    /// The treasury becomes its own access-control admin, so from this point on
    /// no key — not even the deployer — can change roles or config directly.
    ///
    /// Fails with `EmptyRole`, `TooManyMembers`, `DuplicateMember`,
    /// `InvalidThreshold` or `InvalidDuration` when the inputs are invalid.
    pub fn __constructor(
        e: Env,
        approvers: Vec<Address>,
        proposers: Vec<Address>,
        executors: Vec<Address>,
        config: Config,
    ) {
        let roles = [
            (&approvers, Role::Approver),
            (&proposers, Role::Proposer),
            (&executors, Role::Executor),
        ];
        for (list, role) in roles {
            if let Err(error) = validate_role_list(list, role) {
                panic_with_error!(&e, error);
            }
        }
        if let Err(error) = validate_config(&config, approvers.len()) {
            panic_with_error!(&e, error);
        }

        let treasury = e.current_contract_address();
        access_control::set_admin(&e, &treasury);
        for (list, role) in roles {
            for account in list.iter() {
                grant(&e, &account, role);
            }
        }

        storage::set_config(&e, &config);
        storage::set_config_version(&e, 0);
        storage::set_proposal_count(&e, 0);
        storage::extend_instance(&e);

        events::ConfigUpdated {
            config_version: 0,
            config,
        }
        .publish(&e);
    }

    // ------------------------------------------------------------ lifecycle

    /// Creates a proposal bundling 1 to 10 actions. Returns its id.
    ///
    /// Requires the proposer role and `proposer`'s authorisation.
    pub fn propose(
        e: Env,
        proposer: Address,
        actions: Vec<Action>,
        memo: String,
    ) -> Result<u64, TreasuryError> {
        proposer.require_auth();
        storage::extend_instance(&e);
        if !holds_role(&e, &proposer, Role::Proposer) {
            return Err(TreasuryError::NotProposer);
        }
        if actions.is_empty() {
            return Err(TreasuryError::NoActions);
        }
        if actions.len() > MAX_ACTIONS {
            return Err(TreasuryError::TooManyActions);
        }
        if memo.len() > MAX_MEMO_BYTES {
            return Err(TreasuryError::MemoTooLong);
        }
        for action in actions.iter() {
            validate_action(&action)?;
        }

        let config = storage::get_config(&e);
        let config_version = storage::get_config_version(&e);
        let id = storage::get_proposal_count(&e)
            .checked_add(1)
            .ok_or(TreasuryError::Overflow)?;
        let now = e.ledger().timestamp();
        let voting_ends_at = now
            .checked_add(config.voting_period)
            .ok_or(TreasuryError::Overflow)?;
        let action_count = actions.len();

        storage::set_proposal(
            &e,
            &Proposal {
                id,
                proposer: proposer.clone(),
                actions,
                memo,
                config_version,
                created_at: now,
                voting_ends_at,
                votes: Vec::new(&e),
                approvals: 0,
                rejections: 0,
                status: ProposalStatus::Pending,
                queued_at: None,
                eta: None,
                closed_at: None,
            },
        );
        storage::set_proposal_count(&e, id);

        events::ProposalCreated {
            id,
            proposer,
            action_count,
            voting_ends_at,
            config_version,
        }
        .publish(&e);
        Ok(id)
    }

    /// Votes in favour. When approvals reach the threshold the proposal is
    /// queued with `eta = now + timelock_delay`. Returns the new status.
    pub fn approve(e: Env, approver: Address, id: u64) -> Result<ProposalStatus, TreasuryError> {
        cast_vote(&e, &approver, id, true)
    }

    /// Votes against. When the threshold can no longer be reached the proposal
    /// is rejected. Returns the new status.
    pub fn reject(e: Env, approver: Address, id: u64) -> Result<ProposalStatus, TreasuryError> {
        cast_vote(&e, &approver, id, false)
    }

    /// Cancels a pending or queued proposal. Only the original proposer may
    /// cancel, which gives the timelock its purpose: a window to back out.
    pub fn cancel(e: Env, proposer: Address, id: u64) -> Result<(), TreasuryError> {
        proposer.require_auth();
        storage::extend_instance(&e);
        let mut proposal = storage::get_proposal(&e, id)?;
        if proposal.proposer != proposer {
            return Err(TreasuryError::NotProposalCreator);
        }
        if !matches!(
            proposal.status,
            ProposalStatus::Pending | ProposalStatus::Queued
        ) {
            return Err(TreasuryError::CannotCancel);
        }
        proposal.status = ProposalStatus::Cancelled;
        proposal.closed_at = Some(e.ledger().timestamp());
        storage::set_proposal(&e, &proposal);
        events::ProposalCancelled { id }.publish(&e);
        Ok(())
    }

    /// Executes a queued proposal once its timelock has elapsed and before its
    /// execution window closes. All actions run atomically: if one fails, the
    /// whole transaction reverts.
    pub fn execute(e: Env, executor: Address, id: u64) -> Result<(), TreasuryError> {
        executor.require_auth();
        storage::extend_instance(&e);
        if !holds_role(&e, &executor, Role::Executor) {
            return Err(TreasuryError::NotExecutor);
        }

        let mut proposal = storage::get_proposal(&e, id)?;
        match proposal.status {
            ProposalStatus::Queued => {}
            ProposalStatus::Executed => return Err(TreasuryError::AlreadyExecuted),
            _ => return Err(TreasuryError::NotQueued),
        }
        let version = storage::get_config_version(&e);
        if proposal.config_version != version {
            return Err(TreasuryError::ProposalStale);
        }
        let config = storage::get_config(&e);
        let now = e.ledger().timestamp();
        let eta = proposal.eta.ok_or(TreasuryError::NotQueued)?;
        if now < eta {
            return Err(TreasuryError::TimelockActive);
        }
        let deadline = eta
            .checked_add(config.execution_window)
            .ok_or(TreasuryError::Overflow)?;
        if now > deadline {
            return Err(TreasuryError::ExecutionWindowExpired);
        }

        // Effects before interactions: mark as executed before any action runs.
        proposal.status = ProposalStatus::Executed;
        proposal.closed_at = Some(now);
        storage::set_proposal(&e, &proposal);

        let mut governance_changed = false;
        for action in proposal.actions.iter() {
            run_action(&e, action, &mut governance_changed)?;
        }

        if governance_changed {
            // Checked once, after every action, so a single proposal can remove
            // signers and lower the threshold in either order.
            let config = storage::get_config(&e);
            validate_config(&config, role_count(&e, Role::Approver))?;
            let next = version.checked_add(1).ok_or(TreasuryError::Overflow)?;
            storage::set_config_version(&e, next);
            events::ConfigUpdated {
                config_version: next,
                config,
            }
            .publish(&e);
        }

        events::ProposalExecuted { id, executor }.publish(&e);
        Ok(())
    }

    // ------------------------------------------------------ spending limits

    /// Sends `amount` of `token` from the treasury to `to`, within the
    /// spender's allowance for the current window. Needs only the spender's
    /// authorisation: no proposal and no timelock.
    pub fn spend(
        e: Env,
        spender: Address,
        token: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TreasuryError> {
        spender.require_auth();
        storage::extend_instance(&e);
        if amount <= 0 {
            return Err(TreasuryError::InvalidAmount);
        }
        let key = SpendingLimitKey {
            spender: spender.clone(),
            token: token.clone(),
        };
        let limit = storage::get_limit(&e, &key).ok_or(TreasuryError::NoSpendingLimit)?;
        let updated = rules::apply_spend(&limit, e.ledger().timestamp(), amount)?;
        storage::set_limit(&e, &key, &updated);

        token::TokenClient::new(&e, &token).transfer(&e.current_contract_address(), &to, &amount);

        events::Spent {
            spender,
            token,
            to,
            amount,
        }
        .publish(&e);
        Ok(())
    }

    // ----------------------------------------------------------------- views

    pub fn get_config(e: Env) -> Config {
        storage::extend_instance(&e);
        storage::get_config(&e)
    }

    /// Incremented every time an executed proposal changes membership, config
    /// or code. Proposals created under an older version are stale.
    pub fn get_config_version(e: Env) -> u32 {
        storage::extend_instance(&e);
        storage::get_config_version(&e)
    }

    pub fn get_proposal(e: Env, id: u64) -> Result<Proposal, TreasuryError> {
        storage::extend_instance(&e);
        storage::get_proposal(&e, id)
    }

    /// Returns up to `limit` (max 20) proposals with ids `start, start + 1, ...`.
    /// Ids start at 1.
    pub fn get_proposals(e: Env, start: u64, limit: u32) -> Vec<Proposal> {
        storage::extend_instance(&e);
        let count = storage::get_proposal_count(&e);
        let mut page = Vec::new(&e);
        let mut id = start.max(1);
        while id <= count && page.len() < limit.min(MAX_PAGE_SIZE) {
            if let Ok(proposal) = storage::get_proposal(&e, id) {
                page.push_back(proposal);
            }
            id += 1;
        }
        page
    }

    /// Current state of a proposal, taking the clock and config version into
    /// account.
    pub fn proposal_state(e: Env, id: u64) -> Result<ProposalState, TreasuryError> {
        storage::extend_instance(&e);
        let proposal = storage::get_proposal(&e, id)?;
        Ok(derive_state(
            &e,
            &proposal,
            &storage::get_config(&e),
            storage::get_config_version(&e),
        ))
    }

    /// Number of proposals ever created. Ids run from 1 to this value.
    pub fn proposal_count(e: Env) -> u64 {
        storage::extend_instance(&e);
        storage::get_proposal_count(&e)
    }

    pub fn has_role(e: Env, account: Address, role: Role) -> bool {
        storage::extend_instance(&e);
        holds_role(&e, &account, role)
    }

    pub fn members(e: Env, role: Role) -> Vec<Address> {
        storage::extend_instance(&e);
        let symbol = role_symbol(role);
        let mut members = Vec::new(&e);
        for index in 0..access_control::get_role_member_count(&e, &symbol) {
            members.push_back(access_control::get_role_member(&e, &symbol, index));
        }
        members
    }

    /// The spender's limit for `token` as it stands now: if the stored window
    /// has passed, `spent` reads as zero.
    pub fn get_spending_limit(e: Env, spender: Address, token: Address) -> Option<SpendingLimit> {
        storage::extend_instance(&e);
        storage::get_limit(&e, &SpendingLimitKey { spender, token })
            .map(|limit| rules::roll_window(&limit, e.ledger().timestamp()))
    }

    /// Every registered spending limit (at most 50), as it stands now.
    pub fn get_spending_limits(e: Env) -> Vec<SpendingLimitEntry> {
        storage::extend_instance(&e);
        let now = e.ledger().timestamp();
        let mut entries = Vec::new(&e);
        for key in storage::get_limit_index(&e).iter() {
            if let Some(limit) = storage::get_limit(&e, &key) {
                entries.push_back(SpendingLimitEntry {
                    spender: key.spender,
                    token: key.token,
                    limit: rules::roll_window(&limit, now),
                });
            }
        }
        entries
    }

    /// Treasury balance of `token`.
    pub fn balance(e: Env, token: Address) -> i128 {
        storage::extend_instance(&e);
        token::TokenClient::new(&e, &token).balance(&e.current_contract_address())
    }
}
