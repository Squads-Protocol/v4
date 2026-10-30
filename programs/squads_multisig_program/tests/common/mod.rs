//! Shared helpers for the integration tests: golden fixtures and the IDL.
#![allow(dead_code)]

use serde_json::Value;

pub const ACCOUNTS: &str = include_str!("../fixtures/golden/accounts.txt");
pub const INSTRUCTIONS: &str = include_str!("../fixtures/golden/instructions.txt");
pub const V3_ACCOUNTS: &str = include_str!("../fixtures/golden/v3_accounts.txt");
const IDL: &str = include_str!("../../../../idl/squads_multisig_4r_program.json");

/// `(label, identifier, bytes)` per non-comment fixture line.
pub fn fixtures(text: &'static str) -> impl Iterator<Item = (&'static str, &'static str, Vec<u8>)> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| {
            let mut parts = line.split_whitespace();
            let label = parts.next().expect("label");
            let id = parts.next().expect("identifier");
            (label, id, hex_decode(parts.next().expect("hex data")))
        })
}

pub fn hex_decode(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("valid hex"))
        .collect()
}

/// Mainnet instruction data for `instruction` (fixture label = instruction name).
pub fn instruction_data(instruction: &str) -> Vec<Vec<u8>> {
    let data: Vec<Vec<u8>> = fixtures(INSTRUCTIONS)
        .filter(|(label, _, _)| *label == instruction)
        .map(|(_, _, bytes)| bytes)
        .collect();
    assert!(!data.is_empty(), "no fixture for {instruction}");
    data
}

pub fn idl() -> Value {
    serde_json::from_str(IDL).expect("valid IDL")
}

/// `(writable, signer, optional)` per account of `instruction`, composites flattened.
pub fn idl_account_flags(instruction: &str) -> Vec<(bool, bool, bool)> {
    fn flatten(accounts: &[Value]) -> Vec<(bool, bool, bool)> {
        accounts
            .iter()
            .flat_map(|account| match account.get("accounts") {
                Some(inner) => flatten(inner.as_array().expect("composite accounts")),
                None => {
                    let flag = |key: &str| account.get(key).and_then(Value::as_bool) == Some(true);
                    vec![(flag("writable"), flag("signer"), flag("optional"))]
                }
            })
            .collect()
    }
    let idl = idl();
    let ix = idl["instructions"]
        .as_array()
        .expect("instructions")
        .iter()
        .find(|ix| ix["name"] == instruction)
        .unwrap_or_else(|| panic!("{instruction} not in IDL"))
        .clone();
    flatten(ix["accounts"].as_array().expect("accounts"))
}

/// The discriminator of the IDL instruction `name`.
pub fn idl_discriminator(name: &str) -> Vec<u8> {
    idl()["instructions"]
        .as_array()
        .expect("instructions")
        .iter()
        .find(|ix| ix["name"] == name)
        .unwrap_or_else(|| panic!("{name} not in IDL"))["discriminator"]
        .as_array()
        .expect("discriminator")
        .iter()
        .map(|byte| byte.as_u64().expect("byte") as u8)
        .collect()
}

/// `(writable, signer, optional)` of each account of `instruction`, as `idl_account_flags` gives them.
pub fn flags(instruction: &solana_instruction::Instruction) -> Vec<(bool, bool, bool)> {
    instruction
        .accounts
        .iter()
        .map(|meta| (meta.is_writable, meta.is_signer, false))
        .collect()
}
