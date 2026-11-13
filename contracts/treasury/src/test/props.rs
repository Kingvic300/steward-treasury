//! Property tests for the spending-window maths and the threshold invariants.

use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address};

use super::Setup;
use crate::rules::{apply_spend, roll_window, tally, window_start, Tally};
use crate::{Action, ProposalStatus, Role, SpendingLimit, TreasuryError};

fn fresh_limit(amount: i128, period: u64) -> SpendingLimit {
    SpendingLimit {
        amount,
        period,
        spent: 0,
        window_start: 0,
    }
}

proptest! {
    // ------------------------------------------------------- window maths

    #[test]
    fn window_contains_now_and_is_aligned(now in any::<u64>(), period in 1u64..=u64::MAX) {
        let start = window_start(now, period);
        prop_assert!(start <= now);
        prop_assert_eq!(start % period, 0);
        prop_assert!(now - start < period);
    }

    #[test]
    fn window_start_is_monotonic(a in any::<u64>(), b in any::<u64>(), period in 1u64..1_000_000_000) {
        let (earlier, later) = if a <= b { (a, b) } else { (b, a) };
        prop_assert!(window_start(earlier, period) <= window_start(later, period));
    }

    #[test]
    fn same_window_iff_same_start(now in 0u64..u64::MAX / 2, offset in 0u64..1_000_000, period in 1u64..1_000_000) {
        let start = window_start(now, period);
        let later = now + offset;
        prop_assert_eq!(window_start(later, period) == start, later < start + period);
    }

    #[test]
    fn rolling_keeps_spent_inside_the_window_and_resets_outside(
        amount in 1i128..i128::MAX,
        period in 1u64..1_000_000,
        spent in 0i128..i128::MAX,
        stored_at in 0u64..1_000_000_000,
        now in 0u64..1_000_000_000,
    ) {
        let limit = SpendingLimit { amount, period, spent, window_start: window_start(stored_at, period) };
        let rolled = roll_window(&limit, now);
        prop_assert_eq!(rolled.amount, amount);
        prop_assert_eq!(rolled.period, period);
        prop_assert_eq!(rolled.window_start, window_start(now, period));
        if window_start(now, period) == limit.window_start {
            prop_assert_eq!(rolled.spent, spent);
        } else {
            prop_assert_eq!(rolled.spent, 0);
        }
    }

    /// Replays an arbitrary sequence of spends against a simple model: the
    /// total accepted in any one window never exceeds the limit, and a spend
    /// is accepted exactly when it fits what is left of the current window.
    #[test]
    fn spends_never_exceed_the_limit_in_any_window(
        amount in 1i128..1_000_000,
        period in 1u64..10_000,
        steps in prop::collection::vec((0u64..5_000, 1i128..400_000), 1..60),
    ) {
        let mut limit = fresh_limit(amount, period);
        let mut now = 0u64;
        let mut model_window = 0u64;
        let mut model_spent = 0i128;

        for (elapsed, spend) in steps {
            now += elapsed;
            let window = window_start(now, period);
            if window != model_window {
                // Unused allowance is dropped, never carried over.
                model_window = window;
                model_spent = 0;
            }
            match apply_spend(&limit, now, spend) {
                Ok(updated) => {
                    prop_assert!(model_spent + spend <= amount);
                    model_spent += spend;
                    prop_assert_eq!(updated.spent, model_spent);
                    prop_assert_eq!(updated.window_start, window);
                    limit = updated;
                }
                Err(error) => {
                    prop_assert_eq!(error, TreasuryError::SpendingLimitExceeded);
                    prop_assert!(model_spent + spend > amount);
                }
            }
            prop_assert!(limit.spent <= limit.amount);
        }
    }

    #[test]
    fn spend_rejects_non_positive_amounts(amount in 1i128..i128::MAX, bad in i128::MIN..=0, now in any::<u64>()) {
        prop_assert_eq!(
            apply_spend(&fresh_limit(amount, 60), now, bad),
            Err(TreasuryError::InvalidAmount)
        );
    }

    #[test]
    fn spend_overflow_is_a_typed_error(spent in 1i128..i128::MAX, now in 0u64..60) {
        let limit = SpendingLimit { amount: i128::MAX, period: 60, spent, window_start: 0 };
        prop_assert_eq!(apply_spend(&limit, now, i128::MAX), Err(TreasuryError::Overflow));
    }

    // -------------------------------------------------- threshold invariants

    /// Queue and Reject can never both be true, and each matches its
    /// definition exactly.
    #[test]
    fn tally_matches_its_definition(
        (count, threshold, approvals, rejections) in (1u32..=20)
            .prop_flat_map(|count| (Just(count), 1..=count, 0..=count))
            .prop_flat_map(|(count, threshold, approvals)| {
                (Just(count), Just(threshold), Just(approvals), 0..=(count - approvals))
            })
    ) {
        let reachable = count - rejections >= threshold;
        match tally(count, threshold, approvals, rejections) {
            Tally::Queue => {
                prop_assert!(approvals >= threshold);
                prop_assert!(reachable, "a queued proposal must have been reachable");
            }
            Tally::Reject => {
                prop_assert!(approvals < threshold);
                prop_assert!(!reachable);
            }
            Tally::Open => {
                prop_assert!(approvals < threshold);
                prop_assert!(reachable);
            }
        }
    }

    /// Once every approver has voted the proposal is always decided.
    #[test]
    fn full_turnout_always_decides(
        (count, threshold, approvals) in (1u32..=20)
            .prop_flat_map(|count| (Just(count), 1..=count, 0..=count))
    ) {
        let rejections = count - approvals;
        prop_assert_ne!(tally(count, threshold, approvals, rejections), Tally::Open);
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(48))]

    /// Drives the real contract with a random voting order and checks every
    /// intermediate status against the definition.
    #[test]
    fn contract_votes_follow_the_tally(
        (count, threshold, votes) in (1u32..=6)
            .prop_flat_map(|count| (
                Just(count),
                1..=count,
                prop::collection::vec(any::<bool>(), count as usize),
            ))
    ) {
        let s = Setup::with(count, threshold);
        let id = s.propose(&[s.transfer(&Address::generate(&s.env), 1)]);
        let (mut approvals, mut rejections) = (0u32, 0u32);
        let mut decided = false;

        for (signer, approve) in s.signers.iter().zip(votes) {
            let result = if approve {
                s.client.try_approve(signer, &id)
            } else {
                s.client.try_reject(signer, &id)
            };
            if decided {
                prop_assert_eq!(result, Err(Ok(TreasuryError::ProposalNotPending)));
                continue;
            }
            if approve { approvals += 1 } else { rejections += 1 }
            let expected = if approvals >= threshold {
                ProposalStatus::Queued
            } else if count - rejections < threshold {
                ProposalStatus::Rejected
            } else {
                ProposalStatus::Pending
            };
            prop_assert_eq!(result, Ok(Ok(expected)));
            decided = expected != ProposalStatus::Pending;
        }

        let proposal = s.client.get_proposal(&id);
        prop_assert_eq!(proposal.approvals, approvals);
        prop_assert_eq!(proposal.rejections, rejections);
        prop_assert_eq!(proposal.eta.is_some(), proposal.status == ProposalStatus::Queued);
    }

    /// Whatever mix of membership and threshold changes a proposal carries, it
    /// either applies in full and leaves `1 <= threshold <= approvers`, or it
    /// reverts and changes nothing.
    #[test]
    fn governance_proposals_preserve_the_threshold_invariant(
        count in 1u32..=5,
        ops in prop::collection::vec((0u8..3, 0u32..8), 1..=6),
    ) {
        let s = Setup::with(count, 1);
        let mut model: std::vec::Vec<Address> = s.signers.clone();
        let mut model_threshold = 1u32;
        let mut model_ok = true;
        let mut actions = std::vec::Vec::new();

        for (kind, value) in ops {
            match kind {
                0 => {
                    let account = Address::generate(&s.env);
                    actions.push(s.add_member(&account, Role::Approver));
                    model.push(account);
                }
                1 => {
                    // may name a signer that an earlier action already removed
                    let account = s.signers[value as usize % s.signers.len()].clone();
                    actions.push(s.remove_member(&account, Role::Approver));
                    match model.iter().position(|a| a == &account) {
                        Some(index) if model.len() > 1 => { model.remove(index); }
                        _ => model_ok = false,
                    }
                }
                _ => {
                    let threshold = value % 7 + 1;
                    actions.push(Action::SetThreshold(threshold));
                    model_threshold = threshold;
                }
            }
            if !model_ok { break; }
        }
        model_ok = model_ok && model_threshold <= model.len() as u32;

        let id = s.queue_and_wait(&actions);
        let result = s.client.try_execute(&s.executor, &id);
        prop_assert_eq!(result.is_ok(), model_ok);

        let config = s.client.get_config();
        let approvers = s.client.members(&Role::Approver);
        prop_assert!(config.threshold >= 1);
        prop_assert!(config.threshold <= approvers.len());
        if model_ok {
            prop_assert_eq!(config.threshold, model_threshold);
            prop_assert_eq!(approvers.len(), model.len() as u32);
            for account in &model {
                prop_assert!(s.client.has_role(account, &Role::Approver));
            }
            prop_assert_eq!(s.client.get_config_version(), 1);
        } else {
            prop_assert_eq!(config.threshold, 1);
            prop_assert_eq!(approvers.len(), count);
            prop_assert_eq!(s.client.get_config_version(), 0);
        }
    }
}
