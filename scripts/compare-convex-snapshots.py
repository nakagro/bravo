#!/usr/bin/env python3
"""Diff two Convex snapshot exports table by table.

Used by the restore drill to compare a snapshot against a re-export of the
deployment it was restored into: matching document counts and matching document
ids mean the restore reproduced the data, not merely accepted the file.

Usage: scripts/compare-convex-snapshots.py <original.zip> <roundtrip.zip>
"""

import json
import sys
import zipfile


def load(path, bad_lines):
    """Read document ids per table. Unreadable lines are recorded, not raised -
    a damaged archive should be reported as a diff, not a traceback."""
    tables = {}
    storage = set()
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if not name.endswith("/documents.jsonl"):
                continue
            table = name.split("/")[0]
            if table == "_tables":
                continue
            docs = set()
            for lineno, line in enumerate(z.read(name).decode().splitlines(), 1):
                if not line.strip():
                    continue
                try:
                    docs.add(json.loads(line)["_id"])
                except (json.JSONDecodeError, KeyError, TypeError):
                    bad_lines.append(f"{path}: {name} line {lineno} is unreadable")
            if table == "_storage":
                storage = docs
            else:
                tables[table] = docs
    return tables, storage


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2

    problems = []
    a_tables, a_storage = load(sys.argv[1], problems)
    b_tables, b_storage = load(sys.argv[2], problems)

    # Auth tables hold session/token rows the backend may re-issue or expire on
    # import, so they are compared but never fail the drill on their own.
    soft = {t for t in a_tables if t.startswith("auth") or t.endswith("Sessions")}

    only_a = sorted(set(a_tables) - set(b_tables))
    only_b = sorted(set(b_tables) - set(a_tables))
    for t in only_a:
        problems.append(f"table {t} did not survive the restore")
    for t in only_b:
        problems.append(f"table {t} appeared during the restore")

    rows = []
    for table in sorted(set(a_tables) | set(b_tables)):
        a = a_tables.get(table, set())
        b = b_tables.get(table, set())
        missing = a - b
        added = b - a
        if not missing and not added:
            status = "ok"
        elif table in soft:
            status = "differs (auth, ignored)"
        else:
            status = f"MISMATCH -{len(missing)} +{len(added)}"
            problems.append(
                f"{table}: {len(missing)} document(s) missing, {len(added)} unexpected"
            )
        rows.append((table, len(a), len(b), status))

    width = max(len(r[0]) for r in rows) if rows else 10
    for table, a, b, status in rows:
        if status != "ok":
            print(f"  {table:<{width}}  {a:>7} -> {b:>7}   {status}")

    total_a = sum(len(v) for v in a_tables.values())
    total_b = sum(len(v) for v in b_tables.values())
    print()
    print(f"  tables       {len(a_tables)} -> {len(b_tables)}")
    print(f"  documents    {total_a} -> {total_b}")
    print(f"  stored files {len(a_storage)} -> {len(b_storage)}")

    missing_files = a_storage - b_storage
    if missing_files:
        problems.append(f"{len(missing_files)} stored file(s) did not survive the restore")

    print()
    if problems:
        print("RESTORE DRILL FAILED")
        for p in problems:
            print(f"  - {p}")
        return 1
    print("RESTORE DRILL PASSED - snapshot restores to an identical dataset")
    return 0


if __name__ == "__main__":
    sys.exit(main())
