#!/bin/bash
anchor deploy --program-name versioned_squads_multisig_program --provider.cluster https://api.devnet.solana.com --program-keypair ~/.config/solana/id.json  
anchor upgrade --program-id wgmifc3zE7BHTdjWucuTk4xwuG6FVUVEBL5DkVQ45Th --provider.cluster https://api.devnet.solana.com  ./target/deploy/versioned_squads_multisig_program.so
anchor deploy -p versioned_squads_multisig_program --provider.cluster https://api.devnet.solana.com
anchor deploy -p versioned_squads_multisig_program --provider.cluster http://127.0.0.1:8899
