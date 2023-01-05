/**
 * This code was GENERATED using the solita package.
 * Please DO NOT EDIT THIS FILE, instead rerun solita to update it or write a wrapper to add functionality.
 *
 * See: https://github.com/metaplex-foundation/solita
 */

import * as beet from '@metaplex-foundation/beet'
import * as web3 from '@solana/web3.js'
import { AddMemberArgs, addMemberArgsBeet } from '../types/AddMemberArgs'

/**
 * @category Instructions
 * @category AddMember
 * @category generated
 */
export type AddMemberInstructionArgs = {
  args: AddMemberArgs
}
/**
 * @category Instructions
 * @category AddMember
 * @category generated
 */
export const addMemberStruct = new beet.FixableBeetArgsStruct<
  AddMemberInstructionArgs & {
    instructionDiscriminator: number[] /* size: 8 */
  }
>(
  [
    ['instructionDiscriminator', beet.uniformFixedSizeArray(beet.u8, 8)],
    ['args', addMemberArgsBeet],
  ],
  'AddMemberInstructionArgs'
)
/**
 * Accounts required by the _addMember_ instruction
 *
 * @property [_writable_] multisig
 * @property [_writable_, **signer**] configAuthority
 * @category Instructions
 * @category AddMember
 * @category generated
 */
export type AddMemberInstructionAccounts = {
  multisig: web3.PublicKey
  configAuthority: web3.PublicKey
  systemProgram?: web3.PublicKey
  anchorRemainingAccounts?: web3.AccountMeta[]
}

export const addMemberInstructionDiscriminator = [
  13, 116, 123, 130, 126, 198, 57, 34,
]

/**
 * Creates a _AddMember_ instruction.
 *
 * @param accounts that will be accessed while the instruction is processed
 * @param args to provide as instruction data to the program
 *
 * @category Instructions
 * @category AddMember
 * @category generated
 */
export function createAddMemberInstruction(
  accounts: AddMemberInstructionAccounts,
  args: AddMemberInstructionArgs,
  programId = new web3.PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS')
) {
  const [data] = addMemberStruct.serialize({
    instructionDiscriminator: addMemberInstructionDiscriminator,
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
      isWritable: true,
      isSigner: true,
    },
    {
      pubkey: accounts.systemProgram ?? web3.SystemProgram.programId,
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
