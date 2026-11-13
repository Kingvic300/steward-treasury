use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, MockAuth, MockAuthInvoke},
    vec, Address, IntoVal, Symbol, Vec,
};

use super::{Setup, EXECUTION_WINDOW, FUNDING, START, TIMELOCK, VOTING_PERIOD};
use crate::{ProposalState, ProposalStatus, TreasuryError};

#[test]
fn transfer_goes_through_the_full_lifecycle() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);

    // propose
    let id = s.propose(&[s.transfer(&recipient, 250)]);
    assert_eq!(id, 1);
    assert_eq!(s.client.proposal_count(), 1);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Pending);
    let proposal = s.client.get_proposal(&id);
    assert_eq!(proposal.proposer, s.proposer);
    assert_eq!(proposal.created_at, START);
    assert_eq!(proposal.voting_ends_at, START + VOTING_PERIOD);
    assert_eq!(proposal.status, ProposalStatus::Pending);
    assert_eq!(proposal.eta, None);

    // approve: 1 of 2 keeps it pending
    assert_eq!(
        s.client.approve(&s.signers[0], &id),
        ProposalStatus::Pending
    );
    assert_eq!(s.client.proposal_state(&id), ProposalState::Pending);

    // approve: 2 of 2 queues it
    s.advance(10);
    assert_eq!(s.client.approve(&s.signers[1], &id), ProposalStatus::Queued);
    let proposal = s.client.get_proposal(&id);
    assert_eq!(proposal.approvals, 2);
    assert_eq!(proposal.rejections, 0);
    assert_eq!(proposal.queued_at, Some(START + 10));
    assert_eq!(proposal.eta, Some(START + 10 + TIMELOCK));
    assert_eq!(proposal.votes.len(), 2);
    assert_eq!(proposal.votes.get_unchecked(1).timestamp, START + 10);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Queued);

    // timelock
    s.advance(TIMELOCK - 1);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Queued);
    s.advance(1);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Ready);

    // execute
    s.client.execute(&s.executor, &id);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Executed);
    assert_eq!(s.balance_of(&recipient), 250);
    assert_eq!(s.client.balance(&s.token), FUNDING - 250);
    assert_eq!(
        s.client.get_proposal(&id).closed_at,
        Some(START + 10 + TIMELOCK)
    );
    // A plain transfer is not a governance change.
    assert_eq!(s.client.get_config_version(), 0);
}

#[test]
fn zero_timelock_is_ready_as_soon_as_it_is_queued() {
    let s = Setup::new();
    s.run(&[crate::Action::SetTimelockDelay(0)]);
    let recipient = Address::generate(&s.env);
    let id = s.propose(&[s.transfer(&recipient, 1)]);
    s.approve_to_threshold(id);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Ready);
    s.client.execute(&s.executor, &id);
    assert_eq!(s.balance_of(&recipient), 1);
}

