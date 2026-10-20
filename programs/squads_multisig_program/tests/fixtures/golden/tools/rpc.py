"""Tiny stdlib JSON-RPC helper for collecting Squads v4 mainnet golden data."""
import base64
import hashlib
import json
import time
import urllib.error
import urllib.request

RPC = "https://api.mainnet-beta.solana.com"
PROGRAM = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"

ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

ACCOUNT_TYPES = [
    "Multisig", "Proposal", "VaultTransaction", "ConfigTransaction", "Batch",
    "VaultBatchTransaction", "SpendingLimit", "TransactionBuffer", "ProgramConfig",
]

INSTRUCTIONS = (
    "program_config_init program_config_set_authority program_config_set_multisig_creation_fee "
    "program_config_set_treasury multisig_create multisig_create_v2 multisig_add_member "
    "multisig_remove_member multisig_set_time_lock multisig_change_threshold "
    "multisig_set_config_authority multisig_set_rent_collector multisig_add_spending_limit "
    "multisig_remove_spending_limit config_transaction_create config_transaction_execute "
    "vault_transaction_create transaction_buffer_create transaction_buffer_close "
    "transaction_buffer_extend vault_transaction_create_from_buffer vault_transaction_execute "
    "batch_create batch_add_transaction batch_execute_transaction proposal_create "
    "proposal_activate proposal_approve proposal_reject proposal_cancel proposal_cancel_v2 "
    "spending_limit_use config_transaction_accounts_close vault_transaction_accounts_close "
    "vault_batch_transaction_account_close batch_accounts_close"
).split()


def disc(prefix: str, name: str) -> bytes:
    return hashlib.sha256(f"{prefix}:{name}".encode()).digest()[:8]


ACCOUNT_DISC = {disc("account", n): n for n in ACCOUNT_TYPES}
IX_DISC = {disc("global", n): n for n in INSTRUCTIONS}


def b58decode(s: str) -> bytes:
    n = 0
    for c in s:
        n = n * 58 + ALPHABET.index(c)
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    return b"\0" * (len(s) - len(s.lstrip("1"))) + raw


def b58encode(b: bytes) -> str:
    n = int.from_bytes(b, "big")
    out = ""
    while n:
        n, r = divmod(n, 58)
        out = ALPHABET[r] + out
    return "1" * (len(b) - len(b.lstrip(b"\0"))) + out


def call(method, params, retries=8):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    for attempt in range(retries):
        req = urllib.request.Request(RPC, body, {"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                resp = json.load(r)
            if "error" in resp:
                if resp["error"].get("code") in (-32429, 429):
                    raise urllib.error.HTTPError(RPC, 429, "rate", {}, None)
                raise RuntimeError(resp["error"])
            time.sleep(0.15)
            return resp["result"]
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            time.sleep(min(30, 2 ** attempt))
            last = e
    raise RuntimeError(f"{method} failed: {last}")


def account_b64(data_field) -> bytes:
    return base64.b64decode(data_field[0])
