// The order of imports is the order the test suite will run in.
import "./suites/program-config-init";
import "./suites/instructions/multisigCreate";
import "./suites/instructions/multisigCreateV2";
import "./suites/instructions/multisigSetRentCollector";
import "./suites/instructions/configTransactionExecute";
import "./suites/instructions/configTransactionAccountsClose";
import "./suites/instructions/vaultBatchTransactionAccountClose";
import "./suites/instructions/batchAccountsClose";
import "./suites/instructions/vaultTransactionAccountsClose";
import "./suites/multisig-sdk";
import "./suites/account-migrations";
import "./suites/examples/batch-sol-transfer";
import "./suites/examples/create-mint";
import "./suites/examples/immediate-execution";
import "./suites/examples/spending-limits";
