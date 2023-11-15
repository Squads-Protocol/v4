import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { readFileSync } from "fs";
import path from "path";

const { Permission, Permissions } = multisig.types;

export function getTestProgramId() {
  const programKeypair = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        readFileSync(
          path.join(
            __dirname,
            "../target/deploy/squads_multisig_program-keypair.json"
          ),
          "utf-8"
        )
      )
    )
  );

  return programKeypair.publicKey;
}

export type TestMembers = {
  almighty: Keypair;
  proposer: Keypair;
  voter: Keypair;
  executor: Keypair;
};

export async function generateMultisigMembers(
  connection: Connection
): Promise<TestMembers> {
  const members = {
    almighty: Keypair.generate(),
    proposer: Keypair.generate(),
    voter: Keypair.generate(),
    executor: Keypair.generate(),
  };

  // UNCOMMENT TO PRINT MEMBER PUBLIC KEYS
  // console.log("Members:");
  // for (const [name, keypair] of Object.entries(members)) {
  //   console.log(name, ":", keypair.publicKey.toBase58());
  // }

  // Airdrop 100 SOL to each member.
  await Promise.all(
    Object.values(members).map(async (member) => {
      const sig = await connection.requestAirdrop(
        member.publicKey,
        100 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig);
    })
  );

  return members;
}

export async function createAutonomousMultisig({
  connection,
  createKey = Keypair.generate(),
  members,
  threshold,
  timeLock,
  programId,
}: {
  createKey?: Keypair;
  members: TestMembers;
  threshold: number;
  timeLock: number;
  connection: Connection;
  programId: PublicKey;
}) {
  const creator = await generateFundedKeypair(connection);

  const [multisigPda, multisigBump] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });

  const signature = await multisig.rpc.multisigCreate({
    connection,
    creator,
    multisigPda,
    configAuthority: null,
    timeLock,
    threshold,
    members: [
      { key: members.almighty.publicKey, permissions: Permissions.all() },
      {
        key: members.proposer.publicKey,
        permissions: Permissions.fromPermissions([Permission.Initiate]),
      },
      {
        key: members.voter.publicKey,
        permissions: Permissions.fromPermissions([Permission.Vote]),
      },
      {
        key: members.executor.publicKey,
        permissions: Permissions.fromPermissions([Permission.Execute]),
      },
    ],
    createKey: createKey,
    sendOptions: { skipPreflight: true },
    programId,
  });

  await connection.confirmTransaction(signature);

  return [multisigPda, multisigBump] as const;
}

export async function createControlledMultisig({
  connection,
  createKey = Keypair.generate(),
  configAuthority,
  members,
  threshold,
  timeLock,
  programId,
}: {
  createKey?: Keypair;
  configAuthority: PublicKey;
  members: TestMembers;
  threshold: number;
  timeLock: number;
  connection: Connection;
  programId: PublicKey;
}) {
  const creator = await generateFundedKeypair(connection);

  const [multisigPda, multisigBump] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });

  const signature = await multisig.rpc.multisigCreate({
    connection,
    creator,
    multisigPda,
    configAuthority,
    timeLock,
    threshold,
    members: [
      { key: members.almighty.publicKey, permissions: Permissions.all() },
      {
        key: members.proposer.publicKey,
        permissions: Permissions.fromPermissions([Permission.Initiate]),
      },
      {
        key: members.voter.publicKey,
        permissions: Permissions.fromPermissions([Permission.Vote]),
      },
      {
        key: members.executor.publicKey,
        permissions: Permissions.fromPermissions([Permission.Execute]),
      },
    ],
    createKey: createKey,
    sendOptions: { skipPreflight: true },
    programId,
  });

  await connection.confirmTransaction(signature);

  return [multisigPda, multisigBump] as const;
}

export function createLocalhostConnection() {
  return new Connection("http://127.0.0.1:8899", "confirmed");
}

export async function generateFundedKeypair(connection: Connection) {
  const keypair = Keypair.generate();

  const tx = await connection.requestAirdrop(
    keypair.publicKey,
    1 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(tx);

  return keypair;
}

export function createTestTransferInstruction(
  authority: PublicKey,
  recipient: PublicKey,
  amount = 1000000
) {
  return SystemProgram.transfer({
    fromPubkey: authority,
    lamports: amount,
    toPubkey: recipient,
  });
}

/** Returns true if the given unix epoch is within a couple of seconds of now. */
export function isCloseToNow(
  unixEpoch: number | bigint,
  timeWindow: number = 2000
) {
  const timestamp = Number(unixEpoch) * 1000;
  return Math.abs(timestamp - Date.now()) < timeWindow;
}

/** Returns an array of numbers from min to max (inclusive) with the given step. */
export function range(min: number, max: number, step: number = 1) {
  const result = [];
  for (let i = min; i <= max; i += step) {
    result.push(i);
  }
  return result;
}
