//! Loads a transaction signer from a keypair path, `stdin`, a seed phrase prompt,
//! a base58 keypair string or a Ledger (`usb://ledger`, behind the `ledger` feature).

use std::str::FromStr;

use bip39::{Language, Mnemonic};
use dialoguer::Password;
use eyre::eyre;
use solana_keypair::seed_derivable::keypair_from_seed_and_derivation_path;
use solana_keypair::{keypair_from_seed, read_keypair, read_keypair_file, Keypair};
use solana_sdk::pubkey::Pubkey;
use solana_signer::Signer;

const KEYPAIR_NAME: &str = "Keypair";

// Word lists accepted for seed phrases, in the order solana-clap-utils tries them.
const SEED_PHRASE_LANGUAGES: [Language; 8] = [
    Language::English,
    Language::SimplifiedChinese,
    Language::TraditionalChinese,
    Language::Japanese,
    Language::Spanish,
    Language::Korean,
    Language::French,
    Language::Italian,
];

/// Where a signer comes from, as written on the command line.
#[derive(Debug, Clone, PartialEq, Eq)]
enum SignerSource {
    Filepath(String),
    Stdin,
    /// `legacy` is the `ASK` keyword: the seed is used without BIP44 derivation.
    Prompt {
        legacy: bool,
    },
    Base58Keypair(String),
    Usb(String),
    Pubkey(Pubkey),
}

/// Loads the signer that `path` names. See the module doc for the supported sources.
pub fn signer_from_path(path: &str) -> eyre::Result<Box<dyn Signer>> {
    match parse_signer_source(path)? {
        SignerSource::Filepath(file) => read_keypair_file(&file)
            .map(boxed)
            .map_err(|e| eyre!("could not read keypair file \"{file}\". Run \"solana-keygen new\" to create a keypair file: {e}")),
        SignerSource::Stdin => read_keypair(&mut std::io::stdin())
            .map(boxed)
            .map_err(|e| eyre!("could not read keypair from stdin: {e}")),
        SignerSource::Prompt { legacy } => keypair_from_seed_phrase(legacy).map(boxed),
        SignerSource::Base58Keypair(encoded) => Keypair::try_from_base58_string(&encoded)
            .map(boxed)
            .map_err(|e| eyre!("invalid base58 keypair: {e}")),
        SignerSource::Usb(uri) => remote_signer(&uri),
        SignerSource::Pubkey(pubkey) => {
            Err(eyre!("missing signature for supplied pubkey: {pubkey}"))
        }
    }
}

fn boxed<S: Signer + 'static>(signer: S) -> Box<dyn Signer> {
    Box::new(signer)
}

fn parse_signer_source(path: &str) -> eyre::Result<SignerSource> {
    if Keypair::try_from_base58_string(path).is_ok() {
        return Ok(SignerSource::Base58Keypair(path.to_string()));
    }
    let Some((scheme, rest)) = path.split_once(':').filter(|(s, _)| is_uri_scheme(s)) else {
        return Ok(match path {
            "-" | "stdin" => SignerSource::Stdin,
            "ASK" => SignerSource::Prompt { legacy: true },
            _ => Pubkey::from_str(path)
                .map(SignerSource::Pubkey)
                .unwrap_or_else(|_| SignerSource::Filepath(path.to_string())),
        });
    };
    match scheme.to_ascii_lowercase().as_str() {
        "file" => Ok(SignerSource::Filepath(
            rest.strip_prefix("//").unwrap_or(rest).to_string(),
        )),
        "stdin" => Ok(SignerSource::Stdin),
        "prompt" => Ok(SignerSource::Prompt { legacy: false }),
        "usb" => Ok(SignerSource::Usb(path.to_string())),
        _ => Err(eyre!("unrecognized signer source: {path}")),
    }
}

// RFC 3986 scheme; one letter is rejected so `C:\key.json` stays a path.
fn is_uri_scheme(candidate: &str) -> bool {
    let mut chars = candidate.chars();
    candidate.len() > 1
        && chars.next().is_some_and(|c| c.is_ascii_alphabetic())
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
}

fn keypair_from_seed_phrase(legacy: bool) -> eyre::Result<Keypair> {
    let seed_phrase = Password::new()
        .with_prompt(format!("[{KEYPAIR_NAME}] seed phrase"))
        .interact()?;
    let mnemonic = parse_seed_phrase(&seed_phrase)?;
    let passphrase = Password::new()
        .with_prompt(format!(
            "[{KEYPAIR_NAME}] If this seed phrase has an associated passphrase, enter it now. Otherwise, press ENTER to continue"
        ))
        .allow_empty_password(true)
        .with_confirmation("Enter same passphrase again", "Passphrases did not match")
        .interact()?;
    let seed = mnemonic.to_seed(&passphrase);
    let keypair = if legacy {
        keypair_from_seed(&seed)
    } else {
        keypair_from_seed_and_derivation_path(&seed, None)
    };
    keypair.map_err(|e| eyre!("could not derive keypair from seed phrase: {e}"))
}

/// Checks the phrase against the BIP39 word lists, as the Solana CLI does by default.
fn parse_seed_phrase(seed_phrase: &str) -> eyre::Result<Mnemonic> {
    let sanitized = seed_phrase.split_whitespace().collect::<Vec<_>>().join(" ");
    SEED_PHRASE_LANGUAGES
        .iter()
        .find_map(|language| Mnemonic::parse_in(*language, &sanitized).ok())
        .ok_or_else(|| eyre!("Can't get mnemonic from seed phrases"))
}

