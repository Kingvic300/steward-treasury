use soroban_sdk::{testutils::Address as _, vec, Address, String, Vec};

use super::Setup;
use crate::{Action, TreasuryError, MAX_ACTIONS, MAX_MEMO_BYTES};

#[test]
fn rejects_a_proposal_with_no_actions() {
    let s = Setup::new();
    assert_eq!(
        s.client
            .try_propose(&s.proposer, &Vec::new(&s.env), &s.memo()),
        Err(Ok(TreasuryError::NoActions))
    );
}

#[test]
fn rejects_zero_and_negative_amounts() {
    let s = Setup::new();
    let to = Address::generate(&s.env);
    for amount in [0, -1] {
        assert_eq!(
            s.client.try_propose(
                &s.proposer,
                &vec![&s.env, s.transfer(&to, amount)],
                &s.memo()
            ),
            Err(Ok(TreasuryError::InvalidAmount))
        );
        assert_eq!(
            s.client.try_propose(
                &s.proposer,
                &vec![&s.env, s.set_limit(&to, amount, 60)],
                &s.memo()
            ),
            Err(Ok(TreasuryError::InvalidAmount))
        );
    }
}

#[test]
fn rejects_zero_period_and_zero_durations() {
    let s = Setup::new();
    let to = Address::generate(&s.env);
    let cases = [
        (s.set_limit(&to, 10, 0), TreasuryError::InvalidPeriod),
        (Action::SetThreshold(0), TreasuryError::InvalidThreshold),
        (Action::SetVotingPeriod(0), TreasuryError::InvalidDuration),
        (
            Action::SetExecutionWindow(0),
            TreasuryError::InvalidDuration,
        ),
    ];
    for (action, error) in cases {
        assert_eq!(
            s.client
                .try_propose(&s.proposer, &vec![&s.env, action], &s.memo()),
            Err(Ok(error))
        );
    }
}

#[test]
fn rejects_too_many_actions() {
    let s = Setup::new();
    let to = Address::generate(&s.env);
    let mut actions = Vec::new(&s.env);
    for _ in 0..MAX_ACTIONS {
        actions.push_back(s.transfer(&to, 1));
    }
    // exactly the maximum is fine
    s.client.propose(&s.proposer, &actions, &s.memo());

    actions.push_back(s.transfer(&to, 1));
    assert_eq!(
        s.client.try_propose(&s.proposer, &actions, &s.memo()),
        Err(Ok(TreasuryError::TooManyActions))
    );
}

#[test]
fn rejects_a_memo_that_is_too_long() {
    let s = Setup::new();
    let actions = vec![&s.env, s.transfer(&Address::generate(&s.env), 1)];

    let at_limit = "m".repeat(MAX_MEMO_BYTES as usize);
    s.client
        .propose(&s.proposer, &actions, &String::from_str(&s.env, &at_limit));

    let too_long = "m".repeat(MAX_MEMO_BYTES as usize + 1);
    assert_eq!(
        s.client
            .try_propose(&s.proposer, &actions, &String::from_str(&s.env, &too_long)),
        Err(Ok(TreasuryError::MemoTooLong))
    );
}

#[test]
fn memo_limit_counts_bytes_not_characters() {
    let s = Setup::new();
    let actions = vec![&s.env, s.transfer(&Address::generate(&s.env), 1)];
    // 100 three-byte characters: 100 chars but 300 bytes
    let multibyte = "\u{20AC}".repeat(100);
    assert_eq!(
        s.client
            .try_propose(&s.proposer, &actions, &String::from_str(&s.env, &multibyte)),
        Err(Ok(TreasuryError::MemoTooLong))
    );
}

#[test]
fn unknown_proposal_id_fails_everywhere() {
    let s = Setup::new();
    s.propose(&[s.transfer(&Address::generate(&s.env), 1)]);
    for id in [0, 2, u64::MAX] {
        let not_found = Some(Ok(TreasuryError::ProposalNotFound));
        assert_eq!(s.client.try_get_proposal(&id).err(), not_found);
        assert_eq!(s.client.try_proposal_state(&id).err(), not_found);
        assert_eq!(s.client.try_approve(&s.signers[0], &id).err(), not_found);
        assert_eq!(s.client.try_reject(&s.signers[0], &id).err(), not_found);
        assert_eq!(s.client.try_cancel(&s.proposer, &id).err(), not_found);
        assert_eq!(s.client.try_execute(&s.executor, &id).err(), not_found);
    }
}
