use anchor_lang::prelude::*;
use instructions::*;
declare_id!("HookYW72xzkWmZE8bHJEjFmxYWpamG1ym8JgW8cpgHj");

mod errors;
mod instructions;
mod state;

#[program]
pub mod squads_hooks {

    use super::*;

    pub fn sqds_hook_spending_limit_create(
        ctx: Context<InitializeSpendingLimitHook>,
        args: InitializeSpendingLimitHookArgs,
    ) -> Result<()> {
        InitializeSpendingLimitHook::handler(ctx, args)
    }

    pub fn sqds_hook_spending_limit_use(ctx: Context<SquadsHookSpendingLimitUse>) -> Result<()> {
        SquadsHookSpendingLimitUse::handler(ctx)
    }
}
