"""Collect raw Squads v4 mainnet accounts and instruction data for golden-byte tests.

Writes raw_accounts.json and raw_ix.json next to this file. Selection of the
fixtures that go into the repository happens in a later step.
"""
import base64
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
import rpc  # noqa: E402

OUT = os.path.dirname(__file__)
random.seed(4)
PER_TYPE = 150
SHARDED = {"Multisig", "Proposal", "VaultTransaction", "ConfigTransaction"}


def disc_of(name):
    return next(k for k, v in rpc.ACCOUNT_DISC.items() if v == name)


def gpa_pubkeys(name, shard=None):
    prefix = disc_of(name) + (bytes([shard]) if shard is not None else b"")
    res = rpc.call("getProgramAccounts", [rpc.PROGRAM, {
        "encoding": "base64",
        "dataSlice": {"offset": 0, "length": 0},
        "filters": [{"memcmp": {"offset": 0, "bytes": rpc.b58encode(prefix)}}],
    }])
    return [r["pubkey"] for r in res]


def fetch_accounts(pubkeys):
    out = []
    for i in range(0, len(pubkeys), 100):
        res = rpc.call("getMultipleAccounts", [pubkeys[i:i + 100], {"encoding": "base64"}])
        for pk, acc in zip(pubkeys[i:i + 100], res["value"]):
            if acc and acc["owner"] == rpc.PROGRAM:
                out.append({"pubkey": pk, "lamports": acc["lamports"],
                            "data": acc["data"][0]})
    return out


def collect_accounts():
    accounts = {}
    for name in rpc.ACCOUNT_TYPES:
        if name in SHARDED:
            keys = []
            for shard in random.sample(range(256), 3):
                keys += gpa_pubkeys(name, shard)
        else:
            keys = gpa_pubkeys(name)
        sample = random.sample(keys, min(PER_TYPE, len(keys)))
        accounts[name] = fetch_accounts(sample)
        print(f"{name}: candidates {len(keys)} fetched {len(accounts[name])}", flush=True)
    return accounts


def collect_ix(accounts, per_ix=6, budget=2500):
    found = {n: [] for n in rpc.INSTRUCTIONS}
    seen = set()
    # Rare instruction families first: their accounts lead to their transactions.
    order = ["ProgramConfig", "TransactionBuffer", "SpendingLimit", "Batch",
             "VaultBatchTransaction", "ConfigTransaction", "Multisig", "VaultTransaction", "Proposal"]
    addresses = []
    for name in order:
        addresses += [a["pubkey"] for a in accounts.get(name, [])[:40]]
    calls = 0
    for addr in addresses:
        if calls >= budget or all(len(v) >= per_ix for v in found.values()):
            break
        sigs = rpc.call("getSignaturesForAddress", [addr, {"limit": 40}])
        for s in sigs:
            sig = s["signature"]
            if sig in seen or s.get("err") is not None:
                continue
            seen.add(sig)
            tx = rpc.call("getTransaction", [sig, {"encoding": "json", "maxSupportedTransactionVersion": 0}])
            calls += 1
            if not tx:
                continue
            msg = tx["transaction"]["message"]
            keys = msg["accountKeys"]
            for ix in msg["instructions"]:
                if keys[ix["programIdIndex"]] != rpc.PROGRAM:
                    continue
                data = rpc.b58decode(ix["data"])
                name = rpc.IX_DISC.get(data[:8])
                if name and len(found[name]) < per_ix:
                    found[name].append({"signature": sig, "slot": tx["slot"],
                                        "data": base64.b64encode(data).decode()})
            if calls % 100 == 0:
                have = sum(1 for v in found.values() if v)
                print(f"  tx calls {calls}: {have}/{len(found)} instructions seen", flush=True)
    return found


if __name__ == "__main__":
    accounts = collect_accounts()
    json.dump(accounts, open(os.path.join(OUT, "raw_accounts.json"), "w"))
    ixs = collect_ix(accounts)
    json.dump(ixs, open(os.path.join(OUT, "raw_ix.json"), "w"))
    for n, v in ixs.items():
        print(f"{n:40} {len(v)}")
