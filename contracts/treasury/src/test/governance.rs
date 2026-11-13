use soroban_sdk::{testutils::Address as _, vec, Address, BytesN};

use super::{default_config, Setup, EXECUTION_WINDOW, VOTING_PERIOD};
use crate::{Action, ProposalState, Role, TreasuryError, MAX_APPROVERS};

#[test]
fn adds_a_member_and_raises_the_threshold() {
    let s = Setup::new();
    let newcomer = Address::generate(&s.env);

    s.run(&[
        s.add_member(&newcomer, Role::Approver),
        Action::SetThreshold(3),
    ]);

    assert!(s.client.has_role(&newcomer, &Role::Approver));
    assert_eq!(s.client.members(&Role::Approver).len(), 4);
    assert_eq!(s.client.get_config().threshold, 3);
    // one bump per executed proposal, however many actions it holds
    assert_eq!(s.client.get_config_version(), 1);

    // The newcomer's vote now counts, and two approvals are no longer enough.
    let recipient = Address::generate(&s.env);
    let id = s.propose(&[s.transfer(&recipient, 5)]);
    s.client.approve(&newcomer, &id);
    s.client.approve(&s.signers[0], &id);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Pending);
    s.client.approve(&s.signers[1], &id);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Queued);
}

#[test]
fn removes_two_members_and_lowers_the_threshold_in_one_proposal() {
    // Removals first: the threshold is briefly above the signer count.
    let s = Setup::new();
    s.run(&[
        s.remove_member(&s.signers[1], Role::Approver),
        s.remove_member(&s.signers[2], Role::Approver),
        Action::SetThreshold(1),
    ]);
    assert_eq!(
        s.client.members(&Role::Approver),
        vec![&s.env, s.signers[0].clone()]
    );
    assert_eq!(s.client.get_config().threshold, 1);

    // The other order works just as well.
    let s = Setup::new();
    s.run(&[
        Action::SetThreshold(1),
        s.remove_member(&s.signers[0], Role::Approver),
        s.remove_member(&s.signers[1], Role::Approver),
    ]);
    assert_eq!(
        s.client.members(&Role::Approver),
        vec![&s.env, s.signers[2].clone()]
    );
    assert_eq!(s.client.get_config().threshold, 1);
}

#[test]
fn proposal_leaving_threshold_above_signer_count_reverts() {
    let s = Setup::new();

    let removal = s.queue_and_wait(&[
        s.remove_member(&s.signers[1], Role::Approver),
        s.remove_member(&s.signers[2], Role::Approver),
    ]);
    assert_eq!(
        s.client.try_execute(&s.executor, &removal),
        Err(Ok(TreasuryError::InvalidThreshold))
    );

    let raise = s.queue_and_wait(&[Action::SetThreshold(4)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &raise),
        Err(Ok(TreasuryError::InvalidThreshold))
    );

    // Nothing changed.
    assert_eq!(s.client.members(&Role::Approver).len(), 3);
    assert_eq!(s.client.get_config(), default_config(2));
    assert_eq!(s.client.get_config_version(), 0);
    assert_eq!(s.client.proposal_state(&removal), ProposalState::Ready);
}

#[test]
fn last_executor_cannot_be_removed() {
    let s = Setup::new();
    let id = s.queue_and_wait(&[s.remove_member(&s.executor, Role::Executor)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::LastMember))
    );
    assert!(s.client.has_role(&s.executor, &Role::Executor));
}

#[test]
fn last_proposer_and_last_approver_cannot_be_removed() {
    let s = Setup::new();
    let id = s.queue_and_wait(&[s.remove_member(&s.proposer, Role::Proposer)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::LastMember))
    );

    let s = Setup::with(1, 1);
    let id = s.queue_and_wait(&[s.remove_member(&s.signers[0], Role::Approver)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::LastMember))
    );
}

#[test]
fn executor_can_be_replaced_in_one_proposal() {
    let s = Setup::new();
    let replacement = Address::generate(&s.env);
    s.run(&[
        s.add_member(&replacement, Role::Executor),
        s.remove_member(&s.executor, Role::Executor),
    ]);
    assert_eq!(
        s.client.members(&Role::Executor),
        vec![&s.env, replacement.clone()]
    );

    let id = s.queue_and_wait(&[s.transfer(&replacement, 1)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::NotExecutor))
    );
    s.client.execute(&replacement, &id);
}

#[test]
fn adding_an_existing_member_or_removing_a_stranger_fails() {
    let s = Setup::new();
    let id = s.queue_and_wait(&[s.add_member(&s.signers[0], Role::Approver)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::MemberAlreadyExists))
    );

    let stranger = Address::generate(&s.env);
    let id = s.queue_and_wait(&[s.remove_member(&stranger, Role::Approver)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::MemberNotFound))
    );
}

#[test]
fn approver_cap_is_enforced_on_add() {
    let s = Setup::with(MAX_APPROVERS, 1);
    let id = s.queue_and_wait(&[s.add_member(&Address::generate(&s.env), Role::Approver)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::TooManyMembers))
    );
}

