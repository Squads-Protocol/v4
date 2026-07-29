import { PublicKey } from "@solana/web3.js";
import { instructions, rpc, transactions } from "../src";

type Equal<Left, Right> = (<Type>() => Type extends Left ? 1 : 2) extends <
  Type
>() => Type extends Right ? 1 : 2
  ? true
  : false;
type Expect<Type extends true> = Type;

type InstructionAmount = Parameters<
  typeof instructions.spendingLimitUse
>[0]["amount"];
type TransactionAmount = Parameters<
  typeof transactions.spendingLimitUse
>[0]["amount"];
type RpcAmount = Parameters<typeof rpc.spendingLimitUse>[0]["amount"];

type _InstructionAmount = Expect<Equal<InstructionAmount, number | bigint>>;
type _TransactionAmount = Expect<Equal<TransactionAmount, number | bigint>>;
type _RpcAmount = Expect<Equal<RpcAmount, number | bigint>>;

const key = PublicKey.default;
const amount = 18_446_744_073_709_551_615n;

instructions.spendingLimitUse({
  multisigPda: key,
  member: key,
  spendingLimit: key,
  vaultIndex: 0,
  amount,
  decimals: 0,
  destination: key,
});

transactions.spendingLimitUse({
  blockhash: key.toBase58(),
  feePayer: key,
  multisigPda: key,
  member: key,
  spendingLimit: key,
  vaultIndex: 0,
  amount,
  decimals: 0,
  destination: key,
});

const rpcAmount: RpcAmount = amount;
void rpcAmount;
