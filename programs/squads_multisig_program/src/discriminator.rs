//! 8-byte Anchor discriminators: `sha256("account:<Name>")[..8]` for accounts and
//! `sha256("global:<instruction>")[..8]` for instructions.

/// Account discriminators (the first 8 bytes of each account's data).
pub mod account {
    pub const BATCH: [u8; 8] = [156, 194, 70, 44, 22, 88, 137, 44];
    pub const CONFIG_TRANSACTION: [u8; 8] = [94, 8, 4, 35, 113, 139, 139, 112];
    pub const MULTISIG: [u8; 8] = [224, 116, 121, 186, 68, 161, 79, 236];
    pub const PROGRAM_CONFIG: [u8; 8] = [196, 210, 90, 231, 144, 149, 140, 63];
    pub const PROPOSAL: [u8; 8] = [26, 94, 189, 187, 116, 136, 53, 33];
    pub const SPENDING_LIMIT: [u8; 8] = [10, 201, 27, 160, 218, 195, 222, 152];
    pub const TRANSACTION_BUFFER: [u8; 8] = [90, 36, 35, 219, 93, 225, 110, 96];
    pub const VAULT_BATCH_TRANSACTION: [u8; 8] = [196, 121, 46, 36, 12, 19, 252, 7];
    pub const VAULT_TRANSACTION: [u8; 8] = [168, 250, 162, 100, 81, 14, 162, 207];
}

/// Instruction discriminators (the first 8 bytes of each instruction's data).
pub mod instruction {
    pub const BATCH_ACCOUNTS_CLOSE: [u8; 8] = [218, 196, 7, 175, 130, 102, 11, 255];
    pub const BATCH_ADD_TRANSACTION: [u8; 8] = [89, 100, 224, 18, 69, 70, 54, 76];
    pub const BATCH_CREATE: [u8; 8] = [194, 142, 141, 17, 55, 185, 20, 248];
    pub const BATCH_EXECUTE_TRANSACTION: [u8; 8] = [172, 44, 179, 152, 21, 127, 234, 180];
    pub const CONFIG_TRANSACTION_ACCOUNTS_CLOSE: [u8; 8] = [80, 203, 84, 53, 151, 112, 187, 186];
    pub const CONFIG_TRANSACTION_CREATE: [u8; 8] = [155, 236, 87, 228, 137, 75, 81, 39];
    pub const CONFIG_TRANSACTION_EXECUTE: [u8; 8] = [114, 146, 244, 189, 252, 140, 36, 40];
    pub const MULTISIG_ADD_MEMBER: [u8; 8] = [1, 219, 215, 108, 184, 229, 214, 8];
    pub const MULTISIG_ADD_SPENDING_LIMIT: [u8; 8] = [11, 242, 159, 42, 86, 197, 89, 115];
    pub const MULTISIG_CHANGE_THRESHOLD: [u8; 8] = [141, 42, 15, 126, 169, 92, 62, 181];
    /// Deprecated: the program rejects it with `MultisigCreateDeprecated`.
    pub const MULTISIG_CREATE: [u8; 8] = [122, 77, 80, 159, 84, 88, 90, 197];
    pub const MULTISIG_CREATE_V2: [u8; 8] = [50, 221, 199, 93, 40, 245, 139, 233];
    pub const MULTISIG_REMOVE_MEMBER: [u8; 8] = [217, 117, 177, 210, 182, 145, 218, 72];
    pub const MULTISIG_REMOVE_SPENDING_LIMIT: [u8; 8] = [228, 198, 136, 111, 123, 4, 178, 113];
    pub const MULTISIG_SET_CONFIG_AUTHORITY: [u8; 8] = [143, 93, 199, 143, 92, 169, 193, 232];
    pub const MULTISIG_SET_RENT_COLLECTOR: [u8; 8] = [48, 204, 65, 57, 210, 70, 156, 74];
    pub const MULTISIG_SET_TIME_LOCK: [u8; 8] = [148, 154, 121, 77, 212, 254, 155, 72];
    pub const PROGRAM_CONFIG_INIT: [u8; 8] = [184, 188, 198, 195, 205, 124, 117, 216];
    pub const PROGRAM_CONFIG_SET_AUTHORITY: [u8; 8] = [238, 242, 36, 181, 32, 143, 216, 75];
    pub const PROGRAM_CONFIG_SET_MULTISIG_CREATION_FEE: [u8; 8] =
        [101, 160, 249, 63, 154, 215, 153, 13];
    pub const PROGRAM_CONFIG_SET_TREASURY: [u8; 8] = [111, 46, 243, 117, 144, 188, 162, 107];
    pub const PROPOSAL_ACTIVATE: [u8; 8] = [11, 34, 92, 248, 154, 27, 51, 106];
    pub const PROPOSAL_APPROVE: [u8; 8] = [144, 37, 164, 136, 188, 216, 42, 248];
    pub const PROPOSAL_CANCEL: [u8; 8] = [27, 42, 127, 237, 38, 163, 84, 203];
    pub const PROPOSAL_CANCEL_V2: [u8; 8] = [205, 41, 194, 61, 220, 139, 16, 247];
    pub const PROPOSAL_CREATE: [u8; 8] = [220, 60, 73, 224, 30, 108, 79, 159];
    pub const PROPOSAL_REJECT: [u8; 8] = [243, 62, 134, 156, 230, 106, 246, 135];
    pub const SPENDING_LIMIT_USE: [u8; 8] = [16, 57, 130, 127, 193, 20, 155, 134];
    pub const TRANSACTION_BUFFER_CLOSE: [u8; 8] = [17, 182, 208, 228, 136, 24, 178, 102];
    pub const TRANSACTION_BUFFER_CREATE: [u8; 8] = [245, 201, 113, 108, 37, 63, 29, 89];
    pub const TRANSACTION_BUFFER_EXTEND: [u8; 8] = [230, 157, 67, 56, 5, 238, 245, 146];
    pub const VAULT_BATCH_TRANSACTION_ACCOUNT_CLOSE: [u8; 8] = [134, 18, 19, 106, 129, 68, 97, 247];
    pub const VAULT_TRANSACTION_ACCOUNTS_CLOSE: [u8; 8] = [196, 71, 187, 176, 2, 35, 170, 165];
    pub const VAULT_TRANSACTION_CREATE: [u8; 8] = [48, 250, 78, 168, 208, 226, 218, 211];
    pub const VAULT_TRANSACTION_CREATE_FROM_BUFFER: [u8; 8] = [222, 54, 149, 68, 87, 246, 48, 231];
    pub const VAULT_TRANSACTION_EXECUTE: [u8; 8] = [194, 8, 161, 87, 153, 164, 25, 171];
}
