//! Reads token accounts and mints of Token and Token-2022 (Token-2022 parsing covers both).

use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::extension::{
    cpi_guard::CpiGuard, default_account_state::DefaultAccountState,
    non_transferable::NonTransferable, pausable::PausableConfig, transfer_fee::TransferFeeAmount,
    transfer_hook::TransferHook, BaseStateWithExtensions, StateWithExtensions,
};
use anchor_spl::token_2022::spl_token_2022::state::{Account as TokenAccount, AccountState, Mint};

pub(crate) struct TokenAccountState {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
    pub frozen: bool,
    pub close_authority: Option<Pubkey>,
    pub withheld: u64,
    pub cpi_guard: bool,
}

/// `None` if `info` is not an initialized token account of `token_program`.
pub(crate) fn token_account_state(
    info: &AccountInfo,
    token_program: &Pubkey,
) -> Option<TokenAccountState> {
    if info.owner != token_program {
        return None;
    }
    let data = info.try_borrow_data().ok()?;
    let state = StateWithExtensions::<TokenAccount>::unpack(&data).ok()?;
    Some(TokenAccountState {
        mint: state.base.mint,
        owner: state.base.owner,
        amount: state.base.amount,
        frozen: state.base.state == AccountState::Frozen,
        close_authority: state.base.close_authority.into(),
        withheld: state
            .get_extension::<TransferFeeAmount>()
            .map_or(0, |fee| u64::from(fee.withheld_amount)),
        cpi_guard: state
            .get_extension::<CpiGuard>()
            .is_ok_and(|guard| bool::from(guard.lock_cpi)),
    })
}

pub(crate) struct MintState {
    pub decimals: u8,
    /// A transfer hook, non-transferable or paused: no plain transfer through a CPI.
    pub unsupported: bool,
    /// New token accounts start frozen.
    pub default_frozen: bool,
}

/// `None` if `info` is not an initialized mint of `token_program`.
pub(crate) fn mint_state(info: &AccountInfo, token_program: &Pubkey) -> Option<MintState> {
    if info.owner != token_program {
        return None;
    }
    let data = info.try_borrow_data().ok()?;
    let state = StateWithExtensions::<Mint>::unpack(&data).ok()?;
    let transfer_hook = state
        .get_extension::<TransferHook>()
        .is_ok_and(|hook| hook.program_id.as_ref().is_some());
    let paused = state
        .get_extension::<PausableConfig>()
        .is_ok_and(|config| bool::from(config.paused));
    Some(MintState {
        decimals: state.base.decimals,
        unsupported: transfer_hook || paused || state.get_extension::<NonTransferable>().is_ok(),
        default_frozen: state
            .get_extension::<DefaultAccountState>()
            .is_ok_and(|default| default.state == AccountState::Frozen as u8),
    })
}
