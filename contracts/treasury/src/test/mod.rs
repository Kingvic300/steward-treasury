mod constructor;
mod governance;
mod invoke;
mod lifecycle;
mod props;
mod spending;
mod validation;

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, String, Vec,
};

use crate::{
    Action, Config, MemberAction, Role, SpendingLimitAction, SpendingLimitKey, TransferAction,
    Treasury, TreasuryClient,
};

pub const TIMELOCK: u64 = 300;
pub const VOTING_PERIOD: u64 = 7 * 24 * 60 * 60;
pub const EXECUTION_WINDOW: u64 = 3 * 24 * 60 * 60;
pub const START: u64 = 1_700_000_000;
pub const FUNDING: i128 = 1_000_000;

pub fn default_config(threshold: u32) -> Config {
    Config {
        threshold,
        timelock_delay: TIMELOCK,
        voting_period: VOTING_PERIOD,
        execution_window: EXECUTION_WINDOW,
    }
}

/// A 2-of-3 treasury with one proposer, one executor and a funded token.
pub struct Setup {
    pub env: Env,
    pub id: Address,
    pub client: TreasuryClient<'static>,
    pub signers: std::vec::Vec<Address>,
    pub proposer: Address,
    pub executor: Address,
    pub token: Address,
}

impl Setup {
    pub fn new() -> Self {
        Self::with(3, 2)
    }

    pub fn with(signer_count: u32, threshold: u32) -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().set_timestamp(START);

        let signers: std::vec::Vec<Address> =
            (0..signer_count).map(|_| Address::generate(&env)).collect();
        let proposer = Address::generate(&env);
        let executor = Address::generate(&env);

        let id = env.register(
            Treasury,
            (
                Vec::from_slice(&env, &signers),
                vec![&env, proposer.clone()],
                vec![&env, executor.clone()],
                default_config(threshold),
            ),
        );
        let client = TreasuryClient::new(&env, &id);

        let issuer = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(issuer).address();
        StellarAssetClient::new(&env, &token).mint(&id, &FUNDING);

        Setup {
            env,
            id,
            client,
            signers,
            proposer,
            executor,
            token,
        }
    }

    pub fn token_client(&self) -> TokenClient<'_> {
        TokenClient::new(&self.env, &self.token)
    }

    pub fn balance_of(&self, account: &Address) -> i128 {
        self.token_client().balance(account)
    }

    pub fn memo(&self) -> String {
        String::from_str(&self.env, "test proposal")
    }

    pub fn advance(&self, seconds: u64) {
        let now = self.env.ledger().timestamp();
        self.env.ledger().set_timestamp(now + seconds);
    }

    pub fn transfer(&self, to: &Address, amount: i128) -> Action {
        Action::Transfer(TransferAction {
            token: self.token.clone(),
            to: to.clone(),
            amount,
        })
    }

    pub fn add_member(&self, account: &Address, role: Role) -> Action {
        Action::AddMember(MemberAction {
            account: account.clone(),
            role,
        })
    }

    pub fn remove_member(&self, account: &Address, role: Role) -> Action {
        Action::RemoveMember(MemberAction {
            account: account.clone(),
            role,
        })
    }

    pub fn set_limit(&self, spender: &Address, amount: i128, period: u64) -> Action {
        Action::SetSpendingLimit(SpendingLimitAction {
            spender: spender.clone(),
            token: self.token.clone(),
            amount,
            period,
        })
    }

    pub fn remove_limit(&self, spender: &Address) -> Action {
        Action::RemoveSpendingLimit(SpendingLimitKey {
            spender: spender.clone(),
            token: self.token.clone(),
        })
    }

    pub fn propose(&self, actions: &[Action]) -> u64 {
        self.client.propose(
            &self.proposer,
            &Vec::from_slice(&self.env, actions),
            &self.memo(),
        )
    }

    /// Approves with as many signers as the current threshold requires.
    pub fn approve_to_threshold(&self, id: u64) {
        let threshold = self.client.get_config().threshold as usize;
        let approvers = self.client.members(&Role::Approver);
        for approver in approvers.iter().take(threshold) {
            self.client.approve(&approver, &id);
        }
    }

    /// Proposes, approves and waits out the timelock. Returns the proposal id.
    pub fn queue_and_wait(&self, actions: &[Action]) -> u64 {
        let id = self.propose(actions);
        self.approve_to_threshold(id);
        self.advance(self.client.get_config().timelock_delay);
        id
    }

    /// Runs the whole lifecycle and executes. Returns the proposal id.
    pub fn run(&self, actions: &[Action]) -> u64 {
        let id = self.queue_and_wait(actions);
        self.client.execute(&self.executor, &id);
        id
    }
}
