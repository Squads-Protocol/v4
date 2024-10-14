// The order of imports is the order the test suite will run in.
import "./suites/program-config-init"
import "./suites/account-migrations";
import "./suites/examples/batch-sol-transfer";
import "./suites/examples/create-mint";
import "./suites/examples/immediate-execution";
import "./suites/examples/spending-limits";
import "./suites/examples/transaction-buffer";
import "./suites/instructions/batchAccountsClose";
import "./suites/instructions/cancelRealloc";
import "./suites/instructions/configTransactionAccountsClose";
import "./suites/instructions/configTransactionExecute";
import "./suites/instructions/multisigCreate";
import "./suites/instructions/multisigCreateV2";
import "./suites/instructions/multisigSetRentCollector";
import "./suites/instructions/transactionBufferClose";
import "./suites/instructions/transactionBufferCreate";
import "./suites/instructions/transactionBufferExtend";
import "./suites/instructions/vaultBatchTransactionAccountClose";
import "./suites/instructions/vaultTransactionAccountsClose";
import "./suites/instructions/vaultTransactionCreateFromBuffer";
import "./suites/multisig-sdk";

// // Uncomment to enable the heapTest instruction testing
// //import "./suites/instructions/heapTest";
// import "./suites/examples/custom-heap";