#[test]
fn config_change_makes_older_open_proposals_stale() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);

    let pending = s.propose(&[s.transfer(&recipient, 5)]);
    s.client.approve(&s.signers[0], &pending);
    let queued = s.propose(&[s.transfer(&recipient, 7)]);
    s.approve_to_threshold(queued);

    s.run(&[Action::SetTimelockDelay(60)]);
    assert_eq!(s.client.get_config_version(), 1);

    assert_eq!(s.client.proposal_state(&pending), ProposalState::Stale);
    assert_eq!(s.client.proposal_state(&queued), ProposalState::Stale);
    assert_eq!(
        s.client.try_approve(&s.signers[1], &pending),
        Err(Ok(TreasuryError::ProposalStale))
    );
    assert_eq!(
        s.client.try_reject(&s.signers[1], &pending),
        Err(Ok(TreasuryError::ProposalStale))
    );
    s.advance(600);
    assert_eq!(
        s.client.try_execute(&s.executor, &queued),
        Err(Ok(TreasuryError::ProposalStale))
    );
    assert_eq!(s.balance_of(&recipient), 0);

    // Stale proposals can still be tidied away by their proposer.
    s.client.cancel(&s.proposer, &pending);
    assert_eq!(s.client.proposal_state(&pending), ProposalState::Cancelled);

    // New proposals use the new version and the new timelock.
    let fresh = s.propose(&[s.transfer(&recipient, 9)]);
    assert_eq!(s.client.get_proposal(&fresh).config_version, 1);
    s.approve_to_threshold(fresh);
    s.advance(60);
    s.client.execute(&s.executor, &fresh);
    assert_eq!(s.balance_of(&recipient), 9);
}

#[test]
fn removed_signer_cannot_vote() {
    let s = Setup::new();
    s.run(&[s.remove_member(&s.signers[2], Role::Approver)]);
    assert!(!s.client.has_role(&s.signers[2], &Role::Approver));

    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    assert_eq!(
        s.client.try_approve(&s.signers[2], &id),
        Err(Ok(TreasuryError::NotApprover))
    );
    assert_eq!(
        s.client.try_reject(&s.signers[2], &id),
        Err(Ok(TreasuryError::NotApprover))
    );
}

#[test]
fn durations_can_be_changed_by_proposal() {
    let s = Setup::new();
    s.run(&[
        Action::SetTimelockDelay(0),
        Action::SetVotingPeriod(VOTING_PERIOD * 2),
        Action::SetExecutionWindow(EXECUTION_WINDOW / 3),
    ]);
    let config = s.client.get_config();
    assert_eq!(config.timelock_delay, 0);
    assert_eq!(config.voting_period, VOTING_PERIOD * 2);
    assert_eq!(config.execution_window, EXECUTION_WINDOW / 3);
    assert_eq!(config.threshold, 2);
}

#[test]
fn plain_transfers_do_not_stale_other_proposals() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let waiting = s.propose(&[s.transfer(&recipient, 5)]);
    s.run(&[s.transfer(&recipient, 1)]);
    s.run(&[s.set_limit(&recipient, 10, 60)]);
    assert_eq!(s.client.get_config_version(), 0);
    assert_eq!(s.client.proposal_state(&waiting), ProposalState::Pending);
}

#[test]
fn upgrade_to_unknown_wasm_reverts() {
    let s = Setup::new();
    let id = s.queue_and_wait(&[Action::Upgrade(BytesN::from_array(&s.env, &[7u8; 32]))]);
    assert!(s.client.try_execute(&s.executor, &id).is_err());
    assert_eq!(s.client.proposal_state(&id), ProposalState::Ready);
    assert_eq!(s.client.get_config_version(), 0);
}

/// Upgrades the treasury to its own freshly built Wasm and checks that state
/// survives. Needs `stellar contract build` to have run first; CI sets
/// `STEWARD_REQUIRE_WASM=1` so the test cannot be skipped silently there.
#[test]
fn upgrade_through_a_proposal_keeps_state() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../target/wasm32v1-none/release/steward_treasury.wasm");
    let Ok(wasm) = std::fs::read(&path) else {
        assert!(
            std::env::var("STEWARD_REQUIRE_WASM").is_err(),
            "missing {}: run `stellar contract build` first",
            path.display()
        );
        std::eprintln!("skipping upgrade test: {} not built", path.display());
        return;
    };

    let s = Setup::new();
    let wasm_hash = s
        .env
        .deployer()
        .upload_contract_wasm(soroban_sdk::Bytes::from_slice(&s.env, &wasm));

    s.run(&[Action::Upgrade(wasm_hash)]);

    assert_eq!(s.client.get_config_version(), 1);
    assert_eq!(s.client.get_config(), default_config(2));
    assert_eq!(s.client.members(&Role::Approver).len(), 3);

    // The upgraded contract still runs the full lifecycle.
    let recipient = Address::generate(&s.env);
    s.run(&[s.transfer(&recipient, 11)]);
    assert_eq!(s.balance_of(&recipient), 11);
}
