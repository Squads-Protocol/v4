use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct AddDynamicMember<'info> {
    #[account(mut)]
    pub multisig: Account<'info, DynamicMultisig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RemoveDynamicMember<'info> {
    #[account(mut)]
    pub multisig: Account<'info, DynamicMultisig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn add_member(ctx: Context<AddDynamicMember>, new_member: Member) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;
    
    // Verify the signer has permission to add members
    require!(
        multisig.member_has_permission(ctx.accounts.authority.key(), Permission::Vote),
        MultisigError::Unauthorized
    );

    // Add the new member
    multisig.add_member(new_member)?;
    
    // Validate the new state
    multisig.invariant()?;

    Ok(())
}

pub fn remove_member(ctx: Context<RemoveDynamicMember>, member_key: Pubkey) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;
    
    // Verify the signer has permission to remove members
    require!(
        multisig.member_has_permission(ctx.accounts.authority.key(), Permission::Vote),
        MultisigError::Unauthorized
    );

    // Remove the member
    multisig.remove_member(member_key)?;
    
    // Validate the new state
    multisig.invariant()?;

    Ok(())
} 