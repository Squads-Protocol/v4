/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as beet from '@metaplex-foundation/beet'
import * as web3 from '@solana/web3.js'
import {
  MultisigSetTimeLockArgs,
  multisigSetTimeLockArgsBeet,
} from '../types/MultisigSetTimeLockArgs'

/**
 * @category Instructions
 * @category MultisigSetTimeLock
 * @category generated
 */
export type MultisigSetTimeLockInstructionArgs = {
  args: MultisigSetTimeLockArgs
}
/**
 * @category Instructions
 * @category MultisigSetTimeLock
 * @category generated
 */
export const multisigSetTimeLockStruct = new beet.FixableBeetArgsStruct<
  MultisigSetTimeLockInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['args', multisigSetTimeLockArgsBeet],
  ],
  'MultisigSetTimeLockInstructionArgs'
)
/**
 * Accounts required by the _multisigSetTimeLock_ instruction
 *
 * @property [_writable_] multisig
 * @property [**signer**] configAuthority
 * @property [_writable_, **signer**] rentPayer (optional)
 * @category Instructions
 * @category MultisigSetTimeLock
 * @category generated
 */
export type MultisigSetTimeLockInstructionAccounts = {
  multisig: web3.PublicKey
  configAuthority: web3.PublicKey
  rentPayer?: web3.PublicKey
  systemProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const multisigSetTimeLockInstructionDiscriminator = [
  148, 154, 121, 77, 212, 254, 155, 72,
]

/**
 * Creates a _MultisigSetTimeLock_ instruction.
 *
 * Optional accounts that are not provided default to the program ID since
 * this was indicated in the IDL from which this instruction was generated.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category MultisigSetTimeLock
 * @category generated
 */
export function createMultisigSetTimeLockInstruction(
  accounts: MultisigSetTimeLockInstructionAccounts,
  args: MultisigSetTimeLockInstructionArgs,
  programId = new web3.PublicKey('SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf')
) {
  const [data] = multisigSetTimeLockStruct.serialize({
    instructionDiscriminator: multisigSetTimeLockInstructionDiscriminator,
    ...args,
  })
  const keys: web3.AccountMeta[] = [
    {
      pubkey: accounts.multisig,
      isWritable: true,
      isSigner: false,
    },
    {
      pubkey: accounts.configAuthority,
      isWritable: false,
      isSigner: true,
    },
    {
      pubkey: accounts.rentPayer ?? programId,
      isWritable: accounts.rentPayer != null,
      isSigner: accounts.rentPayer != null,
    },
    {
      pubkey: accounts.systemProgram ?? programId,
      isWritable: false,
      isSigner: false,
    },
  ]

  if (accounts.anchorRemainingAccounts != null) {
    for (const acc of accounts.anchorRemainingAccounts) {
      keys.push(acc)
    }
  }

  const ix = new web3.TransactionInstruction({
    programId,
    keys,
    data,
  })
  return ix
}
