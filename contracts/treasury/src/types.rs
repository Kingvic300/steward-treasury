use soroban_sdk::{contracttype, Address, BytesN, String, Symbol, Val, Vec};

/// Maximum number of approvers (signers).
pub const MAX_APPROVERS: u32 = 20;
/// Maximum number of members in any single role.
pub const MAX_MEMBERS_PER_ROLE: u32 = 20;
/// Maximum number of actions bundled in one proposal.
pub const MAX_ACTIONS: u32 = 10;
/// Maximum memo length in bytes.
pub const MAX_MEMO_BYTES: u32 = 256;
/// Maximum number of proposals returned by `get_proposals`.
pub const MAX_PAGE_SIZE: u32 = 20;
/// Maximum number of spending limits tracked at once.
pub const MAX_SPENDING_LIMITS: u32 = 50;

/// Treasury configuration. All durations are in seconds, measured against the
/// ledger timestamp.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    /// Approvals required to queue a proposal.
    pub threshold: u32,
    /// Delay between a proposal being queued and becoming executable.
    pub timelock_delay: u64,
    /// How long a proposal stays open for voting after creation.
    pub voting_period: u64,
    /// How long a queued proposal stays executable once the timelock ends.
    pub execution_window: u64,
}

/// The three treasury roles. An address may hold more than one.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Role {
    Proposer = 0,
    Approver = 1,
    Executor = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferAction {
    pub token: Address,
    pub to: Address,
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct InvokeAction {
    pub contract: Address,
    pub function: Symbol,
    pub args: Vec<Val>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemberAction {
    pub account: Address,
    pub role: Role,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingLimitAction {
    pub spender: Address,
    pub token: Address,
    /// Allowance per window, in the token's smallest unit.
    pub amount: i128,
    /// Window length in seconds.
    pub period: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingLimitKey {
    pub spender: Address,
    pub token: Address,
}

/// One step of a proposal. Actions run in order and atomically.
#[contracttype]
#[derive(Clone, Debug)]
pub enum Action {
    /// Send tokens held by the treasury.
    Transfer(TransferAction),
    /// Call any contract as the treasury (authorised through invoker auth).
    Invoke(InvokeAction),
    AddMember(MemberAction),
    RemoveMember(MemberAction),
    SetThreshold(u32),
    SetTimelockDelay(u64),
    SetVotingPeriod(u64),
    SetExecutionWindow(u64),
    SetSpendingLimit(SpendingLimitAction),
    RemoveSpendingLimit(SpendingLimitKey),
    /// Replace the treasury's own Wasm.
    Upgrade(BytesN<32>),
}

/// Status persisted on a proposal.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalStatus {
    Pending = 0,
    Queued = 1,
    Executed = 2,
    Cancelled = 3,
    Rejected = 4,
}

/// State derived from the stored status, the clock and the config version.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalState {
    /// Open for voting.
    Pending = 0,
    /// Approved; waiting for the timelock.
    Queued = 1,
    /// Timelock elapsed; can be executed now.
    Ready = 2,
    Executed = 3,
    Cancelled = 4,
    Rejected = 5,
    /// Voting period or execution window ran out.
    Expired = 6,
    /// Created under an older config version.
    Stale = 7,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vote {
    pub voter: Address,
    pub approve: bool,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub actions: Vec<Action>,
    pub memo: String,
    /// Config version the proposal was created under.
    pub config_version: u32,
    pub created_at: u64,
    /// Last timestamp (inclusive) at which votes are accepted.
    pub voting_ends_at: u64,
    pub votes: Vec<Vote>,
    pub approvals: u32,
    pub rejections: u32,
    pub status: ProposalStatus,
    /// When the threshold was reached.
    pub queued_at: Option<u64>,
    /// Earliest execution time (`queued_at + timelock_delay`).
    pub eta: Option<u64>,
    /// When the proposal was executed, cancelled or rejected.
    pub closed_at: Option<u64>,
}

/// Allowance for one spender and one token.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingLimit {
    /// Allowance per window.
    pub amount: i128,
    /// Window length in seconds.
    pub period: u64,
    /// Amount already spent in the window starting at `window_start`.
    pub spent: i128,
    /// Start of the window `spent` refers to (a multiple of `period`).
    pub window_start: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingLimitEntry {
    pub spender: Address,
    pub token: Address,
    pub limit: SpendingLimit,
}
