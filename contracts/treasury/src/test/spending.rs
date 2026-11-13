use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger as _},
    Address, IntoVal, Symbol,
};

use super::{Setup, FUNDING, START};
use crate::{Action, ProposalState, SpendingLimitAction, TreasuryError, MAX_SPENDING_LIMITS};

const DAY: u64 = 86_400;

fn with_limit(amount: i128, period: u64) -> (Setup, Address) {
    let s = Setup::new();
    let ops = Address::generate(&s.env);
    s.run(&[s.set_limit(&ops, amount, period)]);
    (s, ops)
}

#[test]
fn spending_within_the_limit_works() {
    let (s, ops) = with_limit(100, DAY);
    let vendor = Address::generate(&s.env);

    s.client.spend(&ops, &s.token, &vendor, &40);
    s.client.spend(&ops, &s.token, &vendor, &60);

    assert_eq!(s.balance_of(&vendor), 100);
    assert_eq!(s.client.balance(&s.token), FUNDING - 100);
    let limit = s.client.get_spending_limit(&ops, &s.token).unwrap();
    assert_eq!(limit.amount, 100);
    assert_eq!(limit.spent, 100);
    assert_eq!(limit.period, DAY);
}

#[test]
fn spend_needs_only_the_spenders_auth() {
    let (s, ops) = with_limit(100, DAY);
    let vendor = Address::generate(&s.env);

    s.client.spend(&ops, &s.token, &vendor, &40);

    assert_eq!(
        s.env.auths(),
        std::vec![(
            ops.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.id.clone(),
                    Symbol::new(&s.env, "spend"),
                    (ops.clone(), s.token.clone(), vendor.clone(), 40i128).into_val(&s.env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
}

#[test]
fn spend_without_a_signature_fails() {
    let (s, ops) = with_limit(100, DAY);
    let vendor = Address::generate(&s.env);
    s.env.mock_auths(&[]);
    assert!(s.client.try_spend(&ops, &s.token, &vendor, &40).is_err());
    assert_eq!(s.balance_of(&vendor), 0);
}

#[test]
fn exceeding_the_limit_fails() {
    let (s, ops) = with_limit(100, DAY);
    let vendor = Address::generate(&s.env);

    assert_eq!(
        s.client.try_spend(&ops, &s.token, &vendor, &101),
        Err(Ok(TreasuryError::SpendingLimitExceeded))
    );
    s.client.spend(&ops, &s.token, &vendor, &70);
    assert_eq!(
        s.client.try_spend(&ops, &s.token, &vendor, &31),
        Err(Ok(TreasuryError::SpendingLimitExceeded))
    );
    // the failed attempt consumed nothing
    s.client.spend(&ops, &s.token, &vendor, &30);
    assert_eq!(s.balance_of(&vendor), 100);
}

#[test]
fn allowance_resets_after_the_period_without_carrying_over() {
    let (s, ops) = with_limit(100, DAY);
    let vendor = Address::generate(&s.env);

    // Use only 30 of 100 in the first window.
    s.client.spend(&ops, &s.token, &vendor, &30);

    // Jump to the start of the next aligned window.
    let next_window = (START / DAY + 1) * DAY;
    s.env
        .ledger()
        .with_mut(|ledger| ledger.timestamp = next_window);

    let limit = s.client.get_spending_limit(&ops, &s.token).unwrap();
    assert_eq!(limit.spent, 0);
    assert_eq!(limit.window_start, next_window);

    // The unused 70 did not carry over: 170 is refused, 100 is the cap again.
    assert_eq!(
        s.client.try_spend(&ops, &s.token, &vendor, &101),
        Err(Ok(TreasuryError::SpendingLimitExceeded))
    );
    s.client.spend(&ops, &s.token, &vendor, &100);
    assert_eq!(
        s.client.try_spend(&ops, &s.token, &vendor, &1),
        Err(Ok(TreasuryError::SpendingLimitExceeded))
    );
    assert_eq!(s.balance_of(&vendor), 130);
}

#[test]
fn windows_align_to_the_period_not_to_the_first_spend() {
    let (s, ops) = with_limit(100, DAY);
    let vendor = Address::generate(&s.env);
    let window = (START / DAY) * DAY;

    // Spend in the last second of the current window...
    s.env
        .ledger()
        .with_mut(|ledger| ledger.timestamp = window + DAY - 1);
    s.client.spend(&ops, &s.token, &vendor, &100);
    assert_eq!(
        s.client
            .get_spending_limit(&ops, &s.token)
            .unwrap()
            .window_start,
        window
    );

    // ...and one second later a new window has begun.
    s.advance(1);
    s.client.spend(&ops, &s.token, &vendor, &100);
    assert_eq!(s.balance_of(&vendor), 200);
}

#[test]
fn removing_a_limit_works() {
    let (s, ops) = with_limit(100, DAY);
    let vendor = Address::generate(&s.env);
    s.client.spend(&ops, &s.token, &vendor, &10);

    s.run(&[s.remove_limit(&ops)]);

    assert_eq!(s.client.get_spending_limit(&ops, &s.token), None);
    assert_eq!(s.client.get_spending_limits().len(), 0);
    assert_eq!(
        s.client.try_spend(&ops, &s.token, &vendor, &10),
        Err(Ok(TreasuryError::NoSpendingLimit))
    );
}

#[test]
fn removing_a_missing_limit_fails() {
    let s = Setup::new();
    let id = s.queue_and_wait(&[s.remove_limit(&Address::generate(&s.env))]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::NoSpendingLimit))
    );
}

#[test]
fn spending_with_no_limit_fails() {
    let s = Setup::new();
    let vendor = Address::generate(&s.env);
    // not even signers, proposers or executors can spend without a limit
    for spender in [&s.signers[0], &s.proposer, &s.executor, &vendor] {
        assert_eq!(
            s.client.try_spend(spender, &s.token, &vendor, &1),
            Err(Ok(TreasuryError::NoSpendingLimit))
        );
    }
}

#[test]
fn limit_is_per_token() {
    let (s, ops) = with_limit(100, DAY);
    let other_token = s
        .env
        .register_stellar_asset_contract_v2(Address::generate(&s.env))
        .address();
    assert_eq!(
        s.client.try_spend(&ops, &other_token, &ops, &1),
        Err(Ok(TreasuryError::NoSpendingLimit))
    );
}

#[test]
fn spend_rejects_non_positive_amounts() {
    let (s, ops) = with_limit(100, DAY);
    for amount in [0, -5] {
        assert_eq!(
            s.client.try_spend(&ops, &s.token, &ops, &amount),
            Err(Ok(TreasuryError::InvalidAmount))
        );
    }
}

#[test]
fn replacing_a_limit_does_not_refund_the_current_window() {
    let (s, ops) = with_limit(100, DAY);
    let vendor = Address::generate(&s.env);
    s.client.spend(&ops, &s.token, &vendor, &80);

    // Lower the limit mid-window: 80 already spent, so nothing is left of 50.
    s.run(&[s.set_limit(&ops, 50, DAY)]);
    assert_eq!(s.client.get_spending_limits().len(), 1);
    let limit = s.client.get_spending_limit(&ops, &s.token).unwrap();
    assert_eq!((limit.amount, limit.spent), (50, 80));
    assert_eq!(
        s.client.try_spend(&ops, &s.token, &vendor, &1),
        Err(Ok(TreasuryError::SpendingLimitExceeded))
    );

    // Raise it: 80 of 120 spent, 40 left.
    s.run(&[s.set_limit(&ops, 120, DAY)]);
    s.client.spend(&ops, &s.token, &vendor, &40);
    assert_eq!(
        s.client.try_spend(&ops, &s.token, &vendor, &1),
        Err(Ok(TreasuryError::SpendingLimitExceeded))
    );
}

#[test]
fn limits_are_listed() {
    let s = Setup::new();
    let first = Address::generate(&s.env);
    let second = Address::generate(&s.env);
    s.run(&[s.set_limit(&first, 10, 60), s.set_limit(&second, 20, 120)]);

    let limits = s.client.get_spending_limits();
    assert_eq!(limits.len(), 2);
    assert_eq!(limits.get_unchecked(0).spender, first);
    assert_eq!(limits.get_unchecked(1).limit.amount, 20);

    s.run(&[s.remove_limit(&first)]);
    let limits = s.client.get_spending_limits();
    assert_eq!(limits.len(), 1);
    assert_eq!(limits.get_unchecked(0).spender, second);
}

#[test]
fn number_of_limits_is_capped() {
    let s = Setup::new();
    let limit_for = |spender: &Address| {
        Action::SetSpendingLimit(SpendingLimitAction {
            spender: spender.clone(),
            token: s.token.clone(),
            amount: 1,
            period: 60,
        })
    };
    for _ in 0..(MAX_SPENDING_LIMITS / 10) {
        let batch: std::vec::Vec<Action> = (0..10)
            .map(|_| limit_for(&Address::generate(&s.env)))
            .collect();
        s.run(&batch);
    }
    assert_eq!(s.client.get_spending_limits().len(), MAX_SPENDING_LIMITS);

    let id = s.queue_and_wait(&[limit_for(&Address::generate(&s.env))]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::TooManySpendingLimits))
    );
}

#[test]
fn limits_cannot_be_created_without_an_executed_proposal() {
    let s = Setup::new();
    let ops = Address::generate(&s.env);
    let id = s.propose(&[s.set_limit(&ops, 100, DAY)]);
    s.approve_to_threshold(id);
    // approved but still inside the timelock: no limit yet
    assert_eq!(s.client.proposal_state(&id), ProposalState::Queued);
    assert_eq!(s.client.get_spending_limit(&ops, &s.token), None);
    assert_eq!(
        s.client.try_spend(&ops, &s.token, &ops, &1),
        Err(Ok(TreasuryError::NoSpendingLimit))
    );
}

#[test]
fn spend_fails_when_the_treasury_cannot_cover_it() {
    let (s, ops) = with_limit(FUNDING * 2, DAY);
    let vendor = Address::generate(&s.env);
    assert!(s
        .client
        .try_spend(&ops, &s.token, &vendor, &(FUNDING + 1))
        .is_err());
    // the failed transfer rolled the allowance back too
    assert_eq!(
        s.client.get_spending_limit(&ops, &s.token).unwrap().spent,
        0
    );
}
