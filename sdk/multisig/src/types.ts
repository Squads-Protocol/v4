import * as beet from "@metaplex-foundation/beet";
import * as beetSolana from "@metaplex-foundation/beet-solana";
import { PublicKey } from "@solana/web3.js";
import invariant from "invariant";
import { Permissions as IPermissions } from "./generated";

export {
  isProposalStatusActive,
  isProposalStatusApproved,
  isProposalStatusRejected,
  isProposalStatusCancelled,
  isProposalStatusExecuted,
  Member,
  ConfigAction,
  isConfigActionAddMember,
  isConfigActionRemoveMember,
  isConfigActionChangeThreshold,
  isConfigActionAddSpendingLimit,
  isConfigActionRemoveSpendingLimit,
  isConfigActionSetTimeLock,
  ConfigActionRecord,
  Period,
} from "./generated";

export const Permission = {
  Initiate: 0b0000_0001,
  Vote: 0b0000_0010,
  Execute: 0b0000_0100,
} as const;

export type Permission = typeof Permission[keyof typeof Permission];

export class Permissions implements IPermissions {
  private constructor(readonly mask: number) {}

  static fromPermissions(permissions: Permission[]) {
    return new Permissions(
      permissions.reduce((mask, permission) => mask | permission, 0)
    );
  }

  static all() {
    return new Permissions(
      Object.values(Permission).reduce(
        (mask, permission) => mask | permission,
        0
      )
    );
  }

  static has(permissions: IPermissions, permission: Permission) {
    return (permissions.mask & permission) === permission;
  }
}

/**
 * De/Serializes a small array with configurable length prefix and a specific number of elements of type {@link T}
 * which do not all have the same size.
 *
 * @template T type of elements held in the array
 *
 * @param lengthBeet the De/Serializer for the array length prefix
 * @param elements the De/Serializers for the element types
 * @param elementsByteSize size of all elements in the array combined
 *
 * The implementation is minor modification of `fixedSizeArray` where the length is encoded as `lengthBeet.byteSize` bytes:
 * https://github.dev/metaplex-foundation/beet/blob/e053b7b5b0c46ce7f6906ecd38be9fd85d6e5254/beet/src/beets/collections.ts#L84
 */
export function fixedSizeSmallArray<T, V = Partial<T>>(
  lengthBeet: beet.FixedSizeBeet<number>,
  elements: beet.FixedSizeBeet<T, V>[],
  elementsByteSize: number
): beet.FixedSizeBeet<T[], V[]> {
  const len = elements.length;
  const firstElement = len === 0 ? "<EMPTY>" : elements[0].description;

  return {
    write: function (buf: Buffer, offset: number, value: V[]): void {
      invariant(
        value.length === len,
        `array length ${value.length} should match len ${len}`
      );
      lengthBeet.write(buf, offset, len);

      let cursor = offset + lengthBeet.byteSize;
      for (let i = 0; i < len; i++) {
        const element = elements[i];
        element.write(buf, cursor, value[i]);
        cursor += element.byteSize;
      }
    },

    read: function (buf: Buffer, offset: number): T[] {
      const size = lengthBeet.read(buf, offset);
      invariant(size === len, "invalid byte size");

      let cursor = offset + lengthBeet.byteSize;
      const arr: T[] = new Array(len);
      for (let i = 0; i < len; i++) {
        const element = elements[i];
        arr[i] = element.read(buf, cursor);
        cursor += element.byteSize;
      }
      return arr;
    },
    byteSize: lengthBeet.byteSize + elementsByteSize,
    length: len,
    description: `Array<${firstElement}>(${len})[ ${lengthBeet.byteSize} + ${elementsByteSize} ]`,
  };
}

