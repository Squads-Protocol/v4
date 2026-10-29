//! Human-readable decoding of the inner instructions of a vault transaction,
//! so approvers can check what a proposal does without a UI.

use std::collections::HashMap;

use solana_sdk::pubkey::Pubkey;
use solana_vote_interface::instruction::VoteInstruction;
use solana_vote_interface::state::VoteAuthorize;
use squads_multisig::pda::get_vault_pda;

use crate::command::vault_proposal::format_sol;

pub struct DecodedInstruction {
    pub name: String,
    /// `(label, value)` rows; vault pubkeys are labelled with their vault index.
    pub fields: Vec<(String, String)>,
    /// Changes that move control or revenue out of the multisig.
    pub warnings: Vec<String>,
}

/// The vault PDAs of a multisig, to recognise them among instruction accounts.
pub struct MultisigVaults(HashMap<Pubkey, u8>);

impl MultisigVaults {
    pub fn new(multisig: &Pubkey, program_id: &Pubkey) -> Self {
        Self(
            (0..=u8::MAX)
                .map(|i| (get_vault_pda(multisig, i, Some(program_id)).0, i))
                .collect(),
        )
    }

    pub fn index_of(&self, key: &Pubkey) -> Option<u8> {
        self.0.get(key).copied()
    }

    /// `key`, annotated when it is one of the multisig's vaults.
    pub fn label(&self, key: &Pubkey) -> String {
        match self.index_of(key) {
            Some(index) => format!("{} (vault {})", key, index),
            None => key.to_string(),
        }
    }
}

pub fn decode_instruction(
    program_id: &Pubkey,
    data: &[u8],
    accounts: &[Pubkey],
    vaults: &MultisigVaults,
) -> Option<DecodedInstruction> {
    if *program_id == solana_vote_interface::program::id() {
        return decode_vote(data, accounts, vaults);
    }
    None
}

