use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    vec, Address, Env, IntoVal, Symbol, Val, Vec,
};

use super::{Setup, FUNDING};
use crate::{Action, InvokeAction, ProposalState, ProposalStatus};

/// A contract that only the treasury may drive.
#[contract]
struct Vault;

#[contractimpl]
impl Vault {
    pub fn set_owner(e: Env, owner: Address) {
        e.storage().instance().set(&symbol_short!("owner"), &owner);
    }

    pub fn bump(e: Env, by: u32) -> u32 {
        let owner: Address = e.storage().instance().get(&symbol_short!("owner")).unwrap();
        owner.require_auth();
        let total = e
            .storage()
            .instance()
            .get(&symbol_short!("total"))
            .unwrap_or(0u32)
            + by;
        e.storage().instance().set(&symbol_short!("total"), &total);
        total
    }

    pub fn total(e: Env) -> u32 {
        e.storage()
            .instance()
            .get(&symbol_short!("total"))
            .unwrap_or(0)
    }

    pub fn fail(_e: Env) {
        panic!("always fails");
    }
}

fn invoke(contract: &Address, function: &str, args: Vec<Val>) -> Action {
    Action::Invoke(InvokeAction {
        contract: contract.clone(),
        function: Symbol::new(args.env(), function),
        args,
    })
}

fn sign_execute_only(s: &Setup, id: u64) {
    let args: Vec<Val> = (s.executor.clone(), id).into_val(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &s.executor,
        invoke: &MockAuthInvoke {
            contract: &s.id,
            fn_name: "execute",
            args,
            sub_invokes: &[],
        },
    }]);
}

#[test]
fn invoke_token_transfer_succeeds_through_invoker_auth() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let args: Vec<Val> = vec![
        &s.env,
        s.id.into_val(&s.env),
        recipient.into_val(&s.env),
        750i128.into_val(&s.env),
    ];
    let id = s.queue_and_wait(&[invoke(&s.token, "transfer", args)]);

    // From here on the ONLY signature available is the executor's, and only
    // for `execute`. Nothing signs for the treasury: `token.transfer` checks
    // `treasury.require_auth()`, which the host satisfies because the treasury
    // is the direct invoker.
    sign_execute_only(&s, id);
    s.client.execute(&s.executor, &id);

    assert_eq!(s.balance_of(&recipient), 750);
    assert_eq!(s.balance_of(&s.id), FUNDING - 750);
    assert_eq!(s.client.proposal_state(&id), ProposalState::Executed);
}

#[test]
fn transfer_action_succeeds_with_only_the_executors_signature() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let id = s.queue_and_wait(&[s.transfer(&recipient, 20)]);
    sign_execute_only(&s, id);
    s.client.execute(&s.executor, &id);
    assert_eq!(s.balance_of(&recipient), 20);
}

#[test]
fn execute_with_no_signatures_fails() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let id = s.queue_and_wait(&[s.transfer(&recipient, 20)]);

    s.env.mock_auths(&[]);
    assert!(s.client.try_execute(&s.executor, &id).is_err());

    assert_eq!(s.balance_of(&recipient), 0);
    assert_eq!(s.client.get_proposal(&id).status, ProposalStatus::Queued);
}

#[test]
fn execute_fails_with_another_accounts_signature() {
    let s = Setup::new();
    let recipient = Address::generate(&s.env);
    let id = s.queue_and_wait(&[s.transfer(&recipient, 20)]);

    // signer 0 signs an `execute` that names the executor
    let args: Vec<Val> = (s.executor.clone(), id).into_val(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &s.signers[0],
        invoke: &MockAuthInvoke {
            contract: &s.id,
            fn_name: "execute",
            args,
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_execute(&s.executor, &id).is_err());
    assert_eq!(s.balance_of(&recipient), 0);
}

#[test]
fn invoke_calls_an_arbitrary_contract_as_the_treasury() {
    let s = Setup::new();
    let vault = s.env.register(Vault, ());
    VaultClient::new(&s.env, &vault).set_owner(&s.id);

    let id = s.queue_and_wait(&[
        invoke(&vault, "bump", vec![&s.env, 4u32.into_val(&s.env)]),
        invoke(&vault, "bump", vec![&s.env, 6u32.into_val(&s.env)]),
    ]);
    sign_execute_only(&s, id);
    s.client.execute(&s.executor, &id);

    assert_eq!(VaultClient::new(&s.env, &vault).total(), 10);
}

#[test]
fn outsiders_cannot_drive_the_vault_directly() {
    let s = Setup::new();
    let vault = s.env.register(Vault, ());
    VaultClient::new(&s.env, &vault).set_owner(&s.id);
    s.env.mock_auths(&[]);
    assert!(VaultClient::new(&s.env, &vault).try_bump(&1).is_err());
}

#[test]
fn failing_invoke_reverts_earlier_actions() {
    let s = Setup::new();
    let vault = s.env.register(Vault, ());
    VaultClient::new(&s.env, &vault).set_owner(&s.id);
    let recipient = Address::generate(&s.env);

    let id = s.queue_and_wait(&[
        s.transfer(&recipient, 100),
        invoke(&vault, "bump", vec![&s.env, 4u32.into_val(&s.env)]),
        invoke(&vault, "fail", Vec::new(&s.env)),
    ]);
    assert!(s.client.try_execute(&s.executor, &id).is_err());

    assert_eq!(s.balance_of(&recipient), 0);
    assert_eq!(VaultClient::new(&s.env, &vault).total(), 0);
    assert_eq!(s.client.get_proposal(&id).status, ProposalStatus::Queued);
}

#[test]
fn invoke_cannot_reenter_the_treasury() {
    let s = Setup::new();
    // A proposal that tries to call the treasury's own `execute`.
    let args: Vec<Val> = (s.executor.clone(), 1u64).into_val(&s.env);
    let id = s.queue_and_wait(&[invoke(&s.id, "execute", args)]);
    assert!(s.client.try_execute(&s.executor, &id).is_err());
    assert_eq!(s.client.get_proposal(&id).status, ProposalStatus::Queued);
}
