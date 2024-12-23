import {
    Connection,
    Keypair,
    PublicKey
} from "@solana/web3.js";
import {
    createLocalhostConnection,
    generateFundedKeypair,
    generateMultisigMembers,
    TestMembers
} from "../../utils";
import assert from "assert";

import * as versionedMultisig from "../../../sdk/versioned_multisig";
import { ProgramConfig } from "../../../sdk/versioned_multisig/lib/accounts";
import { Permissions } from "../../../sdk/versioned_multisig/lib/types";
import { getVersionedTestProgramId } from "./versioned-utils";
import { VersionedMultisigTestHelper } from "../../helpers/versioned-multisig";

const programId = getVersionedTestProgramId();
const connection = createLocalhostConnection();
console.log(programId.toBase58())

describe("Versioned Multisig", () => {
    let members: TestMembers;
    let programConfig: ProgramConfig;
    let helper: VersionedMultisigTestHelper;
    before(async () => {
        members = await generateMultisigMembers(connection);
        const programConfigPda = versionedMultisig.getProgramConfigPda({ programId })[0];
        programConfig =
            await versionedMultisig.accounts.ProgramConfig.fromAccountAddress(
                connection,
                programConfigPda
            );
        helper = new VersionedMultisigTestHelper(connection);
    });

    describe("Creation", async () => {
        it("Creates a versioned multisig with basic configuration", async () => {
            // Create basic members with default permissions (7)
            const members = helper.generateMembers(3);
            const threshold = 2;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                members,
                threshold
            );

            // Fetch and verify the multisig account
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(connection, multisigPda);
            
            assert.equal(multisigAccount.threshold, threshold);
            assert.equal(multisigAccount.members.length, members.length);
            assert.equal(multisigAccount.transactionIndex, 0);
            assert.equal(multisigAccount.timeLock, 0);
        });
    });

    describe("Member Management", () => {
        let defaultMultisig: PublicKey;
        let defaultMembers: Keypair[];

        beforeEach(async () => {
            defaultMembers = Array(3).fill(0).map(() => Keypair.generate());
            const memberData = defaultMembers.map(m => ({
                key: m.publicKey,
                permissions: Permissions.all(),
                joinProposalIndex: 0,
            }));
            console.log(defaultMembers)
            const creator = await generateFundedKeypair(connection);
            const [multisigPda, multisigBump] = versionedMultisig.getMultisigPda({
                createKey: creator.publicKey,
                programId,
            });
            const sig = (await versionedMultisig.rpc.versionedMultisigCreate({
                connection,
                treasury: programConfig.treasury,
                createKey: creator,
                creator,
                multisigPda,
                configAuthority: null,
                threshold: 2,
                members: memberData,
                rentCollector: null,
                timeLock: 0,
                programId,
            }))[0];
            console.log(sig);
            defaultMultisig = multisigPda;
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
                { key: agents.admin.publicKey, joinProposalIndex: 0, permissions: Permissions.all() },
                { key: agents.member1.publicKey, joinProposalIndex: 0, permissions: Permissions.all() },
                { key: agents.member2.publicKey, joinProposalIndex: 0, permissions: Permissions.all() },
                { key: agents.member3.publicKey, joinProposalIndex: 0, permissions: Permissions.all() },
            ];

            const creator = await generateFundedKeypair(connection);
            const [multisigPda, multisigBump] = versionedMultisig.getMultisigPda({
                createKey: creator.publicKey,
                programId,
            });

            const sig = (await versionedMultisig.rpc.versionedMultisigCreate({
                connection,
                treasury: programConfig.treasury,
                createKey: creator,
                creator,
                multisigPda,
                configAuthority: null,
                threshold: 2,
                members,
                rentCollector: null,
                timeLock: 0,
                programId,
            }))[0];
            console.log(sig);
        });

        // ... existing tests
    });
});