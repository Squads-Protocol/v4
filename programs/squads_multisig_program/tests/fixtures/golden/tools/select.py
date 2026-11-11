"""Pick a small, varied fixture set from raw_accounts.json / raw_ix.json and write
the repository fixture files (hex text format read by golden_wire_format.rs)."""
import base64
import json
import os
import struct
import sys

HERE = os.path.dirname(__file__)
DEST = sys.argv[1]
PER_TYPE = 8
PER_IX = 3


def u32(b, o):
    return struct.unpack_from("<I", b, o)[0]


def vault_message_features(b, o):
    """Feature tuple of a VaultTransactionMessage (Vec-prefixed layout) at offset o."""
    o += 3
    keys = u32(b, o); o += 4 + 32 * keys
    n_ix = u32(b, o); o += 4
    data_sizes = []
    for _ in range(n_ix):
        o += 1
        o += 4 + u32(b, o)
        dlen = u32(b, o); data_sizes.append(dlen); o += 4 + dlen
    alts = u32(b, o)
    return (min(keys, 10) // 5, min(n_ix, 4), alts > 0, max(data_sizes or [0]) > 200)


def features(kind, b):
    try:
        if kind == "Multisig":
            authority = b[40:72] != bytes(32)
            time_lock = struct.unpack_from("<I", b, 74)[0] > 0
            has_rent = b[94] == 1
            members_off = 95 + (32 if has_rent else 0) + 1
            return (authority, time_lock, has_rent, min(u32(b, members_off), 6) // 3)
        if kind == "Proposal":
            return (b[48], u32(b, 57 if b[48] != 4 else 49) > 0)
        if kind == "ConfigTransaction":
            n = u32(b, 81)
            return (tuple(sorted({b[85]})) if n else (), min(n, 3))
        if kind == "SpendingLimit":
            sol = b[73:105] == bytes(32)
            period = b[113]
            members = u32(b, 131)
            dests = u32(b, 135 + 32 * members)
            return (sol, period, dests > 0)
        if kind == "VaultTransaction":
            bumps = u32(b, 83)
            return (bumps > 0,) + vault_message_features(b, 87 + bumps)
        if kind == "VaultBatchTransaction":
            bumps = u32(b, 9)
            return (bumps > 0,) + vault_message_features(b, 13 + bumps)
        if kind == "Batch":
            size, executed = struct.unpack_from("<II", b, 83)
            return (min(size, 3), executed == size)
        return (len(b),)
    except (struct.error, IndexError):
        return ("unparsed", len(b))


def pick(kind, items):
    by_feature = {}
    for item in sorted(items, key=lambda a: a["pubkey"]):
        data = base64.b64decode(item["data"])
        by_feature.setdefault(features(kind, data), (item, data))
    chosen = list(by_feature.values())
    # Keep the largest account too: it stresses vec lengths the most.
    largest = max(((i, base64.b64decode(i["data"])) for i in items), key=lambda x: len(x[1]), default=None)
    if largest and all(c[0]["pubkey"] != largest[0]["pubkey"] for c in chosen):
        chosen.append(largest)
    return chosen[:PER_TYPE], sorted(by_feature)


accounts = json.load(open(os.path.join(HERE, "raw_accounts.json")))
ixs = json.load(open(os.path.join(HERE, "raw_ix.json")))

lines, report = [], []
for kind, items in accounts.items():
    chosen, feats = pick(kind, items)
    report.append(f"{kind:24} candidates={len(items):4} variants={len(feats):3} chosen={len(chosen)}")
    lines += [f"{kind} {item['pubkey']} {data.hex()}" for item, data in chosen]

ix_lines = []
# multisig_create (v1) was deprecated before the freeze; its historical args are not accepted by v4 or 4r.
for name, samples in ((n, s) for n, s in ixs.items() if n != "multisig_create"):
    report.append(f"{name:42} samples={len(samples)}")
    for s in samples[:PER_IX]:
        ix_lines.append(f"{name} {s['signature']} {base64.b64decode(s['data']).hex()}")

header = "# <type|instruction> <address|signature> <hex bytes>; collected from mainnet-beta, see README.md\n"
open(os.path.join(DEST, "accounts.txt"), "w").write(header + "\n".join(lines) + "\n")
open(os.path.join(DEST, "instructions.txt"), "w").write(header + "\n".join(ix_lines) + "\n")
print("\n".join(report))
print("account bytes", sum(len(l) for l in lines) // 2, "instruction bytes", sum(len(l) for l in ix_lines) // 2)
