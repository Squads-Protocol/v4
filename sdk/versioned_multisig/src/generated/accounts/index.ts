export * from './ConfigTransaction'
export * from './ProgramConfig'
export * from './Proposal'
export * from './TransactionBuffer'
export * from './VaultTransaction'
export * from './VersionedMultisig'

import { ConfigTransaction } from './ConfigTransaction'
import { ProgramConfig } from './ProgramConfig'
import { Proposal } from './Proposal'
import { TransactionBuffer } from './TransactionBuffer'
import { VaultTransaction } from './VaultTransaction'
import { VersionedMultisig } from './VersionedMultisig'

export const accountProviders = {
  ConfigTransaction,
  ProgramConfig,
  Proposal,
  TransactionBuffer,
  VaultTransaction,
  VersionedMultisig,
}
