Only use subagents if the user explicitly requests them.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

### Self-hosted Convex deployment

This project's production Convex deployment is self-hosted on the VPS, not on
Convex's managed SaaS platform.

- Never run `convex dev`, `convex dev --once`, or the `*:cloud` scripts for
  verification or deployment unless the user explicitly asks to use the cloud
  deployment.
- Generate Convex types against the self-hosted deployment with
  `npm run codegen:convex:vps`; do not run bare `npx convex codegen`, because it
  will select the wrong deployment when `.env.vps` is not loaded.
- Deploy Convex to the production VPS only when the user explicitly requests a
  production deployment, using `npm run deploy:convex:vps` (which supplies
  `.env.vps`).
- A code change is not permission to deploy it to production.

<!-- convex-ai-end -->

## Toolchain: Vite+ (`vp` CLI)

This project uses **Vite+** (`vite-plus`), not plain Vite. One CLI drives dev/build/test/lint:

- `npm run dev` / `npm run build:vps` — wrap `vp dev` / `vp build` (Vite 8, Rolldown)
- `npm run test` — `vp test` (Vitest; frontend utils + `convex-test` backend tests, zero extra config)
- `npm run lint:code` — `vp lint` (Oxlint; also runs in the husky pre-commit and CI)
- `npm run lint` — full gate: lint + typecheck + tests + VPS-aware Convex codegen + build

Lint rules live in the `lint` block of `vite.config.ts` — **not** `.oxlintrc.json` or ESLint (removed). Formatting is Prettier (do not introduce oxfmt). The `vite` package is aliased to `@voidzero-dev/vite-plus-core` via an npm override — don't "fix" that in package.json. New tests: colocate `*.test.ts` next to the code; Convex tests need the `// @vitest-environment edge-runtime` docblock (see `convex/availability.test.ts`).
