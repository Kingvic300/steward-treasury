//! Pure decision logic, free of host access so it can be property-tested.

use crate::errors::TreasuryError;
use crate::types::SpendingLimit;

/// What a proposal's vote tally means.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Tally {
    /// Still open.
    Open,
    /// Approvals reached the threshold.
    Queue,
    /// The threshold can no longer be reached.
    Reject,
}

/// Decide a proposal's fate from its vote counts.
///
/// `Queue` and `Reject` are mutually exclusive as long as
/// `approvals + rejections <= approver_count`.
pub fn tally(approver_count: u32, threshold: u32, approvals: u32, rejections: u32) -> Tally {
    if approvals >= threshold {
        Tally::Queue
    } else if approver_count.saturating_sub(rejections) < threshold {
        Tally::Reject
    } else {
        Tally::Open
    }
}

/// Start of the spending window containing `now`. Windows are aligned to
/// multiples of `period` since the Unix epoch. `period` must be non-zero.
pub fn window_start(now: u64, period: u64) -> u64 {
    now - (now % period)
}

/// Returns the limit as it stands at `now`: if the stored window has passed,
/// the spent amount resets to zero. Unused allowance never carries over.
pub fn roll_window(limit: &SpendingLimit, now: u64) -> SpendingLimit {
    let start = window_start(now, limit.period);
    if start == limit.window_start {
        limit.clone()
    } else {
        SpendingLimit {
            amount: limit.amount,
            period: limit.period,
            spent: 0,
            window_start: start,
        }
    }
}

/// Record a spend of `amount` at `now`, or fail if it exceeds the allowance.
pub fn apply_spend(
    limit: &SpendingLimit,
    now: u64,
    amount: i128,
) -> Result<SpendingLimit, TreasuryError> {
    if amount <= 0 {
        return Err(TreasuryError::InvalidAmount);
    }
    let mut rolled = roll_window(limit, now);
    let spent = rolled
        .spent
        .checked_add(amount)
        .ok_or(TreasuryError::Overflow)?;
    if spent > rolled.amount {
        return Err(TreasuryError::SpendingLimitExceeded);
    }
    rolled.spent = spent;
    Ok(rolled)
}
