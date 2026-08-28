#!/usr/bin/env python3
"""Pull pushSubscriptions out of one Convex snapshot, ready to re-import.

Cloning production into UAT with `convex import --replace-all` replaces every
table, pushSubscriptions included. That is wrong for this one table: a push
subscription is bound to the VAPID key pair of the deployment it was created
against, so production's rows are dead on arrival on UAT, and UAT's own rows -
the handful of tester devices that actually work there - are destroyed. The
testers then have to unregister and re-register after every clone.

This script reads UAT's own rows from a snapshot taken *before* the clone and
writes them as JSONL for `convex import --table pushSubscriptions --replace`.

    extract-push-subscriptions.py <uat-snapshot.zip> <out.jsonl> [--users-from prod.zip]

System fields are stripped (`convex import` assigns fresh ones). With
--users-from, rows whose userId does not exist in that snapshot's users table
are dropped, since a dangling Id would fail validation on import.

Exits 3 if there is nothing to preserve, so callers can skip the re-import.
"""

import argparse
import json
import pathlib
import sys
import zipfile

TABLE = "pushSubscriptions"


def read_table(zf: zipfile.ZipFile, table: str):
    """Rows of one table, or None if the snapshot does not contain it."""
    name = f"{table}/documents.jsonl"
    if name not in zf.namelist():
        return None
    with zf.open(name) as handle:
        return [json.loads(line) for line in handle if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot", type=pathlib.Path)
    parser.add_argument("out", type=pathlib.Path)
    parser.add_argument("--users-from", type=pathlib.Path)
    args = parser.parse_args()

    with zipfile.ZipFile(args.snapshot) as zf:
        rows = read_table(zf, TABLE)
    if rows is None:
        print(f"  {TABLE} is not in {args.snapshot.name} - nothing to preserve")
        return 3

    valid_users = None
    if args.users_from:
        with zipfile.ZipFile(args.users_from) as zf:
            users = read_table(zf, "users")
        # No users table means the reference snapshot is not what we think it
        # is. Treating that as "no valid users" would silently drop every
        # subscription, which is the failure this script exists to prevent.
        if not users:
            print(f"  users is missing or empty in {args.users_from.name}", file=sys.stderr)
            return 1
        valid_users = {u["_id"] for u in users}

    kept, dropped = [], 0
    for row in rows:
        if valid_users is not None and row.get("userId") not in valid_users:
            dropped += 1
            continue
        kept.append({k: v for k, v in row.items() if not k.startswith("_")})

    if dropped:
        print(f"  dropped {dropped} subscription(s) whose user is not in the incoming data")

    if not kept:
        print(f"  no {TABLE} rows to preserve")
        return 3

    args.out.write_text("".join(json.dumps(row) + "\n" for row in kept))
    print(f"  kept {len(kept)} subscription(s) -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
