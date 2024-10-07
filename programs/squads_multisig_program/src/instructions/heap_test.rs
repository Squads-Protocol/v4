use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct HeapTest<'info> {
    /// CHECK: We only need to validate the address.
    pub authority: AccountInfo<'info>,
}

impl HeapTest<'_> {
    pub fn handler(_ctx: Context<HeapTest>, length: u64) -> Result<()> {
        // Allocate the vector with the desired capacity
        let mut vector = Vec::<u8>::with_capacity(length as usize);

        // Unsafe block to set the length of the vector without initialization
        unsafe {
            vector.set_len(length as usize);
        }

        // If you need to set all elements to a specific value (e.g., 1),
        // you can use `fill` method which is more efficient than iteration
        vector.fill(1);

        // Log the vector's length
        msg!("Vector allocated with length: {}", vector.len());

        Ok(())
    }
}
