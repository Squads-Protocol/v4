use std::io::{Read, Write};
use std::marker::PhantomData;

use anchor_lang::prelude::*;

/// Concise serialization schema for vectors where the length can be represented
/// by any type `L` (typically unsigned integer like `u8` or `u16`)
/// that implements AnchorDeserialize and can be converted to `u32`.
#[derive(Clone, Debug, Default)]
pub struct SmallVec<L, T>(Vec<T>, PhantomData<L>);

impl<L, T> SmallVec<L, T> {
    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl<L, T> From<SmallVec<L, T>> for Vec<T> {
    fn from(val: SmallVec<L, T>) -> Self {
        val.0
    }
}

impl<L, T> From<Vec<T>> for SmallVec<L, T> {
    fn from(val: Vec<T>) -> Self {
        Self(val, PhantomData)
    }
}

impl<T: AnchorSerialize> AnchorSerialize for SmallVec<u8, T> {
    fn serialize<W: Write>(&self, writer: &mut W) -> std::io::Result<()> {
        let len = u8::try_from(self.len()).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        // Write the length of the vector as u8.
        writer.write_all(&len.to_le_bytes())?;

        // Write the vector elements.
        serialize_slice(&self.0, writer)
    }
}

impl<T: AnchorSerialize> AnchorSerialize for SmallVec<u16, T> {
    fn serialize<W: Write>(&self, writer: &mut W) -> std::io::Result<()> {
        let len = u16::try_from(self.len()).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        // Write the length of the vector as u16.
        writer.write_all(&len.to_le_bytes())?;

        // Write the vector elements.
        serialize_slice(&self.0, writer)
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
    fn deserialize_reader<R: Read>(reader: &mut R) -> std::io::Result<Self> {
        let len: u32 = L::deserialize_reader(reader)?.into();

        let vec = if len == 0 {
            Vec::new()
        } else if let Some(vec_bytes) = T::vec_from_reader(len, reader)? {
            vec_bytes
        } else {
            let mut result = Vec::with_capacity(hint::cautious::<T>(len));
            for _ in 0..len {
                result.push(T::deserialize_reader(reader)?);
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

/// Helper method that is used to serialize a slice of data (without the length marker).
/// Copied from borsh::ser::serialize_slice.
#[inline]
fn serialize_slice<T: AnchorSerialize, W: Write>(
    data: &[T],
    writer: &mut W,
) -> std::io::Result<()> {
    if let Some(u8_slice) = T::u8_slice(data) {
        writer.write_all(u8_slice)?;
    } else {
        for item in data {
            item.serialize(writer)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod test {
    use super::*;

    mod deserialize {
        use super::*;

        #[test]
        fn test_length_u8_type_u8() {
            let mut input = &[
                0x02, // len (2)
                0x05, // vec[0]
                0x09, // vec[1]
            ][..];

            let small_vec: SmallVec<u8, u8> = SmallVec::deserialize(&mut input).unwrap();

            assert_eq!(small_vec.0, vec![5, 9]);
        }

        #[test]
        fn test_length_u8_type_u32() {
            let mut input = &[
                0x02, // len (2)
                0x05, 0x00, 0x00, 0x00, // vec[0]
                0x09, 0x00, 0x00, 0x00, // vec[1]
            ][..];

            let small_vec: SmallVec<u8, u32> = SmallVec::deserialize(&mut input).unwrap();

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

            let small_vec: SmallVec<u8, Pubkey> = SmallVec::deserialize(&mut input).unwrap();

            assert_eq!(small_vec.0, vec![pubkey1, pubkey2]);
        }

        #[test]
        fn test_length_u16_type_u8() {
            let mut input = &[
                0x02, 0x00, // len (2)
                0x05, // vec[0]
                0x09, // vec[1]
            ][..];

            let small_vec: SmallVec<u16, u8> = SmallVec::deserialize(&mut input).unwrap();

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

            let small_vec: SmallVec<u16, Pubkey> = SmallVec::deserialize(&mut input).unwrap();

            assert_eq!(small_vec.0, vec![pubkey1, pubkey2]);
        }
    }

    mod serialize {
        use super::*;

        #[test]
        fn test_length_u8_type_u8() {
            let small_vec = SmallVec::<u8, u8>::from(vec![3, 5]);

            let mut output = vec![];
            small_vec.serialize(&mut output).unwrap();

            assert_eq!(
                output,
                vec![
                    0x02, // len (2)
                    0x03, // vec[0]
                    0x05, // vec[1]
                ]
            );
        }

        #[test]
        fn test_length_u8_type_u32() {
            let small_vec = SmallVec::<u8, u32>::from(vec![3, 5]);

            let mut output = vec![];
            small_vec.serialize(&mut output).unwrap();

            assert_eq!(
                output,
                vec![
                    0x02, // len (2)
                    0x03, 0x00, 0x00, 0x00, // vec[0]
                    0x05, 0x00, 0x00, 0x00, // vec[1]
                ]
            );
        }

        #[test]
        fn test_length_u8_type_pubkey() {
            let pubkey1 = Pubkey::new_unique();
            let pubkey2 = Pubkey::new_unique();
            let small_vec = SmallVec::<u8, Pubkey>::from(vec![pubkey1, pubkey2]);

            let mut output = vec![];
            small_vec.serialize(&mut output).unwrap();

            assert_eq!(
                output,
                [
                    &[0x02], // len (2)
                    &pubkey1.to_bytes()[..],
                    &pubkey2.to_bytes()[..],
                ]
                .concat()[..]
            );
        }

        #[test]
        fn test_length_u16_type_u8() {
            let small_vec = SmallVec::<u16, u8>::from(vec![3, 5]);

            let mut output = vec![];
            small_vec.serialize(&mut output).unwrap();

            assert_eq!(
                output,
                vec![
                    0x02, 0x00, // len (2)
                    0x03, // vec[0]
                    0x05, // vec[1]
                ]
            );
        }

        #[test]
        fn test_length_u16_type_pubkey() {
            let pubkey1 = Pubkey::new_unique();
            let pubkey2 = Pubkey::new_unique();
            let small_vec = SmallVec::<u16, Pubkey>::from(vec![pubkey1, pubkey2]);

            let mut output = vec![];
            small_vec.serialize(&mut output).unwrap();

            assert_eq!(
                output,
                [
                    &[0x02, 0x00], // len (2)
                    &pubkey1.to_bytes()[..],
                    &pubkey2.to_bytes()[..],
                ]
                .concat()[..]
            );
        }
    }
}
