//! # Steward
//!
//! A programmable multisig treasury for Stellar.
//!
//! Steward goes beyond the native account multisig (signer weights and
//! thresholds) by adding multi-action proposals, timelocked execution with a
//! cancel window, separate proposer / approver / executor roles, per-spender
//! spending limits, arbitrary contract invocation, and self-governed
//! configuration: every membership or config change must pass through one of
//! the treasury's own proposals.
//!
//! **Unaudited software. Do not use on mainnet with real funds.**
#![no_std]

#[cfg(test)]
extern crate std;

mod contract;
mod errors;
mod events;
mod rules;
mod storage;
mod types;

pub use contract::{Treasury, TreasuryClient};
pub use errors::TreasuryError;
pub use types::*;

#[cfg(test)]
mod test;