#[cfg(feature = "ledger")]
fn remote_signer(uri: &str) -> eyre::Result<Box<dyn Signer>> {
    use solana_derivation_path::DerivationPath;
    use solana_remote_wallet::locator::Locator;
    use solana_remote_wallet::remote_keypair::generate_remote_keypair;
    use solana_remote_wallet::remote_wallet::maybe_wallet_manager;

    let (locator, query) = uri.split_once('?').unwrap_or((uri, ""));
    let derivation_path = match query.split_once('=') {
        None if query.is_empty() => DerivationPath::default(),
        Some(("key", key)) => DerivationPath::from_key_str(key)
            .map_err(|e| eyre!("invalid derivation path in {uri}: {e}"))?,
        _ => {
            return Err(eyre!(
                "unsupported query in {uri}; use ?key=<account>/<change>"
            ))
        }
    };
    let locator =
        Locator::new_from_path(locator).map_err(|e| eyre!("invalid wallet locator {uri}: {e}"))?;
    let wallet_manager = maybe_wallet_manager()
        .map_err(|e| eyre!("could not open the USB wallet: {e}"))?
        .ok_or_else(|| eyre!("no remote wallet found"))?;
    generate_remote_keypair(
        locator,
        derivation_path,
        &wallet_manager,
        false,
        KEYPAIR_NAME,
    )
    .map(boxed)
    .map_err(|e| eyre!("could not load the remote keypair {uri}: {e}"))
}

#[cfg(not(feature = "ledger"))]
fn remote_signer(uri: &str) -> eyre::Result<Box<dyn Signer>> {
    Err(eyre!(
        "{uri}: USB wallets need the `ledger` feature; rebuild squads-multisig-4r-cli with it"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_keypair::write_keypair_file;

    fn temp_keypair_file(name: &str) -> (Keypair, std::path::PathBuf) {
        let keypair = Keypair::new();
        let path = std::env::temp_dir().join(format!("{name}-{}.json", keypair.pubkey()));
        write_keypair_file(&keypair, &path).expect("write keypair file");
        (keypair, path)
    }

    #[test]
    fn loads_keypair_from_file_path() {
        let (keypair, path) = temp_keypair_file("signer-path");

        let signer = signer_from_path(path.to_str().expect("utf-8 path"));
        std::fs::remove_file(&path).ok();

        assert_eq!(signer.expect("signer").pubkey(), keypair.pubkey());
    }

    #[test]
    fn loads_keypair_from_file_uri() {
        let (keypair, path) = temp_keypair_file("signer-uri");
        let uri = format!("file://{}", path.display());

        let signer = signer_from_path(&uri);
        std::fs::remove_file(&path).ok();

        assert_eq!(signer.expect("signer").pubkey(), keypair.pubkey());
    }

    #[test]
    fn loads_keypair_from_base58_string() {
        let keypair = Keypair::new();

        let signer = signer_from_path(&keypair.to_base58_string());

        assert_eq!(signer.expect("signer").pubkey(), keypair.pubkey());
    }

    #[test]
    fn rejects_invalid_sources() {
        let missing = std::env::temp_dir().join("signer-missing-keypair.json");

        let missing_file = signer_from_path(missing.to_str().expect("utf-8 path"));
        let unknown_scheme = signer_from_path("ftp://example.com/key.json");
        let bare_pubkey = signer_from_path(&Pubkey::new_unique().to_string());

        assert!(missing_file.is_err());
        assert!(unknown_scheme.is_err());
        assert!(bare_pubkey.is_err());
    }

    #[test]
    fn classifies_sources() {
        let cases = [
            (
                "usb://ledger?key=0/0",
                SignerSource::Usb("usb://ledger?key=0/0".into()),
            ),
            ("USB://ledger", SignerSource::Usb("USB://ledger".into())),
            ("stdin", SignerSource::Stdin),
            ("stdin:", SignerSource::Stdin),
            ("-", SignerSource::Stdin),
            ("prompt://", SignerSource::Prompt { legacy: false }),
            ("prompt:", SignerSource::Prompt { legacy: false }),
            ("ASK", SignerSource::Prompt { legacy: true }),
            (
                "file:///tmp/id.json",
                SignerSource::Filepath("/tmp/id.json".into()),
            ),
            ("C:\\id.json", SignerSource::Filepath("C:\\id.json".into())),
        ];

        let parsed: Vec<_> = cases
            .iter()
            .map(|(input, _)| parse_signer_source(input).expect("parse"))
            .collect();

        cases
            .iter()
            .zip(parsed)
            .for_each(|((input, expected), actual)| assert_eq!(&actual, expected, "{input}"));
    }

    const VECTOR_PHRASE: &str =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    #[test]
    fn accepts_a_valid_seed_phrase_with_extra_whitespace() {
        // Act
        let mnemonic = parse_seed_phrase(&format!("  {}  ", VECTOR_PHRASE.replace(' ', "   ")));

        // Assert
        assert!(mnemonic.is_ok());
    }

    #[test]
    fn rejects_a_seed_phrase_with_a_typo() {
        // Act
        let mnemonic = parse_seed_phrase(&VECTOR_PHRASE.replace("about", "abuot"));

        // Assert
        assert!(mnemonic.is_err());
    }

    #[test]
    fn derives_the_bip39_reference_seed() {
        // Arrange: BIP39 test vector (Trezor), passphrase "TREZOR".
        let expected = "c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04";

        // Act
        let seed = parse_seed_phrase(VECTOR_PHRASE)
            .expect("valid phrase")
            .to_seed("TREZOR");

        // Assert
        let hex: String = seed.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(hex, expected);
    }

    #[cfg(not(feature = "ledger"))]
    #[test]
    fn usb_source_without_ledger_feature_is_an_error() {
        let result = signer_from_path("usb://ledger");

        assert!(result.is_err());
    }
}
