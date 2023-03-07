export * from './ConfigTransaction'
export * from './Multisig'
export * from './VaultTransaction'

import { ConfigTransaction } from './ConfigTransaction'
import { Multisig } from './Multisig'
import { VaultTransaction } from './VaultTransaction'

export const accountProviders = {
  ConfigTransaction,
  Multisig,
  VaultTransaction,
}
