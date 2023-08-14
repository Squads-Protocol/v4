# Squads Multisig Program V4

### Build Verification

You can use [Solana Verify CLI](https://github.com/Ellipsis-Labs/solana-verifiable-build) to verify that the program deployed at `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` matches the code in this repository. After installing the CLI, run:

```
solana-verify verify-from-repo --current-dir -um --library-name multisig --program-id SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf https://github.com/Squads-Protocol/v4
```

This may take a while as it builds the program inside Docker, then verifies that the build hash matches the deployed program hash. The verification process is much faster on a non-ARM machine.