fn decode_vote(
    data: &[u8],
    accounts: &[Pubkey],
    vaults: &MultisigVaults,
) -> Option<DecodedInstruction> {
    let account = |i: usize| accounts.get(i).map(|k| vaults.label(k)).unwrap_or_default();
    let mut warnings = vec![];

    // UpdateCommissionCollector (SIMD-0232) is not in solana-vote-interface 2.x.
    if data.len() == 8 && data[..4] == [17, 0, 0, 0] && data[5..] == [0, 0, 0] {
        let kind = match data[4] {
            0 => "inflation rewards",
            1 => "block revenue",
            _ => return None,
        };
        let (vote, collector) = (accounts.first()?, accounts.get(1)?);
        if collector != vote && vaults.index_of(collector).is_none() {
            warnings.push(format!(
                "Pays {} commission to {}, which is neither the vote account nor a vault of this multisig",
                kind, collector
            ));
        }
        return Some(DecodedInstruction {
            name: "Vote: UpdateCommissionCollector".to_string(),
            fields: vec![
                ("Vote Account".to_string(), account(0)),
                ("Commission Kind".to_string(), kind.to_string()),
                ("New Collector".to_string(), account(1)),
                ("Withdraw Authority".to_string(), account(2)),
            ],
            warnings,
        });
    }

    let Ok(instruction) = bincode::deserialize::<VoteInstruction>(data) else {
        // e.g. instructions added after solana-vote-interface 2.x, such as a BLS voter change.
        return Some(DecodedInstruction {
            name: "Vote: unrecognised instruction".to_string(),
            fields: vec![],
            warnings: vec![
                "This vote program instruction could not be decoded; verify its data another way before approving"
                    .to_string(),
            ],
        });
    };
    let mut authority_change = |kind: &VoteAuthorize, new_authority: Option<&Pubkey>| {
        let role = match kind {
            VoteAuthorize::Voter => "Voter",
            VoteAuthorize::Withdrawer => "Withdrawer",
        };
        if let (VoteAuthorize::Withdrawer, Some(new_authority)) = (kind, new_authority) {
            if vaults.index_of(new_authority).is_none() {
                warnings.push(format!(
                    "Moves the vote account's withdraw authority to {}, which is not a vault of this multisig",
                    new_authority
                ));
            }
        }
        role.to_string()
    };

    let (name, fields) = match &instruction {
        VoteInstruction::Withdraw(lamports) => (
            "Withdraw",
            vec![
                ("Vote Account", account(0)),
                ("Recipient", account(1)),
                ("Amount", format_sol(*lamports)),
                ("Withdraw Authority", account(2)),
            ],
        ),
        VoteInstruction::UpdateCommission(commission) => (
            "UpdateCommission",
            vec![
                ("Vote Account", account(0)),
                ("New Commission", format!("{}%", commission)),
                ("Withdraw Authority", account(1)),
            ],
        ),
        VoteInstruction::UpdateValidatorIdentity => (
            "UpdateValidatorIdentity",
            vec![
                ("Vote Account", account(0)),
                ("New Identity", account(1)),
                ("Withdraw Authority", account(2)),
            ],
        ),
        VoteInstruction::Authorize(new_authority, kind) => {
            let role = authority_change(kind, Some(new_authority));
            (
                "Authorize",
                vec![
                    ("Vote Account", account(0)),
                    ("Authority Type", role),
                    ("New Authority", vaults.label(new_authority)),
                    ("Current Authority", account(2)),
                ],
            )
        }
        VoteInstruction::AuthorizeChecked(kind) => {
            let role = authority_change(kind, accounts.get(3));
            (
                "AuthorizeChecked",
                vec![
                    ("Vote Account", account(0)),
                    ("Authority Type", role),
                    ("New Authority", account(3)),
                    ("Current Authority", account(2)),
                ],
            )
        }
        other => {
            // Variants without a dedicated rendering: show the name only.
            let debug = format!("{:?}", other);
            let name = debug
                .split(|c: char| !c.is_alphanumeric())
                .next()
                .unwrap_or_default()
                .to_string();
            return Some(DecodedInstruction {
                name: format!("Vote: {}", name),
                fields: vec![],
                warnings,
            });
        }
    };

    Some(DecodedInstruction {
        name: format!("Vote: {}", name),
        fields: fields
            .into_iter()
            .map(|(label, value)| (label.to_string(), value))
            .collect(),
        warnings,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::command::vote::{update_commission_collector, CommissionKind};
    use solana_sdk::instruction::Instruction;
    use solana_vote_interface::instruction as vote_instruction;

    /// A multisig's vaults, plus its vault 0 and vault 1 addresses.
    fn vaults() -> (MultisigVaults, Pubkey, Pubkey) {
        let multisig = Pubkey::new_unique();
        let program_id = Pubkey::new_unique();
        let vaults = MultisigVaults::new(&multisig, &program_id);
        let vault_0 = get_vault_pda(&multisig, 0, Some(&program_id)).0;
        let vault_1 = get_vault_pda(&multisig, 1, Some(&program_id)).0;
        (vaults, vault_0, vault_1)
    }

    fn decode(ix: &Instruction, vaults: &MultisigVaults) -> DecodedInstruction {
        let accounts: Vec<Pubkey> = ix.accounts.iter().map(|m| m.pubkey).collect();
        decode_instruction(&ix.program_id, &ix.data, &accounts, vaults).unwrap()
    }

    fn field<'a>(decoded: &'a DecodedInstruction, label: &str) -> &'a str {
        &decoded.fields.iter().find(|(l, _)| l == label).unwrap().1
    }

    #[test]
    fn multisig_vaults_recognises_vaults_only() {
        let (vaults, vault_0, vault_1) = vaults();
        assert_eq!(vaults.index_of(&vault_0), Some(0));
        assert_eq!(vaults.index_of(&vault_1), Some(1));
        assert_eq!(vaults.index_of(&Pubkey::new_unique()), None);
        assert_eq!(vaults.label(&vault_1), format!("{} (vault 1)", vault_1));
    }

    #[test]
    fn decodes_withdraw_with_vault_labels() {
        let (vaults, vault, _) = vaults();
        let vote = Pubkey::new_unique();
        let recipient = Pubkey::new_unique();
        let ix = vote_instruction::withdraw(&vote, &vault, 1_500_000_000, &recipient);

        let decoded = decode(&ix, &vaults);
        assert_eq!(decoded.name, "Vote: Withdraw");
        assert_eq!(field(&decoded, "Amount"), "1.5 SOL");
        assert_eq!(field(&decoded, "Recipient"), recipient.to_string());
        assert_eq!(
            field(&decoded, "Withdraw Authority"),
            format!("{} (vault 0)", vault)
        );
        assert!(decoded.warnings.is_empty());
    }

    #[test]
    fn flags_withdrawer_moving_out_of_the_multisig() {
        let (vaults, vault, other_vault) = vaults();
        let vote = Pubkey::new_unique();

        let outside = Pubkey::new_unique();
        let ix = vote_instruction::authorize(&vote, &vault, &outside, VoteAuthorize::Withdrawer);
        let decoded = decode(&ix, &vaults);
        assert_eq!(field(&decoded, "Authority Type"), "Withdrawer");
        assert_eq!(decoded.warnings.len(), 1);

        let ix =
            vote_instruction::authorize_checked(&vote, &vault, &outside, VoteAuthorize::Withdrawer);
        assert_eq!(decode(&ix, &vaults).warnings.len(), 1);

        // To another vault of the same multisig, or a voter change: no warning.
        let ix =
            vote_instruction::authorize(&vote, &vault, &other_vault, VoteAuthorize::Withdrawer);
        assert!(decode(&ix, &vaults).warnings.is_empty());
        let ix = vote_instruction::authorize(&vote, &vault, &outside, VoteAuthorize::Voter);
        assert!(decode(&ix, &vaults).warnings.is_empty());
    }

    #[test]
    fn decodes_commission_identity_and_collector() {
        let (vaults, vault, _) = vaults();
        let vote = Pubkey::new_unique();

        let decoded = decode(
            &vote_instruction::update_commission(&vote, &vault, 7),
            &vaults,
        );
        assert_eq!(field(&decoded, "New Commission"), "7%");

        let identity = Pubkey::new_unique();
        let decoded = decode(
            &vote_instruction::update_validator_identity(&vote, &vault, &identity),
            &vaults,
        );
        assert_eq!(field(&decoded, "New Identity"), identity.to_string());

        let decoded = decode(
            &update_commission_collector(&vote, &vault, &vote, CommissionKind::BlockRevenue),
            &vaults,
        );
        assert_eq!(decoded.name, "Vote: UpdateCommissionCollector");
        assert_eq!(field(&decoded, "Commission Kind"), "block revenue");
        assert!(decoded.warnings.is_empty());

        let outside = Pubkey::new_unique();
        let decoded = decode(
            &update_commission_collector(&vote, &vault, &outside, CommissionKind::InflationRewards),
            &vaults,
        );
        assert_eq!(decoded.warnings.len(), 1);
    }

    #[test]
    fn flags_vote_instructions_it_cannot_decode() {
        let accounts = vec![Pubkey::new_unique()];
        let decoded = decode_instruction(
            &solana_vote_interface::program::id(),
            &[99, 0, 0, 0],
            &accounts,
            &vaults().0,
        )
        .unwrap();
        assert_eq!(decoded.name, "Vote: unrecognised instruction");
        assert_eq!(decoded.warnings.len(), 1);
    }

    #[test]
    fn ignores_other_programs() {
        let ix = solana_sdk::system_instruction::transfer(
            &Pubkey::new_unique(),
            &Pubkey::new_unique(),
            1,
        );
        let accounts: Vec<Pubkey> = ix.accounts.iter().map(|m| m.pubkey).collect();
        assert!(decode_instruction(&ix.program_id, &ix.data, &accounts, &vaults().0).is_none());
    }
}
