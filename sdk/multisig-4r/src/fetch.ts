import {
  assertAccountExists,
  containsBytes,
  decodeAccount,
  fetchEncodedAccount,
  type Account,
  type Address,
  type Decoder,
  type EncodedAccount,
  type ReadonlyUint8Array,
} from "@solana/kit";

import {
  BATCH_DISCRIMINATOR,
  CONFIG_TRANSACTION_DISCRIMINATOR,
  getBatchDecoder,
  getConfigTransactionDecoder,
  getMultisigDecoder,
  getProgramConfigDecoder,
  getProposalDecoder,
  getSpendingLimitDecoder,
  getTransactionBufferDecoder,
  getVaultBatchTransactionDecoder,
  getVaultTransactionDecoder,
  MULTISIG_DISCRIMINATOR,
  PROGRAM_CONFIG_DISCRIMINATOR,
  PROPOSAL_DISCRIMINATOR,
  SPENDING_LIMIT_DISCRIMINATOR,
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  TRANSACTION_BUFFER_DISCRIMINATOR,
  VAULT_BATCH_TRANSACTION_DISCRIMINATOR,
  VAULT_TRANSACTION_DISCRIMINATOR,
} from "./generated";

type Rpc = Parameters<typeof fetchEncodedAccount>[0];

/**
 * Decodes `account` after checking its owner (default: the 4r program) and discriminator.
 * The generated `decode*`/`fetch*` functions check neither.
 */
export function decodeChecked<T extends object, TAddress extends string = string>(
  account: EncodedAccount<TAddress>,
  decoder: Decoder<T>,
  discriminator: ReadonlyUint8Array,
  programAddress: Address = SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
): Account<T, TAddress> {
  if (account.programAddress !== programAddress) {
    throw new Error(`account ${account.address} is owned by ${account.programAddress}, expected ${programAddress}`);
  }
  if (!containsBytes(account.data, discriminator, 0)) {
    throw new Error(`account ${account.address} has an unexpected discriminator`);
  }
  return decodeAccount(account, decoder);
}

function checkedFetcher<T extends object>(decoder: () => Decoder<T>, discriminator: ReadonlyUint8Array) {
  return async <TAddress extends string = string>(
    rpc: Rpc,
    address: Address<TAddress>,
    config: { programAddress?: Address } = {},
  ): Promise<Account<T, TAddress>> => {
    const account = await fetchEncodedAccount(rpc, address);
    assertAccountExists(account);
    return decodeChecked(account, decoder(), discriminator, config.programAddress);
  };
}

export const fetchBatchChecked = checkedFetcher(getBatchDecoder, BATCH_DISCRIMINATOR);
export const fetchConfigTransactionChecked = checkedFetcher(getConfigTransactionDecoder, CONFIG_TRANSACTION_DISCRIMINATOR);
export const fetchMultisigChecked = checkedFetcher(getMultisigDecoder, MULTISIG_DISCRIMINATOR);
export const fetchProgramConfigChecked = checkedFetcher(getProgramConfigDecoder, PROGRAM_CONFIG_DISCRIMINATOR);
export const fetchProposalChecked = checkedFetcher(getProposalDecoder, PROPOSAL_DISCRIMINATOR);
export const fetchSpendingLimitChecked = checkedFetcher(getSpendingLimitDecoder, SPENDING_LIMIT_DISCRIMINATOR);
export const fetchTransactionBufferChecked = checkedFetcher(getTransactionBufferDecoder, TRANSACTION_BUFFER_DISCRIMINATOR);
export const fetchVaultBatchTransactionChecked = checkedFetcher(
  getVaultBatchTransactionDecoder,
  VAULT_BATCH_TRANSACTION_DISCRIMINATOR,
);
export const fetchVaultTransactionChecked = checkedFetcher(getVaultTransactionDecoder, VAULT_TRANSACTION_DISCRIMINATOR);
