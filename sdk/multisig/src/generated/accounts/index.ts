export * from './Batch'
export * from './ConfigTransaction'
export * from './Multisig'
export * from './Proposal'
export * from './VaultBatchTransaction'
export * from './VaultTransaction'

import { Batch } from './Batch'
import { VaultBatchTransaction } from './VaultBatchTransaction'
import { ConfigTransaction } from './ConfigTransaction'
import { Multisig } from './Multisig'
import { Proposal } from './Proposal'
import { VaultTransaction } from './VaultTransaction'

export const accountProviders = {
  Batch,
  VaultBatchTransaction,
  ConfigTransaction,
  Multisig,
  Proposal,
  VaultTransaction,
}
