use soroban_sdk::{testutils::Address as _, vec, Address, Env, Vec};

use super::{default_config, Setup, EXECUTION_WINDOW, TIMELOCK, VOTING_PERIOD};
use crate::{Config, Role, Treasury, TreasuryClient, MAX_APPROVERS};

fn addresses(env: &Env, count: u32) -> Vec<Address> {
    let mut list = Vec::new(env);
    for _ in 0..count {
        list.push_back(Address::generate(env));
    }
    list
}

fn deploy(
    env: &Env,
    approvers: Vec<Address>,
    proposers: Vec<Address>,
    executors: Vec<Address>,
    config: Config,
) -> Address {
    env.register(Treasury, (approvers, proposers, executors, config))
}

#[test]
fn stores_config_and_roles() {
    let s = Setup::new();
    assert_eq!(s.client.get_config(), default_config(2));
    assert_eq!(s.client.get_config_version(), 0);
    assert_eq!(s.client.proposal_count(), 0);

    let approvers = s.client.members(&Role::Approver);
    assert_eq!(approvers.len(), 3);
    for signer in &s.signers {
        assert!(approvers.contains(signer));
        assert!(s.client.has_role(signer, &Role::Approver));
        assert!(!s.client.has_role(signer, &Role::Proposer));
    }
    assert_eq!(
        s.client.members(&Role::Proposer),
        vec![&s.env, s.proposer.clone()]
    );
    assert_eq!(
        s.client.members(&Role::Executor),
        vec![&s.env, s.executor.clone()]
    );
}

#[test]
fn treasury_is_its_own_admin() {
    let s = Setup::new();
    let admin = s
        .env
        .as_contract(&s.id, || stellar_access::access_control::get_admin(&s.env));
    assert_eq!(admin, Some(s.id.clone()));
}

#[test]
fn accepts_one_address_in_several_roles() {
    let env = Env::default();
    let solo = Address::generate(&env);
    let id = deploy(
        &env,
        vec![&env, solo.clone()],
        vec![&env, solo.clone()],
        vec![&env, solo.clone()],
        default_config(1),
    );
    let client = TreasuryClient::new(&env, &id);
    assert!(client.has_role(&solo, &Role::Approver));
    assert!(client.has_role(&solo, &Role::Proposer));
    assert!(client.has_role(&solo, &Role::Executor));
}

#[test]
fn accepts_maximum_approvers() {
    let env = Env::default();
    let id = deploy(
        &env,
        addresses(&env, MAX_APPROVERS),
        addresses(&env, 1),
        addresses(&env, 1),
        default_config(MAX_APPROVERS),
    );
    let client = TreasuryClient::new(&env, &id);
    assert_eq!(client.members(&Role::Approver).len(), MAX_APPROVERS);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_zero_threshold() {
    let env = Env::default();
    deploy(
        &env,
        addresses(&env, 3),
        addresses(&env, 1),
        addresses(&env, 1),
        default_config(0),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_threshold_above_signer_count() {
    let env = Env::default();
    deploy(
        &env,
        addresses(&env, 3),
        addresses(&env, 1),
        addresses(&env, 1),
        default_config(4),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_duplicate_signers() {
    let env = Env::default();
    let twice = Address::generate(&env);
    deploy(
        &env,
        vec![&env, twice.clone(), Address::generate(&env), twice],
        addresses(&env, 1),
        addresses(&env, 1),
        default_config(2),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_duplicate_proposers() {
    let env = Env::default();
    let twice = Address::generate(&env);
    deploy(
        &env,
        addresses(&env, 3),
        vec![&env, twice.clone(), twice],
        addresses(&env, 1),
        default_config(2),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rejects_missing_executor() {
    let env = Env::default();
    deploy(
        &env,
        addresses(&env, 3),
        addresses(&env, 1),
        Vec::new(&env),
        default_config(2),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rejects_missing_proposer() {
    let env = Env::default();
    deploy(
        &env,
        addresses(&env, 3),
        Vec::new(&env),
        addresses(&env, 1),
        default_config(2),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rejects_no_approvers() {
    let env = Env::default();
    deploy(
        &env,
        Vec::new(&env),
        addresses(&env, 1),
        addresses(&env, 1),
        default_config(1),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn rejects_too_many_approvers() {
    let env = Env::default();
    deploy(
        &env,
        addresses(&env, MAX_APPROVERS + 1),
        addresses(&env, 1),
        addresses(&env, 1),
        default_config(2),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn rejects_zero_voting_period() {
    let env = Env::default();
    deploy(
        &env,
        addresses(&env, 3),
        addresses(&env, 1),
        addresses(&env, 1),
        Config {
            threshold: 2,
            timelock_delay: TIMELOCK,
            voting_period: 0,
            execution_window: EXECUTION_WINDOW,
        },
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn rejects_zero_execution_window() {
    let env = Env::default();
    deploy(
        &env,
        addresses(&env, 3),
        addresses(&env, 1),
        addresses(&env, 1),
        Config {
            threshold: 2,
            timelock_delay: TIMELOCK,
            voting_period: VOTING_PERIOD,
            execution_window: 0,
        },
    );
}

#[test]
fn allows_zero_timelock() {
    let env = Env::default();
    let id = deploy(
        &env,
        addresses(&env, 3),
        addresses(&env, 1),
        addresses(&env, 1),
        Config {
            threshold: 2,
            timelock_delay: 0,
            voting_period: VOTING_PERIOD,
            execution_window: EXECUTION_WINDOW,
        },
    );
    assert_eq!(
        TreasuryClient::new(&env, &id).get_config().timelock_delay,
        0
    );
}
