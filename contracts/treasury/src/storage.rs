// The shared `Steward` prefix is deliberate: it namespaces our storage keys.
#![allow(clippy::enum_variant_names)]

use soroban_sdk::{contracttype, Env, Vec};

use crate::errors::TreasuryError;
use crate::types::{Config, Proposal, SpendingLimit, SpendingLimitKey};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_EXTEND_TO: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_EXTEND_TO - DAY_IN_LEDGERS;
const PERSISTENT_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;
const PERSISTENT_THRESHOLD: u32 = PERSISTENT_EXTEND_TO - DAY_IN_LEDGERS;

/// Storage keys. A `contracttype` enum is keyed by its variant name, so every
/// variant carries the `Steward` prefix to stay clear of the keys OpenZeppelin's
/// access-control module writes (`Admin`, `HasRole`, `RoleAccounts`, ...).
#[contracttype]
#[derive(Clone)]
pub enum StewardKey {
    /// Instance: [`Config`].
    StewardConfig,
    /// Instance: `u32` config version.
    StewardConfigVersion,
    /// Instance: `u64` number of proposals created so far.
    StewardProposalCount,
    /// Persistent: [`Proposal`] by id.
    StewardProposal(u64),
    /// Persistent: [`SpendingLimit`] by spender and token.
    StewardLimit(SpendingLimitKey),
    /// Persistent: index of every registered spending-limit key.
    StewardLimitIndex,
}

pub fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_EXTEND_TO);
}

fn extend_persistent(e: &Env, key: &StewardKey) {
    e.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_EXTEND_TO);
}

// ---------------------------------------------------------------- instance

pub fn get_config(e: &Env) -> Config {
    e.storage()
        .instance()
        .get(&StewardKey::StewardConfig)
        .expect("config is set in the constructor")
}

pub fn set_config(e: &Env, config: &Config) {
    e.storage()
        .instance()
        .set(&StewardKey::StewardConfig, config);
}

pub fn get_config_version(e: &Env) -> u32 {
    e.storage()
        .instance()
        .get(&StewardKey::StewardConfigVersion)
        .unwrap_or(0)
}

pub fn set_config_version(e: &Env, version: u32) {
    e.storage()
        .instance()
        .set(&StewardKey::StewardConfigVersion, &version);
}

pub fn get_proposal_count(e: &Env) -> u64 {
    e.storage()
        .instance()
        .get(&StewardKey::StewardProposalCount)
        .unwrap_or(0)
}

pub fn set_proposal_count(e: &Env, count: u64) {
    e.storage()
        .instance()
        .set(&StewardKey::StewardProposalCount, &count);
}

// --------------------------------------------------------------- proposals

pub fn get_proposal(e: &Env, id: u64) -> Result<Proposal, TreasuryError> {
    let key = StewardKey::StewardProposal(id);
    let proposal = e
        .storage()
        .persistent()
        .get(&key)
        .ok_or(TreasuryError::ProposalNotFound)?;
    extend_persistent(e, &key);
    Ok(proposal)
}

pub fn set_proposal(e: &Env, proposal: &Proposal) {
    let key = StewardKey::StewardProposal(proposal.id);
    e.storage().persistent().set(&key, proposal);
    extend_persistent(e, &key);
}

// ---------------------------------------------------------- spending limits

pub fn get_limit(e: &Env, key: &SpendingLimitKey) -> Option<SpendingLimit> {
    let key = StewardKey::StewardLimit(key.clone());
    let limit = e.storage().persistent().get(&key);
    if limit.is_some() {
        extend_persistent(e, &key);
    }
    limit
}

pub fn set_limit(e: &Env, key: &SpendingLimitKey, limit: &SpendingLimit) {
    let key = StewardKey::StewardLimit(key.clone());
    e.storage().persistent().set(&key, limit);
    extend_persistent(e, &key);
}

pub fn remove_limit(e: &Env, key: &SpendingLimitKey) {
    e.storage()
        .persistent()
        .remove(&StewardKey::StewardLimit(key.clone()));
}

pub fn get_limit_index(e: &Env) -> Vec<SpendingLimitKey> {
    let key = StewardKey::StewardLimitIndex;
    match e.storage().persistent().get(&key) {
        Some(index) => {
            extend_persistent(e, &key);
            index
        }
        None => Vec::new(e),
    }
}

pub fn set_limit_index(e: &Env, index: &Vec<SpendingLimitKey>) {
    let key = StewardKey::StewardLimitIndex;
    e.storage().persistent().set(&key, index);
    extend_persistent(e, &key);
}
