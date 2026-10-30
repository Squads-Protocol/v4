//! Compatibility with the frozen v4 program: the IDL entries of the 36 v4 instructions do not
//! change, and every instruction discriminator is unique. Runs with and without `program`.

mod common;

use common::idl;
use serde_json::Value;
use squads_multisig_4r_program::discriminator::instruction::LOG_EVENT;

/// The v4 instruction entries of the IDL at the last commit before 4r-only instructions.
const V4_INSTRUCTIONS: &str = include_str!("fixtures/v4_idl_instructions.json");

fn idl_instructions() -> Vec<Value> {
    idl()["instructions"]
        .as_array()
        .expect("instructions")
        .clone()
}

#[test]
fn v4_instruction_entries_are_frozen() {
    // Arrange
    let frozen: Vec<Value> = serde_json::from_str(V4_INSTRUCTIONS).expect("snapshot");
    let current = idl_instructions();

    // Act
    let changed: Vec<&Value> = frozen
        .iter()
        .filter(|entry| !current.contains(entry))
        .map(|entry| &entry["name"])
        .collect();

    // Assert
    assert_eq!(frozen.len(), 36);
    assert!(
        changed.is_empty(),
        "v4 instruction entries changed: {changed:?}"
    );
}

#[test]
fn instruction_discriminators_are_unique() {
    // Arrange
    let instructions = idl_instructions();

    // Act
    let mut discriminators: Vec<(Vec<u64>, &str)> = instructions
        .iter()
        .map(|ix| {
            let bytes = ix["discriminator"]
                .as_array()
                .expect("discriminator")
                .iter()
                .map(|byte| byte.as_u64().expect("byte"))
                .collect();
            (bytes, ix["name"].as_str().expect("name"))
        })
        .collect();
    discriminators.sort();
    let duplicates: Vec<_> = discriminators
        .windows(2)
        .filter(|pair| pair[0].0 == pair[1].0)
        .map(|pair| (pair[0].1, pair[1].1))
        .collect();
    let log_event: Vec<u64> = LOG_EVENT.iter().map(|byte| u64::from(*byte)).collect();
    let fast_path: Vec<&str> = discriminators
        .iter()
        .filter(|(bytes, _)| *bytes == log_event)
        .map(|(_, name)| *name)
        .collect();

    // Assert: the custom entrypoint answers `LOG_EVENT` before Anchor, so only `log_event` may use it.
    assert!(
        duplicates.is_empty(),
        "duplicate discriminators: {duplicates:?}"
    );
    assert_eq!(fast_path, ["log_event"]);
}
