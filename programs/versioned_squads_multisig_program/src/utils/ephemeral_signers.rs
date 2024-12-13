use anchor_lang::prelude::*;

use crate::state::*;

/// Return a tuple of ephemeral_signer_keys and ephemeral_signer_seeds derived
/// from the given `ephemeral_signer_bumps` and `transaction_key`.
pub fn derive_ephemeral_signers(
    transaction_key: Pubkey,
    ephemeral_signer_bumps: &[u8],
) -> (Vec<Pubkey>, Vec<Vec<Vec<u8>>>) {
    ephemeral_signer_bumps
        .iter()
        .enumerate()
        .map(|(index, bump)| {
            let seeds = vec![
                SEED_PREFIX.to_vec(),
                transaction_key.to_bytes().to_vec(),
                SEED_EPHEMERAL_SIGNER.to_vec(),
                u8::try_from(index).unwrap().to_le_bytes().to_vec(),
                vec![*bump],
            ];

            (
                Pubkey::create_program_address(
                    seeds
                        .iter()
                        .map(Vec::as_slice)
                        .collect::<Vec<&[u8]>>()
                        .as_slice(),
                    &crate::id(),
                )
                .unwrap(),
                seeds,
            )
        })
        .unzip()
}
