use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod multisig {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}


#[account]
pub struct Ms {
    pub threshold: u16,                 // threshold for signatures
    pub authority_index: u16,           // index to seed other authorities under this multisig
    pub transaction_index: u32,         // look up and seed reference for transactions
    pub ms_change_index: u32,           // the last executed/closed transaction
    pub bump: u8,                       // bump for the multisig seed
    pub create_key: Pubkey,             // random key(or not) used to seed the multisig pda
    pub allow_external_execute: bool,   // allow non-member keys to execute txs
    pub keys: Vec<Member>,              // keys of the members
    pub config_authority: Pubkey               // the external multisig authority
}

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct Member {
    pub key: Pubkey,
    pub role: Role,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum Role {
    All,
    Initiate,
    Vote,
    Execute,
    InitiateAndExecute,
    InitiateAndVote,
    VoteAndExecute,
}

impl Role {
    pub const MAXIMUM_SIZE: usize = 1 + 18;
}

#[derive(Accounts)]
pub struct MsAuth<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ], bump = multisig.bump,
        constraint = multisig.external_authority == external_authority.key() @GraphsError::InvalidExternalAuthority
    )]
    multisig: Box<Account<'info, Ms>>,
    #[account(mut)]
    pub external_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct MsAuthRealloc<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ], bump = multisig.bump,
        constraint = multisig.external_authority == external_authority.key() @GraphsError::InvalidExternalAuthority
    )]
    multisig: Box<Account<'info, Ms>>,
    #[account(mut)]
    pub external_authority: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(external_authority: Pubkey, threshold: u16, create_key: Pubkey, members: Vec<Pubkey>)]
pub struct Create<'info> {
    #[account(
        init,
        payer = creator,
        space = Ms::SIZE_WITHOUT_MEMBERS + (members.len() * 32),
        seeds = [b"squad", create_key.as_ref(), b"multisig"], bump
    )]
    pub multisig: Account<'info, Ms>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(config_authority: Pubkey, threshold: u16, create_key: Pubkey, members: Vec<Pubkey>)]
pub struct Create<'info> {
    #[account(
        init,
        payer = creator,
        space = Ms::SIZE_WITHOUT_MEMBERS + (members.len() * 32),
        seeds = [b"squad", create_key.as_ref(), b"multisig"], bump
    )]
    pub multisig: Account<'info, Ms>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

/*
    THIS WOULD BE A VALIDATION FUNCTIOn
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &user.role_index.to_le_bytes(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Initiate || user.role == Role::InitiateAndExecute || user.role == Role::InitiateAndVote @RolesError::InvalidRole
    )]
    pub user: Account<'info, Member>,
*/