#[test]
fn propose_requires_the_proposers_auth() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let actions = vec![&s.env, s.transfer(&recipient, 5)];
    let memo = s.memo();

    s.client.propose(&s.proposer, &actions, &memo);

    assert_eq!(
        s.env.auths(),
        std::vec![(
            s.proposer.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.id.clone(),
                    Symbol::new(&s.env, "propose"),
                    (s.proposer.clone(), actions, memo).into_val(&s.env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
}

#[test]
fn approve_and_reject_require_the_approvers_auth() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);

    s.client.approve(&s.signers[0], &id);
    assert_eq!(
        s.env.auths(),
        std::vec![(
            s.signers[0].clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.id.clone(),
                    Symbol::new(&s.env, "approve"),
                    (s.signers[0].clone(), id).into_val(&s.env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );

    s.client.reject(&s.signers[1], &id);
    assert_eq!(
        s.env.auths(),
        std::vec![(
            s.signers[1].clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.id.clone(),
                    Symbol::new(&s.env, "reject"),
                    (s.signers[1].clone(), id).into_val(&s.env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
}

#[test]
fn approve_fails_when_signed_by_someone_else() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);

    // signer 1 signs, but the call claims to be signer 0
    let args: Vec<soroban_sdk::Val> = (s.signers[0].clone(), id).into_val(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &s.signers[1],
        invoke: &MockAuthInvoke {
            contract: &s.id,
            fn_name: "approve",
            args,
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_approve(&s.signers[0], &id).is_err());
    assert_eq!(s.client.get_proposal(&id).approvals, 0);
}

#[test]
fn second_failing_action_reverts_the_first() {
    let s = Setup::new();
    let first = Address::generate(&s.env);
    let second = Address::generate(&s.env);

    // The first transfer is affordable; the second overdraws the treasury.
    let id = s.queue_and_wait(&[s.transfer(&first, 600_000), s.transfer(&second, 600_000)]);

    assert!(s.client.try_execute(&s.executor, &id).is_err());
    assert_eq!(s.balance_of(&first), 0);
    assert_eq!(s.balance_of(&second), 0);
    assert_eq!(s.client.balance(&s.token), FUNDING);
    // The status change was rolled back as well.
    assert_eq!(s.client.get_proposal(&id).status, ProposalStatus::Queued);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Ready);
}

#[test]
fn multiple_actions_all_apply() {
    let s = Setup::new();
    let first = Address::generate(&s.env);
    let second = Address::generate(&s.env);
    s.run(&[s.transfer(&first, 100), s.transfer(&second, 200)]);
    assert_eq!(s.balance_of(&first), 100);
    assert_eq!(s.balance_of(&second), 200);
}

// ------------------------------------------------------------ role enforcement

#[test]
fn only_proposers_can_propose() {
    let s = Setup::new();
    let actions = vec![&s.env, s.transfer(&Address::generate(&s.env), 5)];
    for outsider in [&s.signers[0], &s.executor, &Address::generate(&s.env)] {
        assert_eq!(
            s.client.try_propose(outsider, &actions, &s.memo()),
            Err(Ok(TreasuryError::NotProposer))
        );
    }
    assert_eq!(s.client.proposal_count(), 0);
}

#[test]
fn only_approvers_can_vote() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    for outsider in [&s.proposer, &s.executor, &Address::generate(&s.env)] {
        assert_eq!(
            s.client.try_approve(outsider, &id),
            Err(Ok(TreasuryError::NotApprover))
        );
        assert_eq!(
            s.client.try_reject(outsider, &id),
            Err(Ok(TreasuryError::NotApprover))
        );
    }
    assert_eq!(s.client.get_proposal(&id).votes.len(), 0);
}

#[test]
fn only_executors_can_execute() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let id = s.queue_and_wait(&[s.transfer(&recipient, 5)]);
    for outsider in [&s.proposer, &s.signers[0], &Address::generate(&s.env)] {
        assert_eq!(
            s.client.try_execute(outsider, &id),
            Err(Ok(TreasuryError::NotExecutor))
        );
    }
    assert_eq!(s.balance_of(&recipient), 0);
}

// ----------------------------------------------------------------------- votes

#[test]
fn double_voting_is_blocked() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    s.client.approve(&s.signers[0], &id);
    assert_eq!(
        s.client.try_approve(&s.signers[0], &id),
        Err(Ok(TreasuryError::AlreadyVoted))
    );
    // nor can an approver switch sides
    assert_eq!(
        s.client.try_reject(&s.signers[0], &id),
        Err(Ok(TreasuryError::AlreadyVoted))
    );
    assert_eq!(s.client.get_proposal(&id).approvals, 1);
}

#[test]
fn rejecter_cannot_approve_afterwards() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    s.client.reject(&s.signers[0], &id);
    assert_eq!(
        s.client.try_approve(&s.signers[0], &id),
        Err(Ok(TreasuryError::AlreadyVoted))
    );
}

#[test]
fn two_rejections_of_three_reject_a_threshold_two_proposal() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);

    // One rejection: two approvers remain, the threshold is still reachable.
    assert_eq!(s.client.reject(&s.signers[0], &id), ProposalStatus::Pending);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Pending);

    assert_eq!(
        s.client.reject(&s.signers[1], &id),
        ProposalStatus::Rejected
    );
    assert_eq!(s.client.proposal_state(&id), ProposalState::Rejected);
    assert_eq!(s.client.get_proposal(&id).rejections, 2);

    assert_eq!(
        s.client.try_approve(&s.signers[2], &id),
        Err(Ok(TreasuryError::ProposalNotPending))
    );
}

#[test]
fn voting_stops_once_queued() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    s.approve_to_threshold(id);
    assert_eq!(
        s.client.try_reject(&s.signers[2], &id),
        Err(Ok(TreasuryError::ProposalNotPending))
    );
}

// ---------------------------------------------------------------------- timing

#[test]
fn early_execute_fails_with_timelock_active() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let id = s.propose(&[s.transfer(&recipient, 5)]);
    s.approve_to_threshold(id);

    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::TimelockActive))
    );
    s.advance(TIMELOCK - 1);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::TimelockActive))
    );
    assert_eq!(s.balance_of(&recipient), 0);
}

