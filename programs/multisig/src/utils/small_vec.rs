use std::marker::PhantomData;

use anchor_lang::prelude::*;

/// Concise serialization schema for vectors where the length can be represented
/// by any type `L` (typically unsigned integer like `u8` or `u16`)
/// that implements AnchorDeserialize and can be converted to `u32`.
#[derive(Clone, Debug, Default)]
pub struct SmallVec<L, T>(Vec<T>, PhantomData<L>);

impl<L, T> Into<Vec<T>> for SmallVec<L, T> {
    fn into(self) -> Vec<T> {
        self.0
    }
}

impl<L, T> AnchorDeserialize for SmallVec<L, T>
where
    L: AnchorDeserialize + Into<u32>,
    T: AnchorDeserialize,
{
    /// This implementation almost exactly matches standard implementation of
    /// `Vec<T>::deserialize` except that it uses `L` instead of `u32` for the length,
    /// and doesn't include `unsafe` code.
    fn deserialize(input: &mut &[u8]) -> std::io::Result<Self> {
        let len: u32 = L::deserialize(input)?.into();

        let vec = if len == 0 {
            Vec::new()
        } else if let Some(vec_bytes) = T::vec_from_bytes(len, input)? {
            vec_bytes
        } else {
            let mut result = Vec::with_capacity(hint::cautious::<T>(len));
            for _ in 0..len {
                result.push(T::deserialize(input)?);
            }
            result
        };

        Ok(SmallVec(vec, PhantomData))
    }
}

// This is copy-pasted from borsh::de::hint;
mod hint {
    #[inline]
    pub fn cautious<T>(hint: u32) -> usize {
        let el_size = core::mem::size_of::<T>() as u32;
        core::cmp::max(core::cmp::min(hint, 4096 / el_size), 1) as usize
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_length_u8_type_u8() {
        let mut input = &[
            0x02, // len (2)
            0x05, // vec[0]
            0x09, // vec[1]
        ][..];

        let small_vec: SmallVec<u8, u8> = AnchorDeserialize::deserialize(&mut input).unwrap();

        assert_eq!(small_vec.0, vec![5, 9]);
    }

    #[test]
    fn test_length_u8_type_u32() {
        let mut input = &[
            0x02, // len (2)
            0x05, 0x00, 0x00, 0x00, // vec[0]
            0x09, 0x00, 0x00, 0x00, // vec[1]
        ][..];

        let small_vec: SmallVec<u8, u32> = AnchorDeserialize::deserialize(&mut input).unwrap();

        assert_eq!(small_vec.0, vec![5, 9]);
    }

    #[test]
    fn test_length_u8_type_pubkey() {
        let pubkey1 = Pubkey::new_unique();
        let pubkey2 = Pubkey::new_unique();
        let mut input = &[
            &[0x02], // len (2)
            &pubkey1.try_to_vec().unwrap()[..],
            &pubkey2.try_to_vec().unwrap()[..],
        ]
        .concat()[..];

        let small_vec: SmallVec<u8, Pubkey> = AnchorDeserialize::deserialize(&mut input).unwrap();

        assert_eq!(small_vec.0, vec![pubkey1, pubkey2]);
    }

    #[test]
    fn test_length_u16_type_u8() {
        let mut input = &[
            0x02, 0x00, // len (2)
            0x05, // vec[0]
            0x09, // vec[1]
        ][..];

        let small_vec: SmallVec<u16, u8> = AnchorDeserialize::deserialize(&mut input).unwrap();

        assert_eq!(small_vec.0, vec![5, 9]);
    }

    #[test]
    fn test_length_u16_type_pubkey() {
        let pubkey1 = Pubkey::new_unique();
        let pubkey2 = Pubkey::new_unique();
        let mut input = &[
            &[0x02, 0x00], // len (2)
            &pubkey1.try_to_vec().unwrap()[..],
            &pubkey2.try_to_vec().unwrap()[..],
        ]
        .concat()[..];

        let small_vec: SmallVec<u16, Pubkey> = AnchorDeserialize::deserialize(&mut input).unwrap();

        assert_eq!(small_vec.0, vec![pubkey1, pubkey2]);
    }
}
