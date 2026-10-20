//! Anchor treats an optional account as `None` when its key equals the executing program ID.
//! `with_program_id` must move the generated mainnet placeholders to the target program ID.

use solana_address::Address;
use squads_multisig_4r::instructions::ConfigTransactionExecute;
use squads_multisig_4r::{with_program_id, ID};

fn config_transaction_execute(rent_payer: Option<Address>) -> ConfigTransactionExecute {
    ConfigTransactionExecute {
        multisig: Address::new_unique(),
        member: Address::new_unique(),
        proposal: Address::new_unique(),
        transaction: Address::new_unique(),
        rent_payer,
        system_program: None,
    }
}

#[test]
fn none_optional_accounts_follow_the_target_program_id() {
    // Arrange
    let staging = Address::new_unique();
    let instruction = config_transaction_execute(None).instruction();

    // Act
    let instruction = with_program_id(instruction, &staging);

    // Assert
    assert_eq!(instruction.program_id, staging);
    assert!(instruction.accounts[4..]
        .iter()
        .all(|meta| meta.pubkey == staging && !meta.is_signer && !meta.is_writable));
    assert!(instruction.accounts.iter().all(|meta| meta.pubkey != ID));
}

#[test]
fn some_optional_accounts_and_required_accounts_do_not_change() {
    // Arrange
    let staging = Address::new_unique();
    let rent_payer = Address::new_unique();
    let original = config_transaction_execute(Some(rent_payer)).instruction();

    // Act
    let instruction = with_program_id(original.clone(), &staging);

    // Assert
    assert_eq!(instruction.accounts[..5], original.accounts[..5]);
    assert_eq!(instruction.accounts[4].pubkey, rent_payer);
    assert_eq!(instruction.accounts[5].pubkey, staging);
    assert_eq!(instruction.data, original.data);
}

#[test]
fn mainnet_program_id_is_a_no_op() {
    // Arrange
    let original = config_transaction_execute(None).instruction();

    // Act
    let instruction = with_program_id(original.clone(), &ID);

    // Assert
    assert_eq!(instruction, original);
}
