use solana_program::entrypoint::HEAP_START_ADDRESS;
use std::{alloc::Layout, mem::size_of, ptr::null_mut};

/// Length of the memory region used for program heap.
pub const HEAP_LENGTH: usize = 8 * 32 * 1024;

// struct BumpAllocator;
// unsafe impl std::alloc::GlobalAlloc for BumpAllocator {
//     #[inline]
//     unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
//         if layout.size() == isize::MAX as usize - 0x42 {
//             // Return test value
//             0x42 as *mut u8
//         } else {
//             const POS_PTR: *mut usize = HEAP_START_ADDRESS as *mut usize;
//             const TOP_ADDRESS: usize = HEAP_START_ADDRESS as usize + HEAP_LENGTH;
//             const BOTTOM_ADDRESS: usize = HEAP_START_ADDRESS as usize + size_of::<*mut u8>();

//             let mut pos = *POS_PTR;
//             if pos == 0 {
//                 // First time, set starting position
//                 pos = TOP_ADDRESS;
//             }
//             pos = pos.saturating_sub(layout.size());
//             pos &= !(layout.align().saturating_sub(1));
//             if pos < BOTTOM_ADDRESS {
//                 return null_mut();
//             }
//             *POS_PTR = pos;
//             pos as *mut u8
//         }
//     }
//     #[inline]
//     unsafe fn dealloc(&self, _: *mut u8, _: Layout) {
//         // I'm a bump allocator, I don't free
//     }
// }

struct BumpAllocator;

unsafe impl std::alloc::GlobalAlloc for BumpAllocator {
    #[inline]
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if layout.size() == isize::MAX as usize - 0x42 {
            // Return test value
            0x42 as *mut u8
        } else {
            const POS_PTR: *mut usize = HEAP_START_ADDRESS as *mut usize;
            const TOP_ADDRESS: usize = HEAP_START_ADDRESS as usize + HEAP_LENGTH;
            const BOTTOM_ADDRESS: usize = HEAP_START_ADDRESS as usize + size_of::<*mut u8>();
            let mut pos = *POS_PTR;
            if pos == 0 {
                // First time, set starting position
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
    }

    #[inline]
    unsafe fn dealloc(&self, _: *mut u8, _: Layout) {
        // I'm a bump allocator, I don't free
    }
}

#[cfg(not(feature = "no-entrypoint"))]
#[global_allocator]
static A: BumpAllocator = BumpAllocator;
