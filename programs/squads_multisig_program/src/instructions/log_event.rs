#[cfg(feature = "program")]
use anchor_lang::prelude::*;
#[cfg(feature = "program")]
use anchor_lang::solana_program::instruction::{get_stack_height, TRANSACTION_LEVEL_STACK_HEIGHT};

#[cfg(feature = "program")]
use crate::errors::*;
#[cfg(feature = "program")]
use crate::events::is_log_authority_data;
#[cfg(not(feature = "program"))]
use crate::prelude::*;

/// `event` is a borsh-encoded [`crate::events::MultisigEvent`].
#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LogEventArgs {
    pub event: Vec<u8>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct LogEvent<'info> {
    #[account(
        constraint = is_log_authority(&log_authority) @ MultisigError::ProtectedInstruction,
    )]
    /// A `Multisig` or `ProgramConfig` PDA. Only this program can sign for it.
    pub log_authority: Signer<'info>,
}

/// Owned by this program and holding a `Multisig` or `ProgramConfig` discriminator.
#[cfg(feature = "program")]
fn is_log_authority(account: &AccountInfo) -> bool {
    account.owner == &crate::ID
        && account
            .try_borrow_data()
            .is_ok_and(|data| is_log_authority_data(&data))
}

#[cfg(feature = "program")]
fn require_cpi() -> Result<()> {
    require!(
        get_stack_height() > TRANSACTION_LEVEL_STACK_HEIGHT,
        MultisigError::ProtectedInstruction
    );
    Ok(())
}

/// The `LogEvent` checks in Anchor's order (signer, account constraint, handler), for the fast
/// path in the entrypoint. The errors are the same as on the Anchor path.
#[cfg(feature = "program")]
pub fn check_log_event(log_authority: &AccountInfo) -> Result<()> {
    if !log_authority.is_signer {
        return Err(Error::from(ErrorCode::AccountNotSigner).with_account_name("log_authority"));
    }
    if !is_log_authority(log_authority) {
        return Err(
            Error::from(MultisigError::ProtectedInstruction).with_account_name("log_authority")
        );
    }
    require_cpi()
}

#[cfg(feature = "program")]
impl LogEvent<'_> {
    /// The event is in the instruction data. Indexers read it from the inner instructions.
    /// With `custom-entrypoint` (the default), the entrypoint answers `log_event` and this
    /// handler does not run.
    #[access_control(require_cpi())]
    pub fn log_event(_ctx: Context<Self>, _args: LogEventArgs) -> Result<()> {
        Ok(())
    }
}

#[cfg(all(test, feature = "program"))]
mod tests {
    use anchor_lang::error::ErrorOrigin;

    use super::*;
    use crate::discriminator::account;

    /// `(error code, account name)` of the `check_log_event` result.
    fn check(is_signer: bool, owner: Pubkey, discriminator: [u8; 8]) -> (u32, Option<String>) {
        let key = Pubkey::new_unique();
        let mut lamports = 1;
        let mut data = [discriminator.as_slice(), &[0; 32]].concat();
        let info = AccountInfo::new(
            &key,
            is_signer,
            false,
            &mut lamports,
            &mut data,
            &owner,
            false,
        );
        match check_log_event(&info) {
            Err(Error::AnchorError(error)) => (
                error.error_code_number,
                match error.error_origin {
                    Some(ErrorOrigin::AccountName(name)) => Some(name),
                    _ => None,
                },
            ),
            other => panic!("unexpected result {other:?}"),
        }
    }

    #[test]
    fn check_log_event_rejects_in_anchor_order() {
        // Arrange
        let protected = MultisigError::ProtectedInstruction.code();
        let named = Some("log_authority".to_string());

        // Act + Assert
        assert_eq!(
            check(false, crate::ID, account::MULTISIG),
            (ErrorCode::AccountNotSigner.into(), named.clone())
        );
        assert_eq!(
            check(true, Pubkey::new_unique(), account::MULTISIG),
            (protected, named.clone())
        );
        assert_eq!(check(true, crate::ID, [0; 8]), (protected, named.clone()));
        assert_eq!(
            check(true, crate::ID, account::PROPOSAL),
            (protected, named)
        );
        // A valid authority passes the account checks. On the host the stack height is 0, so the
        // CPI check fails, without an account name.
        assert_eq!(check(true, crate::ID, account::MULTISIG), (protected, None));
        assert_eq!(
            check(true, crate::ID, account::PROGRAM_CONFIG),
            (protected, None)
        );
    }
}
