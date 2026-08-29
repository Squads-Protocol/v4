import { PublicKey } from "@solana/web3.js";
import { TransactionBuildResult, TransactionBuilderArgs } from "./types";
import { PROGRAM_ID, Proposal } from "../../generated";
import { getProposalPda, getTransactionPda } from "../../pda";
import { BaseBuilder } from "./base";

export abstract class BaseTransactionBuilder<
  T extends TransactionBuildResult,
  U extends TransactionBuilderArgs
> extends BaseBuilder<T, U> {
  public index: number = 1;
  public vaultIndex: number = 0;

  constructor(args: U) {
    super(args);
  }

  async getIndex(): Promise<number> {
    await this.ensureBuilt();
    return this.index;
  }

  /**
   * Fetches the `PublicKey` of the corresponding account for the transaction being built.
   *
   * @returns `PublicKey`
   */
  async getTransactionKey(): Promise<PublicKey> {
    await this.ensureBuilt();
    const index = this.index;
    const [transactionPda] = getTransactionPda({
      multisigPda: this.args.multisig,
      index: BigInt(index ?? 1),
      programId: this.args.programId ?? PROGRAM_ID,
    });

    return transactionPda;
  }

  /**
   * Fetches the `PublicKey` of the corresponding {@link Proposal} account for the transaction being built.
   *
   * @returns `PublicKey`
   */
  getProposalKey(): PublicKey {
    const index = this.index;
    const [proposalPda] = getProposalPda({
      multisigPda: this.args.multisig,
      transactionIndex: BigInt(index ?? 1),
      programId: this.args.programId ?? PROGRAM_ID,
    });

    return proposalPda;
  }

  /**
   * Fetches and deserializes the {@link Proposal} account after it is built and sent.
   * @args `key` - The public key of the `Proposal` account.
   * @returns `Proposal` - Deserialized `Proposal` account data.
   */
  async getProposalAccount(key: PublicKey) {
    return this.buildPromise.then(async () => {
      const propAccount = await Proposal.fromAccountAddress(
        this.connection,
        key
      );

      return propAccount;
    });
  }
}
