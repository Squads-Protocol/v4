//! Pins the compiled `TransactionMessage` bytes for a fixed input. The TypeScript SDK
//! (`sdk/multisig-4r/test/unit/message.test.ts`) asserts the same vector.

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use solana_message::AddressLookupTableAccount;
use squads_multisig_4r::message::transaction_message_bytes;

pub const EXPECTED_HEX: &str = concat!(
    "0201010609090909090909090909090909090909090909090909090909090909090909090505050505050505",
    "0505050505050505050505050505050505050505050505050707070707070707070707070707070707070707",
    "0707070707070707070707070303030303030303030303030303030303030303030303030303030303030303",
    "6464646464646464646464646464646464646464646464646464646464646464c8c8c8c8c8c8c8c8c8c8c8c8",
    "c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8020503000201030001020304030306070000013c3c3c3c3c",
    "3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c01020100",
);

fn key(byte: u8) -> Address {
    Address::new_from_array([byte; 32])
}

#[test]
fn compiled_message_matches_the_shared_cross_sdk_vector() {
    // Arrange
    let vault = key(9);
    let instructions = [
        Instruction::new_with_bytes(
            key(200),
            &[1, 2, 3],
            vec![
                AccountMeta::new(vault, true),
                AccountMeta::new(key(7), false),
                AccountMeta::new_readonly(key(5), true),
            ],
        ),
        Instruction::new_with_bytes(
            key(100),
            &[],
            vec![
                AccountMeta::new_readonly(key(3), false),
                AccountMeta::new(key(1), false),
                AccountMeta::new_readonly(key(8), false),
            ],
        ),
    ];
    let tables = [
        AddressLookupTableAccount {
            key: key(50),
            addresses: vec![key(42), key(43)],
        },
        AddressLookupTableAccount {
            key: key(60),
            addresses: vec![key(8), key(99), key(1)],
        },
    ];

    // Act
    let bytes = transaction_message_bytes(&vault, &instructions, &tables).expect("compile");

    // Assert
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(hex, EXPECTED_HEX);
}
