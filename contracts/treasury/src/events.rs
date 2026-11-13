use soroban_sdk::{contractevent, Address, BytesN};

use crate::types::{Config, Role};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalCreated {
    #[topic]
    pub id: u64,
    #[topic]
    pub proposer: Address,
    pub action_count: u32,
    pub voting_ends_at: u64,
    pub config_version: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Voted {
    #[topic]
    pub id: u64,
    #[topic]
    pub voter: Address,
    pub approve: bool,
    pub approvals: u32,
    pub rejections: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalQueued {
    #[topic]
    pub id: u64,
    pub eta: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalRejected {
    #[topic]
    pub id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalCancelled {
    #[topic]
    pub id: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalExecuted {
    #[topic]
    pub id: u64,
    #[topic]
    pub executor: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberAdded {
    #[topic]
    pub account: Address,
    pub role: Role,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberRemoved {
    #[topic]
    pub account: Address,
    pub role: Role,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfigUpdated {
    #[topic]
    pub config_version: u32,
    pub config: Config,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingLimitSet {
    #[topic]
    pub spender: Address,
    #[topic]
    pub token: Address,
    pub amount: i128,
    pub period: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingLimitRemoved {
    #[topic]
    pub spender: Address,
    #[topic]
    pub token: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Spent {
    #[topic]
    pub spender: Address,
    #[topic]
    pub token: Address,
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Upgraded {
    pub wasm_hash: BytesN<32>,
}