/**
 * Wraps a small array De/Serializer with configurable length prefix and elements of type {@link T}
 * which do not all have the same size.
 *
 * @template T type of elements held in the array
 *
 * @param lengthBeet the De/Serializer for the array length prefix
 * @param element the De/Serializer for the element types
 *
 * The implementation is minor modification of `array` where the length is encoded as `lengthBeet.byteSize` bytes:
 * https://github.dev/metaplex-foundation/beet/blob/e053b7b5b0c46ce7f6906ecd38be9fd85d6e5254/beet/src/beets/collections.ts#L137
 */
export function smallArray<T, V = Partial<T>>(
  lengthBeet: beet.FixedSizeBeet<number>,
  element: beet.Beet<T, V>
): beet.FixableBeet<T[], V[]> {
  return {
    toFixedFromData(buf: Buffer, offset: number): beet.FixedSizeBeet<T[], V[]> {
      const len = lengthBeet.read(buf, offset);
      const cursorStart = offset + lengthBeet.byteSize;
      let cursor = cursorStart;

      const fixedElements: beet.FixedSizeBeet<T, V>[] = new Array(len);
      for (let i = 0; i < len; i++) {
        const fixedElement = beet.fixBeetFromData(
          element,
          buf,
          cursor
        ) as beet.FixedSizeBeet<T, V>;
        fixedElements[i] = fixedElement;
        cursor += fixedElement.byteSize;
      }
      return fixedSizeSmallArray(
        lengthBeet,
        fixedElements,
        cursor - cursorStart
      );
    },

    toFixedFromValue(vals: V[]): beet.FixedSizeBeet<T[], V[]> {
      invariant(Array.isArray(vals), `${vals} should be an array`);

      let elementsSize = 0;
      const fixedElements: beet.FixedSizeBeet<T, V>[] = new Array(vals.length);

      for (let i = 0; i < vals.length; i++) {
        const fixedElement: beet.FixedSizeBeet<T, V> = beet.fixBeetFromValue<
          T,
          V
        >(element, vals[i]);
        fixedElements[i] = fixedElement;
        elementsSize += fixedElement.byteSize;
      }
      return fixedSizeSmallArray(lengthBeet, fixedElements, elementsSize);
    },

    description: `smallArray`,
  };
}

export type CompiledMsInstruction = {
  programIdIndex: number;
  accountIndexes: number[];
  data: number[];
};

export const compiledMsInstructionBeet =
  new beet.FixableBeetArgsStruct<CompiledMsInstruction>(
    [
      ["programIdIndex", beet.u8],
      ["accountIndexes", smallArray(beet.u8, beet.u8)],
      ["data", smallArray(beet.u16, beet.u8)],
    ],
    "CompiledMsInstruction"
  );

export type MessageAddressTableLookup = {
  /** Address lookup table account key */
  accountKey: PublicKey;
  /** List of indexes used to load writable account addresses */
  writableIndexes: number[];
  /** List of indexes used to load readonly account addresses */
  readonlyIndexes: number[];
};

export const messageAddressTableLookupBeet =
  new beet.FixableBeetArgsStruct<MessageAddressTableLookup>(
    [
      ["accountKey", beetSolana.publicKey],
      ["writableIndexes", smallArray(beet.u8, beet.u8)],
      ["readonlyIndexes", smallArray(beet.u8, beet.u8)],
    ],
    "MessageAddressTableLookup"
  );

export type TransactionMessage = {
  numSigners: number;
  numWritableSigners: number;
  numWritableNonSigners: number;
  accountKeys: PublicKey[];
  instructions: CompiledMsInstruction[];
  addressTableLookups: MessageAddressTableLookup[];
};

export const transactionMessageBeet =
  new beet.FixableBeetArgsStruct<TransactionMessage>(
    [
      ["numSigners", beet.u8],
      ["numWritableSigners", beet.u8],
      ["numWritableNonSigners", beet.u8],
      ["accountKeys", smallArray(beet.u8, beetSolana.publicKey)],
      ["instructions", smallArray(beet.u8, compiledMsInstructionBeet)],
      [
        "addressTableLookups",
        smallArray(beet.u8, messageAddressTableLookupBeet),
      ],
    ],
    "TransactionMessage"
  );
