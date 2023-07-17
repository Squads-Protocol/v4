import assert from "assert";
import {
  MessageHeader,
  MessageAddressTableLookup,
  AccountKeysFromLookups,
  AddressLookupTableAccount,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";

export type CompiledKeyMeta = {
  isSigner: boolean;
  isWritable: boolean;
  isInvoked: boolean;
};

type KeyMetaMap = Map<string, CompiledKeyMeta>;

/**
 *  This is almost completely copy-pasted from solana-web3.js and slightly adapted to work with "wrapped" transaction messaged such as in VaultTransaction.
 *  @see https://github.com/solana-labs/solana-web3.js/blob/87d33ac68e2453b8a01cf8c425aa7623888434e8/packages/library-legacy/src/message/compiled-keys.ts
 */
export class CompiledKeys {
  payer: PublicKey;
  keyMetaMap: KeyMetaMap;

  constructor(payer: PublicKey, keyMetaMap: KeyMetaMap) {
    this.payer = payer;
    this.keyMetaMap = keyMetaMap;
  }

  /**
   * The only difference between this and the original is that we don't mark the instruction programIds as invoked.
   * It makes sense to do because the instructions will be called via CPI, so the programIds can come from Address Lookup Tables.
   * This allows to compress the message size and avoid hitting the tx size limit during vault_transaction_create instruction calls.
   */
  static compile(
    instructions: Array<TransactionInstruction>,
    payer: PublicKey
  ): CompiledKeys {
    const keyMetaMap: KeyMetaMap = new Map();
    const getOrInsertDefault = (pubkey: PublicKey): CompiledKeyMeta => {
      const address = pubkey.toBase58();
      let keyMeta = keyMetaMap.get(address);
      if (keyMeta === undefined) {
        keyMeta = {
          isSigner: false,
          isWritable: false,
          isInvoked: false,
        };
        keyMetaMap.set(address, keyMeta);
      }
      return keyMeta;
    };

    const payerKeyMeta = getOrInsertDefault(payer);
    payerKeyMeta.isSigner = true;
    payerKeyMeta.isWritable = true;

    for (const ix of instructions) {
      // This is the only difference from the original.
      // getOrInsertDefault(ix.programId).isInvoked = true;
      getOrInsertDefault(ix.programId).isInvoked = false;
      for (const accountMeta of ix.keys) {
        const keyMeta = getOrInsertDefault(accountMeta.pubkey);
        keyMeta.isSigner ||= accountMeta.isSigner;
        keyMeta.isWritable ||= accountMeta.isWritable;
      }
    }

    return new CompiledKeys(payer, keyMetaMap);
  }

  getMessageComponents(): [MessageHeader, Array<PublicKey>] {
    const mapEntries = [...this.keyMetaMap.entries()];
    assert(mapEntries.length <= 256, "Max static account keys length exceeded");

    const writableSigners = mapEntries.filter(
      ([, meta]) => meta.isSigner && meta.isWritable
    );
    const readonlySigners = mapEntries.filter(
      ([, meta]) => meta.isSigner && !meta.isWritable
    );
    const writableNonSigners = mapEntries.filter(
      ([, meta]) => !meta.isSigner && meta.isWritable
    );
    const readonlyNonSigners = mapEntries.filter(
      ([, meta]) => !meta.isSigner && !meta.isWritable
    );

    const header: MessageHeader = {
      numRequiredSignatures: writableSigners.length + readonlySigners.length,
      numReadonlySignedAccounts: readonlySigners.length,
      numReadonlyUnsignedAccounts: readonlyNonSigners.length,
    };

    // sanity checks
    {
      assert(
        writableSigners.length > 0,
        "Expected at least one writable signer key"
      );
      const [payerAddress] = writableSigners[0];
      assert(
        payerAddress === this.payer.toBase58(),
        "Expected first writable signer key to be the fee payer"
      );
    }

    const staticAccountKeys = [
      ...writableSigners.map(([address]) => new PublicKey(address)),
      ...readonlySigners.map(([address]) => new PublicKey(address)),
      ...writableNonSigners.map(([address]) => new PublicKey(address)),
      ...readonlyNonSigners.map(([address]) => new PublicKey(address)),
    ];

    return [header, staticAccountKeys];
  }

  extractTableLookup(
    lookupTable: AddressLookupTableAccount
  ): [MessageAddressTableLookup, AccountKeysFromLookups] | undefined {
    const [writableIndexes, drainedWritableKeys] =
      this.drainKeysFoundInLookupTable(
        lookupTable.state.addresses,
        (keyMeta) =>
          !keyMeta.isSigner && !keyMeta.isInvoked && keyMeta.isWritable
      );
    const [readonlyIndexes, drainedReadonlyKeys] =
      this.drainKeysFoundInLookupTable(
        lookupTable.state.addresses,
        (keyMeta) =>
          !keyMeta.isSigner && !keyMeta.isInvoked && !keyMeta.isWritable
      );

    // Don't extract lookup if no keys were found
    if (writableIndexes.length === 0 && readonlyIndexes.length === 0) {
      return;
    }

    return [
      {
        accountKey: lookupTable.key,
        writableIndexes,
        readonlyIndexes,
      },
      {
        writable: drainedWritableKeys,
        readonly: drainedReadonlyKeys,
      },
    ];
  }

  /** @internal */
  private drainKeysFoundInLookupTable(
    lookupTableEntries: Array<PublicKey>,
    keyMetaFilter: (keyMeta: CompiledKeyMeta) => boolean
  ): [Array<number>, Array<PublicKey>] {
    const lookupTableIndexes = new Array();
    const drainedKeys = new Array();

    for (const [address, keyMeta] of this.keyMetaMap.entries()) {
      if (keyMetaFilter(keyMeta)) {
        const key = new PublicKey(address);
        const lookupTableIndex = lookupTableEntries.findIndex((entry) =>
          entry.equals(key)
        );
        if (lookupTableIndex >= 0) {
          assert(lookupTableIndex < 256, "Max lookup table index exceeded");
          lookupTableIndexes.push(lookupTableIndex);
          drainedKeys.push(key);
          this.keyMetaMap.delete(address);
        }
      }
    }

    return [lookupTableIndexes, drainedKeys];
  }
}
