Only use subagents if the user explicitly requests them.

## Read this first

**Maintainers:** if `docs/AGENT_PRIVATE.md` exists (the private docs repo cloned into `docs/`), read
it before anything else. Its rules for the live deployment override this file.

- **Know which backend you are talking to.** `npm run dev` and every `:vps` script target the
  deployment named in `.env.vps`, which for the maintainers is a live brigade's production data that
  members depend on for emergency response. Treat every command that touches a backend as a
  production action unless you have confirmed otherwise.
- `npm run import:vps` and `npm run import:uat` are both `--replace-all`. One word separates
  "restore UAT" from "wipe production".
- **Production is human-only.** `npm run deploy:convex:vps` and `git push origin main` (which
  triggers the production frontend build) are blocked from non-interactive shells by
  `scripts/guard-prod.sh` and `.husky/pre-push`. If you hit a refusal, stop and hand the step back.
  Don't work around it, don't set `BRAVO_ALLOW_PROD`, don't call `convex deploy` with a production
  env file directly.
- **`VITE_*` is public.** Every `VITE_*` value is built into the JavaScript any visitor downloads.
  Never put a secret, password or API key in one. Production `VITE_*` values come from the hosting
  dashboard, not from this repo: a new one must be set in both the local env file and the dashboard.
- **No personal data in the repo**: no real member names, phone numbers, emails or contact lists in
  code, tests, fixtures, `public/` or screenshots. `.gitleaks.toml` checks this in the pre-commit
  hook and CI.
- Deploy ordering: **adding** a function or field → backend first; **removing or renaming** one →
  frontend first (the deployed frontend would otherwise call something that no longer exists).

The maintainers' working docs live in a private repo cloned into `docs/` (gitignored, absent in
public clones). When present, `docs/README.md` is a generated index; regenerate it with
`npm run docs:index` and never hand-edit it.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Toolchain: Vite+ (`vp` CLI)

This project uses **Vite+** (`vite-plus`), not plain Vite. One CLI drives dev/build/test/lint:

- `npm run dev` / `npm run build:vps` — wrap `vp dev` / `vp build` (Vite 8, Rolldown)
- `npm run test` — `vp test` (Vitest; frontend utils + `convex-test` backend tests, zero extra config)
- `npm run lint:code` — `vp lint` (Oxlint; also runs in the husky pre-commit and CI)
- `npm run lint` — full gate: lint + typecheck + tests + Convex codegen + build

Lint rules live in the `lint` block of `vite.config.ts` — **not** `.oxlintrc.json` or ESLint (removed). Formatting is Prettier (do not introduce oxfmt) — note there is **no** `.prettierrc`, no `prettier` key in package.json and no format script, so it runs on defaults and nothing enforces it. Match surrounding style rather than reformatting files. The `vite` package is aliased to `@voidzero-dev/vite-plus-core` via an npm override — don't "fix" that in package.json. New tests: colocate `*.test.ts` next to the code; Convex tests need the `// @vitest-environment edge-runtime` docblock (see `convex/availability.test.ts`).
