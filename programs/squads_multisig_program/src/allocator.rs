/*
Optimizing Bump Heap Allocation

Objective: Increase available heap memory while maintaining flexibility in program invocation.

1. Initial State: Default 32 KiB Heap

Memory Layout:
0x300000000           0x300008000
      |                    |
      v                    v
      [--------------------]
      ^                    ^
      |                    |
 VM Lower              VM Upper
 Boundary              Boundary

Default Allocator (Allocates Backwards / Top Down) (Default 32 KiB):
0x300000000           0x300008000
      |                    |
      [--------------------]
                           ^
                           |
                  Allocation starts here (SAFE)

2. Naive Approach: Increase HEAP_LENGTH to 8 * 32 KiB + Default Allocator

Memory Layout with Increased HEAP_LENGTH:
0x300000000           0x300008000                          0x300040000
      |                    |                                     |
      v                    v                                     v
      [--------------------|------------------------------------|]
      ^                    ^                                     ^
      |                    |                                     |
 VM Lower              VM Upper                         Allocation starts here
 Boundary              Boundary                         (ACCESS VIOLATION!)

Issue: Access violation occurs without requestHeapFrame, requiring it for every transaction.

3. Optimized Solution: Forward Allocation with Flexible Heap Usage

Memory Layout (Same as Naive Approach):
0x300000000           0x300008000                          0x300040000
      |                    |                                     |
      v                    v                                     v
      [--------------------|------------------------------------|]
      ^                    ^                                     ^
      |                    |                                     |
 VM Lower              VM Upper                             Allocator & VM
 Boundary              Boundary                             Heap Limit

Forward Allocator Behavior:

a) Without requestHeapFrame:
0x300000000           0x300008000
      |                    |
      [--------------------]
      ^                    ^
      |                    |
 VM Lower               VM Upper
 Boundary               Boundary
 Allocation
 starts here (SAFE)

b) With requestHeapFrame:
0x300000000           0x300008000                          0x300040000
      |                    |                                     |
      [--------------------|------------------------------------|]
      ^                    ^                                     ^
      |                    |                                     |
 VM Lower                  |                                VM Upper
 Boundary                                                   Boundary
 Allocation        Allocation continues              Maximum allocation
 starts here       with requestHeapFrame             with requestHeapFrame
(SAFE)

Key Advantages:
1. Compatibility: Functions without requestHeapFrame for allocations ≤32 KiB.
2. Extensibility: Supports larger allocations when requestHeapFrame is invoked.
3. Efficiency: Eliminates mandatory requestHeapFrame calls for all transactions.

Conclusion:
The forward allocation strategy offers a robust solution, providing both backward
compatibility for smaller heap requirements and the flexibility to utilize extended
heap space when necessary.

The following allocator is a copy of the bump allocator found in
solana_program::entrypoint and
https://github.com/solana-labs/solana-program-library/blob/master/examples/rust/custom-heap/src/entrypoint.rs

but with changes to its HEAP_LENGTH and its
starting allocation address.
*/

use solana_program::entrypoint::HEAP_START_ADDRESS;
use std::{alloc::Layout, mem::size_of, ptr::null_mut};

/// Length of the memory region used for program heap.
pub const HEAP_LENGTH: usize = 8 * 32 * 1024;

struct BumpAllocator;

unsafe impl std::alloc::GlobalAlloc for BumpAllocator {
    #[inline]
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        const POS_PTR: *mut usize = HEAP_START_ADDRESS as *mut usize;
        const TOP_ADDRESS: usize = HEAP_START_ADDRESS as usize + HEAP_LENGTH;
        const BOTTOM_ADDRESS: usize = HEAP_START_ADDRESS as usize + size_of::<*mut u8>();
        let mut pos = *POS_PTR;
        if pos == 0 {
            // First time, set starting position to bottom address
            pos = BOTTOM_ADDRESS;
        }
        // Align the position upwards
        pos = (pos + layout.align() - 1) & !(layout.align() - 1);
        let next_pos = pos.saturating_add(layout.size());
        if next_pos > TOP_ADDRESS {
            return null_mut();
        }
        *POS_PTR = next_pos;
        pos as *mut u8
    }

    #[inline]
    unsafe fn dealloc(&self, _: *mut u8, _: Layout) {
        // I'm a bump allocator, I don't free
    }
}

// Only use the allocator if we're not in a no-entrypoint context
#[cfg(not(feature = "no-entrypoint"))]
#[global_allocator]
static A: BumpAllocator = BumpAllocator;
