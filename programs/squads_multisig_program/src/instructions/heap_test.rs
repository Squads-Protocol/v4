use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct HeapTest<'info> {
    /// CHECK: We only need to validate the address.
    pub authority: AccountInfo<'info>,
}

impl HeapTest<'_> {
    pub fn handler(_ctx: Context<HeapTest>, length: u64) -> Result<()> {
        let mut vector = Vec::<u8>::with_capacity(length as usize);
        for _ in 0..length as usize {
            vector.push(1);
        }
        // Here you can do something with the vector
        // For demonstration, we'll just log its length
        msg!("Vector allocated with length: {}", vector.len());
        Ok(())
    }
}
