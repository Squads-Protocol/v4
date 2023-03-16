export * from './ConfigTransaction'
export * from './Multisig'
export * from './Proposal'
export * from './VaultTransaction'

import { ConfigTransaction } from './ConfigTransaction'
import { Multisig } from './Multisig'
import { Proposal } from './Proposal'
import { VaultTransaction } from './VaultTransaction'

export const accountProviders = {
  ConfigTransaction,
  Multisig,
  Proposal,
  VaultTransaction,
}
