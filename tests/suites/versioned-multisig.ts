import * as multisig from "@sqds/multisig";
import {
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { 
  createLocalhostConnection,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers 
} from "../utils";

import * as versionedMultisig from "@sqds/versioned-multisig";

const { toBigInt } = multisig.utils;
const { Multisig, VaultTransaction, ConfigTransaction, Proposal } = multisig.accounts;
const { Permission, Permissions } = multisig.types;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Versioned Multisig", () => {
    let members: TestMembers;

    before(async () => {
        members = await generateMultisigMembers(connection);
    });

    describe("Creation", () => {
        // ... existing tests
    });

    describe("Member Management", () => {
        let defaultMultisig: PublicKey;
        let defaultMembers: Keypair[];
        
        beforeEach(async () => {
            defaultMembers = Array(3).fill(0).map(() => Keypair.generate());
            const memberData = defaultMembers.map(m => ({
                key: m.publicKey,
                permissions: Permissions.all()
            }));
            
            defaultMultisig = (await multisig.rpc.versionedMultisigCreate({
                connection,
                createKey: Keypair.generate(),
                configAuthority: null,
                threshold: 2,
                members: memberData,
                timeLock: 0,
                programId,
            }))[0];
        });

        // ... existing tests
    });

    describe("State Consistency", () => {
        let defaultMultisig: PublicKey;
        let agents: {
            admin: Keypair;
            member1: Keypair;
            member2: Keypair;
            member3: Keypair;
        };
        
        beforeEach(async () => {
            agents = {
                admin: await generateFundedKeypair(connection),
                member1: await generateFundedKeypair(connection),
                member2: await generateFundedKeypair(connection),
                member3: await generateFundedKeypair(connection),
            };

            const members = [
                { key: agents.admin.publicKey, permissions: Permissions.all() },
                { key: agents.member1.publicKey, permissions: Permissions.all() },
                { key: agents.member2.publicKey, permissions: Permissions.all() },
                { key: agents.member3.publicKey, permissions: Permissions.all() },
            ];

            defaultMultisig = (await multisig.rpc.multisigCreate({
                connection,
                createKey: Keypair.generate(),
                configAuthority: null,
                threshold: 3,
                members,
                timeLock: 0,
                programId,
            }))[0];
        });

        // ... existing tests
    });
});