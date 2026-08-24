Only use subagents if the user explicitly requests them.

## Read this first

**`npm run dev` points at live production.** There is no local backend — a dev server on your
machine reads and writes the same database real CFA brigade members depend on for emergency
response. Treat every command that touches a backend as a production action unless you have
confirmed otherwise.

| | Prod (VPS, self-hosted) | UAT (Convex SaaS) | Cloud prod |
|---|---|---|---|
| | `boss-convex.grayhux.io` | `precious-magpie-647` | `veracious-squirrel-546` |
| | live, real members | prod-data clone | unwired, empty — ignore |

- `--env-file .env.vps` → **prod**. `CONVEX_DEPLOYMENT=precious-magpie-647` → **UAT**.
- `npm run dev:uat` runs a *watch loop* that continuously pushes your working copy to UAT. Never
  run it while someone is verifying against UAT — use the one-shot `npm run deploy:convex:uat`.
- `npm run import:vps` and `npm run import:uat` are both `--replace-all`. One word separates
  "restore UAT" from "wipe production".
- The `:cloud` script names are **retired**; they now print a pointer to their `:uat` replacement
  and exit non-zero.
- To check what is actually deployed (read-only):
  `npx convex function-spec --env-file .env.vps`

**UAT holds a full unscrubbed clone of prod data** — real member PII, and password hashes that let
you sign in with a real production password. Guards keep its side effects off real people:
`EMAIL_ALLOWLIST` (mail to anyone unlisted is dropped and logged), a separate VAPID pair (cloned
push subscriptions 403), `VITE_GATE_MOCK=true` (the kiosk cannot drive the real station doors), and
a separate CalDAV collection. Check them with `npm run env:parity -- --compare`. **Never set
`EMAIL_ALLOWLIST` on prod** — that would silently drop real member mail.

Standing UAT up: `npm run clone:uat -- --yes` (refuses unless the guards are armed; reads prod
read-only, verifies the snapshot, then `--replace-all` on UAT) → `npm run deploy:convex:uat`.
Full ritual: `docs/runbooks/uat-environment.md`.

### Production is human-only

**Agents deploy to cloud/UAT. A human deploys to production.** Two actions are reserved for Shaun:

1. `npm run deploy:convex:vps` — the backend deploy
2. `git push origin main` — triggers the Vercel production build

Both are blocked from non-interactive shells (`scripts/guard-prod.sh` and `.husky/pre-push`). If you
hit a refusal, **stop and hand the step back** — do not work around it, do not set
`BRAVO_ALLOW_PROD`, do not call `convex deploy --env-file .env.vps` directly.

What you *should* do: verify on UAT first. Unrestricted for agents: `npm run deploy:convex:uat`,
`npm run clone:uat`, `npm run env:parity`, `npm run snapshot:prod` (read-only), and `npm run lint`
(whose codegen targets UAT, never prod). Commit locally, then say the push and prod deploy are
ready for a human.

Before a prod deploy, a human runs `npm run snapshot:prod` for a verified rollback point — the
nightly backup can be up to 24h stale.

Read-only prod inspection is fine and encouraged: `npx convex function-spec --env-file .env.vps`.

**`docs/reference/environments.md` is required reading before running anything that touches a
backend.** `docs/README.md` is a generated index of all documentation — read it before assuming a
plan is or isn't implemented; status lives in each doc's frontmatter, not its prose. Regenerate with
`npm run docs:index`; never hand-edit `docs/README.md`.

### Branching: `uat` is upstream of `main`

The direction is **`feature -> uat -> main`**. Branch new work from `uat`, not `main`.

**Decision rule — does the change touch `convex/`?**

- **Yes** (schema, new/renamed function, migration): it **must** go through UAT. No exceptions.
  Schema validation against real cloned data is the check nothing else provides.
- **No** (docs, CI, README, trivial frontend): may go direct to `main`.

**If anything lands directly on `main`, `uat` must be re-synced in the same breath:**

```bash
git push origin main
git branch -f uat main                 # never skip this
git push --force-with-lease origin uat
```

Leaving `uat` behind fails silently — the next branch cut from `uat` is missing commits, and the
later merge conflicts in ways that look unrelated. Do not force-update `uat` if it holds work that
is *not* in `main`; merge and find out why it diverged.

Agents cannot push `main` (`.husky/pre-push` blocks non-TTY shells), so in practice: commit, then
hand the push **and** the `uat` re-sync back to Shaun as a pair — not just the push.

Deploy ordering: **adding** a function or field → backend first; **removing or renaming** one →
frontend first (the deployed frontend would otherwise call something that no longer exists).

**Production frontend config is not in this repo.** Vercel builds on merge to `main`; `.env.vps` is
gitignored and absent there, so all `VITE_*` come from the Vercel dashboard. Adding a `VITE_*`
variable requires setting it in **both** the local env file and the dashboard — otherwise it works
locally and is `undefined` in production, with no build error. Dashboard changes need a redeploy to
take effect. Never assume a frontend variable is configured just because it exists in an env file.

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
- `npm run lint` — full gate: lint + typecheck + tests + VPS-aware Convex codegen + build

Lint rules live in the `lint` block of `vite.config.ts` — **not** `.oxlintrc.json` or ESLint (removed). Formatting is Prettier (do not introduce oxfmt) — note there is **no** `.prettierrc`, no `prettier` key in package.json and no format script, so it runs on defaults and nothing enforces it. Match surrounding style rather than reformatting files. The `vite` package is aliased to `@voidzero-dev/vite-plus-core` via an npm override — don't "fix" that in package.json. New tests: colocate `*.test.ts` next to the code; Convex tests need the `// @vitest-environment edge-runtime` docblock (see `convex/availability.test.ts`).
