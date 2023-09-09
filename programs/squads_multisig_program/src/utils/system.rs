use anchor_lang::prelude::*;

/// Creates `new_account` via a CPI into SystemProgram.
/// Adapted from Anchor: https://github.com/coral-xyz/anchor/blob/714d5248636493a3d1db1481f16052836ee59e94/lang/syn/src/codegen/accounts/constraints.rs#L1126-L1179
pub fn create_account<'a, 'info>(
    payer: &'a AccountInfo<'info>,
    new_account: &'a AccountInfo<'info>,
    system_program: &'a AccountInfo<'info>,
    owner_program: &Pubkey,
    rent: &Rent,
    space: usize,
    seeds: Vec<Vec<u8>>,
) -> Result<()> {
    let current_lamports = **new_account.try_borrow_lamports()?;

    if current_lamports == 0 {
        // If the account has no lamports, we create it with system program's create_account instruction.
        anchor_lang::system_program::create_account(
            CpiContext::new(
                system_program.clone(),
                anchor_lang::system_program::CreateAccount {
                    from: payer.clone(),
                    to: new_account.clone(),
                },
            )
            .with_signer(&[seeds
                .iter()
                .map(|seed| seed.as_slice())
                .collect::<Vec<&[u8]>>()
                .as_slice()]),
            rent.minimum_balance(space),
            space as u64,
            owner_program,
        )
    } else {
        require_keys_neq!(
            payer.key(),
            new_account.key(),
            anchor_lang::error::ErrorCode::TryingToInitPayerAsProgramAccount
        );

        // Fund the account for rent exemption.
        let required_lamports = rent
            .minimum_balance(space)
            .max(1)
            .saturating_sub(current_lamports);
        if required_lamports > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    system_program.clone(),
                    anchor_lang::system_program::Transfer {
                        from: payer.clone(),
                        to: new_account.clone(),
                    },
                ),
                required_lamports,
            )?;
        }

        // Allocate space.
        anchor_lang::system_program::allocate(
            CpiContext::new(
                system_program.to_account_info(),
                anchor_lang::system_program::Allocate {
                    account_to_allocate: new_account.clone(),
                },
            )
            .with_signer(&[seeds
                .iter()
                .map(|seed| seed.as_slice())
                .collect::<Vec<&[u8]>>()
                .as_slice()]),
            space as u64,
        )?;

        // Assign to the owner_program.
        anchor_lang::system_program::assign(
            CpiContext::new(
                system_program.to_account_info(),
                anchor_lang::system_program::Assign {
                    account_to_assign: new_account.clone(),
                },
            )
            .with_signer(&[seeds
                .iter()
                .map(|seed| seed.as_slice())
                .collect::<Vec<&[u8]>>()
                .as_slice()]),
            owner_program,
        )
    }
}
