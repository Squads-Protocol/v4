export * from './Batch'
export * from './ConfigTransaction'
export * from './Multisig'
export * from './Proposal'
export * from './SpendingLimit'
export * from './VaultBatchTransaction'
export * from './VaultTransaction'

import { Batch } from './Batch'
import { VaultBatchTransaction } from './VaultBatchTransaction'
import { ConfigTransaction } from './ConfigTransaction'
import { Multisig } from './Multisig'
import { Proposal } from './Proposal'
import { SpendingLimit } from './SpendingLimit'
import { VaultTransaction } from './VaultTransaction'

export const accountProviders = {
  Batch,
  VaultBatchTransaction,
  ConfigTransaction,
  Multisig,
  Proposal,
  SpendingLimit,
  VaultTransaction,
}