#[test]
fn execute_works_at_both_edges_of_the_window() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);

    let at_eta = s.propose(&[s.transfer(&recipient, 1)]);
    let at_deadline = s.propose(&[s.transfer(&recipient, 2)]);
    s.approve_to_threshold(at_eta);
    s.approve_to_threshold(at_deadline);

    s.advance(TIMELOCK);
    s.client.execute(&s.executor, &at_eta);
    s.advance(EXECUTION_WINDOW);
    assert_eq!(s.client.proposal_state(&at_deadline), ProposalState::Ready);
    s.client.execute(&s.executor, &at_deadline);
    assert_eq!(s.balance_of(&recipient), 3);
}

#[test]
fn expired_execution_window_fails() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let id = s.queue_and_wait(&[s.transfer(&recipient, 5)]);

    s.advance(EXECUTION_WINDOW + 1);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Expired);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::ExecutionWindowExpired))
    );
    assert_eq!(s.balance_of(&recipient), 0);
}

#[test]
fn expired_voting_period_fails() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    s.client.approve(&s.signers[0], &id);

    // The last second of the voting period is still open.
    s.advance(VOTING_PERIOD);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Pending);

    s.advance(1);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Expired);
    assert_eq!(
        s.client.try_approve(&s.signers[1], &id),
        Err(Ok(TreasuryError::VotingClosed))
    );
    assert_eq!(
        s.client.try_reject(&s.signers[1], &id),
        Err(Ok(TreasuryError::VotingClosed))
    );
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::NotQueued))
    );
}

// ----------------------------------------------------------- cancel and replay

#[test]
fn cancel_works_during_the_timelock() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let id = s.propose(&[s.transfer(&recipient, 5)]);
    s.approve_to_threshold(id);
    s.advance(TIMELOCK / 2);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Queued);

    s.client.cancel(&s.proposer, &id);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Cancelled);

    s.advance(TIMELOCK);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::NotQueued))
    );
    assert_eq!(s.balance_of(&recipient), 0);
}

#[test]
fn cancel_works_while_pending_and_stops_voting() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    s.client.cancel(&s.proposer, &id);
    assert_eq!(
        s.client.try_approve(&s.signers[0], &id),
        Err(Ok(TreasuryError::ProposalNotPending))
    );
}

#[test]
fn non_proposer_cannot_cancel() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    for other in [&s.signers[0], &s.executor, &Address::generate(&s.env)] {
        assert_eq!(
            s.client.try_cancel(other, &id),
            Err(Ok(TreasuryError::NotProposalCreator))
        );
    }
    assert_eq!(s.client.proposal_state(&id), ProposalState::Pending);
}

#[test]
fn cancel_requires_the_proposers_signature() {
    let s = Setup::new();
    let id = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    s.env.mock_auths(&[]);
    assert!(s.client.try_cancel(&s.proposer, &id).is_err());
    assert_eq!(s.client.proposal_state(&id), ProposalState::Pending);
}

#[test]
fn finished_proposals_cannot_be_cancelled() {
    let s = Setup::new();
    let executed = s.run(&[s.transfer(&Address::generate(&s.env), 5)]);
    assert_eq!(
        s.client.try_cancel(&s.proposer, &executed),
        Err(Ok(TreasuryError::CannotCancel))
    );

    let cancelled = s.propose(&[s.transfer(&Address::generate(&s.env), 5)]);
    s.client.cancel(&s.proposer, &cancelled);
    assert_eq!(
        s.client.try_cancel(&s.proposer, &cancelled),
        Err(Ok(TreasuryError::CannotCancel))
    );
}

#[test]
fn proposal_cannot_be_executed_twice() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let id = s.run(&[s.transfer(&recipient, 5)]);
    assert_eq!(
        s.client.try_execute(&s.executor, &id),
        Err(Ok(TreasuryError::AlreadyExecuted))
    );
    assert_eq!(s.balance_of(&recipient), 5);
}

#[test]
fn get_proposals_pages_through_history() {
    let s = Setup::new();
    for amount in 1..=5 {
        s.propose(&[s.transfer(&Address::generate(&s.env), amount)]);
    }
    let page = s.client.get_proposals(&2, &3);
    assert_eq!(page.len(), 3);
    assert_eq!(page.get_unchecked(0).id, 2);
    assert_eq!(page.get_unchecked(2).id, 4);
    assert_eq!(s.client.get_proposals(&5, &20).len(), 1);
    assert_eq!(s.client.get_proposals(&6, &20).len(), 0);
    // id 0 does not exist; paging starts at 1
    assert_eq!(s.client.get_proposals(&0, &20).len(), 5);
    assert_eq!(s.client.get_proposals(&1, &0).len(), 0);
}
