use soroban_sdk::contracterror;

/// Every failure the treasury can return.
///
/// Codes are stable: clients map them to human-readable messages. Never
/// renumber an existing variant; only append.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TreasuryError {
    /// Threshold is zero or above the approver count.
    InvalidThreshold = 1,
    /// A role would end up with no members.
    EmptyRole = 2,
    /// A role would exceed the per-role member cap.
    TooManyMembers = 3,
    /// The same address appears twice within one role.
    DuplicateMember = 4,
    /// Voting period or execution window is zero.
    InvalidDuration = 5,
    /// Caller does not hold the proposer role.
    NotProposer = 6,
    /// Caller does not hold the approver role.
    NotApprover = 7,
    /// Caller does not hold the executor role.
    NotExecutor = 8,
    /// A proposal must contain at least one action.
    NoActions = 9,
    /// A proposal contains more actions than allowed.
    TooManyActions = 10,
    /// Memo is longer than the allowed byte length.
    MemoTooLong = 11,
    /// Amount must be strictly positive.
    InvalidAmount = 12,
    /// Spending-limit period must be strictly positive.
    InvalidPeriod = 13,
    /// No proposal exists with this id.
    ProposalNotFound = 14,
    /// This approver already voted on the proposal.
    AlreadyVoted = 15,
    /// The proposal is no longer open for voting.
    ProposalNotPending = 16,
    /// The voting period has ended.
    VotingClosed = 17,
    /// The proposal was created under an older config version.
    ProposalStale = 18,
    /// The proposal is not queued for execution.
    NotQueued = 19,
    /// The timelock has not elapsed yet.
    TimelockActive = 20,
    /// The execution window has passed.
    ExecutionWindowExpired = 21,
    /// Only the original proposer may cancel.
    NotProposalCreator = 22,
    /// The proposal can no longer be cancelled.
    CannotCancel = 23,
    /// The account already holds this role.
    MemberAlreadyExists = 24,
    /// The account does not hold this role.
    MemberNotFound = 25,
    /// The last member of a role can never be removed.
    LastMember = 26,
    /// No spending limit exists for this spender and token.
    NoSpendingLimit = 27,
    /// The spend would exceed the allowance for the current window.
    SpendingLimitExceeded = 28,
    /// Arithmetic overflow.
    Overflow = 29,
    /// The proposal was already executed.
    AlreadyExecuted = 30,
    /// Too many spending limits are registered.
    TooManySpendingLimits = 31,
}
