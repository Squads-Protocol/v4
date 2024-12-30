import {
    Connection,
    Keypair,
    PublicKey
} from "@solana/web3.js";
import {
    createLocalhostConnection,
    generateFundedKeypair,
    TestMembers
} from "../../utils";
import assert from "assert";

import * as versionedMultisig from "../../../sdk/versioned_multisig";
import { ProgramConfig } from "../../../sdk/versioned_multisig/lib/accounts";
import { Permissions, VersionedMember } from "../../../sdk/versioned_multisig/lib/types";
import { getVersionedTestProgramId } from "./versioned-utils";
import { VersionedMultisigTestHelper } from "../../helpers/versioned-multisig";

const programId = getVersionedTestProgramId();
const connection = createLocalhostConnection();

describe("Versioned Multisig Creation", () => {
    let programConfig: ProgramConfig;
    let helper: VersionedMultisigTestHelper;

    before(async () => {
        const programConfigPda = versionedMultisig.getProgramConfigPda({ programId })[0];
        programConfig = await versionedMultisig.accounts.ProgramConfig.fromAccountAddress(
            connection,
            programConfigPda
        );
        helper = new VersionedMultisigTestHelper(connection);
    });

    describe("Basic Creation", () => {
        it("Creates a versioned multisig with basic configuration", async () => {
            const members = helper.generateMembers(3);
            const threshold = 2;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                members,
                threshold
            );

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection, 
                multisigPda
            );
            
            assert.equal(multisigAccount.threshold, threshold);
            assert.equal(multisigAccount.members.length, members.length);
            assert.equal(multisigAccount.transactionIndex, 0);
            assert.equal(multisigAccount.timeLock, 0);
        });

        it("Creates a versioned multisig with maximum members", async () => {
            const maxMembers = helper.generateMembers(10); // Assuming 10 is max
            const threshold = 6;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                maxMembers,
                threshold
            );

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection, 
                multisigPda
            );
            
            assert.equal(multisigAccount.members.length, maxMembers.length);
            assert.equal(multisigAccount.threshold, threshold);
        });

        it("Creates a versioned multisig with minimum threshold", async () => {
            const members = helper.generateMembers(5);
            const threshold = 1;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                members,
                threshold
            );

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection, 
                multisigPda
            );
            
            assert.equal(multisigAccount.threshold, threshold);
        });

        it("Creates a versioned multisig with maximum threshold", async () => {
            const members = helper.generateMembers(3);
            const threshold = 3; // All members must approve
            
            const { multisigPda } = await helper.createVersionedMultisig(
                members,
                threshold
            );

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection, 
                multisigPda
            );
            
            assert.equal(multisigAccount.threshold, threshold);
        });
    });

    describe("Creation Edge Cases", () => {
        it("Fails to create with empty members", async () => {
            const members: VersionedMember[] = [];
            const threshold = 1;
            
            try {
                await helper.createVersionedMultisig(members, threshold);
                assert.fail("Should have thrown error for empty members");
            } catch (error: any) {
                console.log(error);
                assert(error.toString().includes("EmptyMembers"));
            }
        });

        it("Fails to create with duplicate members", async () => {
            const member = helper.generateMembers(1)[0];
            const members = [member, member]; // Duplicate member
            const threshold = 1;
            
            try {
                await helper.createVersionedMultisig(members, threshold);
                assert.fail("Should have thrown error for duplicate members");
            } catch (error: any) {
                console.log(error);
                assert(error.toString().includes("DuplicateMember"));
            }
        });

        it("Fails to create with threshold > member count", async () => {
            const members = helper.generateMembers(2);
            const threshold = 3; // Greater than member count
            
            try {
                await helper.createVersionedMultisig(members, threshold);
                assert.fail("Should have thrown error for invalid threshold");
            } catch (error: any) {
                assert(error.toString().includes("threshold"));
            }
        });

    });
}); 