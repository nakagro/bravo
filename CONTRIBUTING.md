# Contributing to BRAVO

Thanks for helping. BRAVO is maintained by one volunteer for a CFA brigade, so small, focused pull
requests are much easier to review than large ones.

## Before you start

- For anything beyond a small fix, open an issue first so we can agree on the approach.
- Security problems: don't open an issue. Follow [SECURITY.md](./SECURITY.md).

## Setting up

Follow **Running your own copy** in the [README](./README.md). Use your own Convex deployment
for development; never point a development build at a deployment that holds real members' data
unless it's yours to test against.

## Making a change

1. Branch from `main`.
2. Keep to the existing structure: one folder per domain in `src/features/`, one flat file per domain
   in `convex/`. Read `convex/_generated/ai/guidelines.md` before writing Convex code.
3. Add or update tests next to the code (`*.test.ts`). Convex tests use `convex-test` and need the
   `// @vitest-environment edge-runtime` docblock.
4. Run the full gate and make sure it passes with **zero lint warnings**:
   ```bash
   npm run lint
   ```
5. If members would notice the change, add one line to `CHANGELOG.md` under today's date:
   `- Module: One short sentence in plain language.`
6. Open a pull request describing what changed and how you tested it.

Formatting follows Prettier defaults. Match the surrounding style and don't reformat files you
aren't otherwise changing.

## Never commit personal data or secrets

The repository is public. Don't commit:

- real people's names, phone numbers, email addresses, member numbers or addresses. That includes
  test fixtures, seed data and screenshots. Use invented names such as "Alex Carter";
- contact lists, data exports, spreadsheets or PDFs. Data with people's details belongs in Convex
  behind sign-in;
- secrets, passwords or API keys, including in `VITE_*` variables, which are built into the public
  JavaScript bundle;
- internal network details (LAN IP addresses, device IDs of station equipment).

The pre-commit hook runs [gitleaks](https://github.com/gitleaks/gitleaks) with `.gitleaks.toml` if
you have it installed, and CI runs it on every pull request.

## Licence

By contributing, you agree that your contributions are licensed under the project's licence,
[AGPL-3.0-only](./LICENSE).
