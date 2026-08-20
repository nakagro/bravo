#!/usr/bin/env python3
"""Verify a Convex snapshot export is complete and uncorrupted.

Checks structure, not just zip integrity: every table the manifest claims is
present, every document line parses and carries system fields, and every stored
file listed in _storage actually exists in the archive at its recorded size.

Usage:
    scripts/verify-convex-backup.py <snapshot.zip> [...]
    scripts/verify-convex-backup.py --latest        # newest nightly snapshot
    scripts/verify-convex-backup.py --all           # every nightly snapshot
    scripts/verify-convex-backup.py --latest --compare-previous

Exits non-zero if any snapshot fails.
"""

import argparse
import base64
import hashlib
import json
import pathlib
import sys
import zipfile

NIGHTLY_DIR = pathlib.Path(__file__).resolve().parent.parent / "exports/convex/nightly"

# A table losing most of its rows overnight is far more likely to be a broken
# export than real deletion, so a large drop is worth a warning.
SHRINK_WARN_RATIO = 0.5


class Report:
    def __init__(self, path):
        self.path = path
        self.errors = []
        self.warnings = []
        self.counts = {}
        self.storage_files = 0
        self.storage_bytes = 0

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    @property
    def ok(self):
        return not self.errors

    @property
    def documents(self):
        return sum(self.counts.values())


def verify(path, previous=None):
    r = Report(path)

    if not zipfile.is_zipfile(path):
        r.error("not a zip archive")
        return r

    with zipfile.ZipFile(path) as z:
        # CRC check across every member - catches truncation and bit rot.
        bad = z.testzip()
        if bad is not None:
            r.error(f"corrupt member: {bad}")
            return r

        names = set(z.namelist())

        if "_tables/documents.jsonl" not in names:
            r.error("missing _tables/documents.jsonl (table manifest)")
            return r

        # The manifest is the authority on which tables should be present.
        declared = []
        for lineno, line in enumerate(
            z.read("_tables/documents.jsonl").decode().splitlines(), 1
        ):
            if not line.strip():
                continue
            try:
                declared.append(json.loads(line)["name"])
            except (json.JSONDecodeError, KeyError) as e:
                r.error(f"_tables/documents.jsonl line {lineno}: {e}")
        if not declared:
            r.error("table manifest is empty")
            return r

        for table in declared:
            member = f"{table}/documents.jsonl"
            if member not in names:
                r.error(f"{table}: manifest lists it but {member} is missing")
                continue
            if f"{table}/generated_schema.jsonl" not in names:
                r.warn(f"{table}: no generated_schema.jsonl")

            count = 0
            for lineno, line in enumerate(z.read(member).decode().splitlines(), 1):
                if not line.strip():
                    continue
                try:
                    doc = json.loads(line)
                except json.JSONDecodeError as e:
                    r.error(f"{member} line {lineno}: invalid JSON ({e})")
                    break
                if not isinstance(doc, dict):
                    r.error(f"{member} line {lineno}: not a JSON object")
                    break
                for field in ("_id", "_creationTime"):
                    if field not in doc:
                        r.error(f"{member} line {lineno}: missing {field}")
                        break
                count += 1
            r.counts[table] = count

        # Tables present in the archive but absent from the manifest would be
        # skipped by an import, so they are a real defect, not a curiosity.
        dirs = {n.split("/")[0] for n in names if "/" in n}
        for extra in sorted(dirs - set(declared) - {"_tables", "_storage"}):
            r.error(f"{extra}/: in archive but not in the table manifest")

        # File storage: every referenced blob must be in the archive.
        if "_storage/documents.jsonl" in names:
            for lineno, line in enumerate(
                z.read("_storage/documents.jsonl").decode().splitlines(), 1
            ):
                if not line.strip():
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError as e:
                    r.error(f"_storage/documents.jsonl line {lineno}: {e}")
                    continue
                sid = entry.get("_id")
                blobs = [
                    n
                    for n in names
                    if n.startswith(f"_storage/{sid}.") or n == f"_storage/{sid}"
                ]
                if not blobs:
                    r.error(f"_storage: file {sid} referenced but not in archive")
                    continue
                blob = z.read(blobs[0])
                expected = entry.get("size")
                if expected is not None and int(expected) != len(blob):
                    r.error(
                        f"_storage/{sid}: size mismatch "
                        f"(manifest {expected}, archive {len(blob)})"
                    )
                # The manifest records a base64 sha256 per file; checking it
                # proves the bytes are the ones the deployment actually held.
                digest = entry.get("sha256")
                if digest:
                    actual_digest = base64.b64encode(
                        hashlib.sha256(blob).digest()
                    ).decode()
                    if actual_digest != digest:
                        r.error(f"_storage/{sid}: sha256 mismatch")
                r.storage_files += 1
                r.storage_bytes += len(blob)
        else:
            r.warn(
                "no _storage folder - snapshot was taken without "
                "--include-file-storage, so stored files are NOT backed up"
            )

    if previous is not None:
        for table, was in previous.counts.items():
            now = r.counts.get(table, 0)
            if was > 0 and now < was * SHRINK_WARN_RATIO:
                r.warn(
                    f"{table}: {was} -> {now} documents "
                    f"(dropped {100 * (1 - now / was):.0f}% since {previous.path.name})"
                )
        for table in set(previous.counts) - set(r.counts):
            r.warn(f"{table}: present in {previous.path.name}, absent now")

    return r


def render(r, verbose):
    size_mb = r.path.stat().st_size / 1e6
    status = "PASS" if r.ok else "FAIL"
    print(f"{status}  {r.path.name}  ({size_mb:.1f} MB)")
    print(
        f"      {len(r.counts)} tables, {r.documents} documents, "
        f"{r.storage_files} stored files ({r.storage_bytes / 1e6:.1f} MB)"
    )
    if verbose:
        for table, n in sorted(r.counts.items(), key=lambda kv: -kv[1]):
            print(f"        {n:>7}  {table}")
    for w in r.warnings:
        print(f"      WARN  {w}")
    for e in r.errors:
        print(f"      ERROR {e}")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("snapshots", nargs="*", type=pathlib.Path)
    p.add_argument("--latest", action="store_true", help="verify the newest nightly")
    p.add_argument("--all", action="store_true", help="verify every nightly")
    p.add_argument(
        "--compare-previous",
        action="store_true",
        help="warn when a table shrinks sharply against the prior snapshot",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="per-table counts")
    args = p.parse_args()

    nightly = sorted(NIGHTLY_DIR.glob("vps-export-*.zip"))
    if args.all:
        targets = nightly
    elif args.latest:
        targets = nightly[-1:]
    else:
        targets = args.snapshots

    if not targets:
        print("no snapshots to verify", file=sys.stderr)
        return 1

    previous = None
    if args.compare_previous and args.latest and len(nightly) > 1:
        previous = verify(nightly[-2])

    failed = 0
    for i, path in enumerate(targets):
        if not path.exists():
            print(f"FAIL  {path}: no such file")
            failed += 1
            continue
        prior = previous if len(targets) == 1 else (last if i else None)
        r = verify(path, prior)
        render(r, args.verbose)
        last = r
        if not r.ok:
            failed += 1

    print()
    print(f"{len(targets) - failed}/{len(targets)} snapshot(s) passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
