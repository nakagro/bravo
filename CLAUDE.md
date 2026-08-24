# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environments

**`npm run dev` points at live production.** There is no local backend — a frontend on your laptop
reads and writes the same database members use. Three deployments exist:

| | Prod (VPS, self-hosted) | UAT (Convex SaaS) | Cloud prod |
|---|---|---|---|
| | `boss-convex.grayhux.io` | `precious-magpie-647` | `veracious-squirrel-546` |
| | live, real members | prod-data clone, testing | unwired, empty — ignore |

`--env-file .env.vps` targets **prod**; `CONVEX_DEPLOYMENT=precious-magpie-647` targets **UAT**.
Note `npm run dev:uat` runs a *watch loop* that continuously pushes to UAT.

### Production is human-only

**Deploy to cloud/UAT; hand production to Shaun.** Two actions are reserved for a human and blocked
from non-interactive shells:

| Action | Guard |
|---|---|
| `npm run deploy:convex:vps` | `scripts/guard-prod.sh` — needs a TTY + typed phrase |
| `git push origin main` (triggers Vercel prod) | `.husky/pre-push` |

`npm run import:vps` (wipes prod data) is guarded too. If you hit a refusal, **stop and hand it
back** — don't route around it, don't set `BRAVO_ALLOW_PROD`, don't call
`convex deploy --env-file .env.vps` directly.

Unrestricted for agents: `npm run deploy:convex:uat`, `npm run clone:uat`, `npm run snapshot:prod`
(read-only), `npm run env:parity`, `npm run lint` (its codegen targets UAT, not prod), and read-only prod inspection via `npx convex function-spec --env-file .env.vps`.

⚠️ A bare `convex` command with no explicit target reads `CONVEX_DEPLOYMENT` from `.env.local`,
which points at **UAT** — safe, but not obvious. Always be explicit about the target.

**Read `docs/reference/environments.md` before running anything that touches a backend** — it
covers which command hits which deployment, the `import --replace-all` footguns, and how to check
what is actually live with `npx convex function-spec --env-file .env.vps` (read-only).

## Documentation

`docs/README.md` is a **generated index** of every doc, grouped by status. Read it before assuming a
plan is or isn't implemented — status lives in each doc's frontmatter, not in its prose.

- `docs/plans/` — proposed, in-flight and completed work (`status:` planned | in-progress | partial | implemented | superseded)
- `docs/reference/` — how things work today · `docs/runbooks/` — operational procedures · `docs/audits/` — point-in-time assessments
- `docs/archive-pre-2026/` — historical, excluded from the index

After adding or changing a doc, update its frontmatter and run `npm run docs:index` (validates and
regenerates). Never hand-edit `docs/README.md`.

## Commands

### Development
- `npm run dev:vps:frontend` - **Primary local dev command** — Vite dev server pointed at the VPS backend
- `npm run dev` / `npm run dev:frontend` / `npm run dev:vps` - Aliases for `dev:vps:frontend`
- `npm run dev:uat` - Frontend + **UAT** backend (`precious-magpie-647`). ⚠️ Runs `convex dev`, a
  watch loop that continuously pushes your working copy to UAT — see `docs/reference/environments.md`

### Build and Deployment
- `npm run deploy:convex:vps` - **Deploy backend** — pushes Convex functions/schema to VPS (live production)
- `npm run deploy:vps` - Deploy backend to VPS (frontend deploys automatically via GitHub → Vercel on merge to main)
- `npm run build:vps` - Build frontend for VPS backend URL
- `npm run lint` - Full gate: Oxlint + typecheck + tests + Convex codegen + production build
- `npm run lint:code` - Oxlint only (`vp lint`, config in the `lint` block of `vite.config.ts`; also runs in the husky pre-commit)
- `npm run test` / `npm run test:watch` - Vitest via `vp test` (frontend utils + `convex-test` backend tests)

The toolchain is **Vite+** (`vp` CLI wrapping Vite 8/Vitest/Oxlint; see `docs/audits/vite-plus-evaluation.md`). The `vite` package is aliased to `@voidzero-dev/vite-plus-core` via an npm override. Formatting stays on Prettier — but there is no Prettier config and no format script, so it runs on defaults and is unenforced. Match surrounding style; do not bulk-reformat.

**Lint policy**: `vp lint` must stay at **zero warnings** (baseline established 2026-07-17). Warnings don't fail CI, so the baseline is enforced by convention — see `docs/reference/linting.md` for how to resolve new warnings (underscore-prefix required signatures, `ignoreRestSiblings` covers destructure-to-omit, verify dead code with grep before deleting, flag unfinished-feature removals in the PR).

### Preview
- `npm run preview:vps` - Build and preview VPS frontend locally

## Architecture

### Technology Stack
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Backend**: Convex (self-hosted Docker + Cloud deployments)
- **UI Framework**: Radix UI primitives with shadcn/ui components
- **Authentication**: @convex-dev/auth with role-based permissions
- **State Management**: Convex real-time queries/mutations
- **PWA**: Vite PWA plugin with service worker and push notifications

### Deployment Architecture
- **Frontend**: Hosted on Vercel, built on every merge to `main`. **No env file in this repo configures it.** Vercel runs `npm run build` → `vp build --mode vps`, but `.env.vps` is gitignored and absent there, so every `VITE_*` comes from the **Vercel dashboard**. A new `VITE_*` therefore needs adding in *two* places — the env file (for local dev) and the dashboard (for production) — or it works locally and is `undefined` in prod with no build error. Vercel bakes `VITE_*` at build time, so a dashboard change needs a redeploy. Build command, Ignored Build Step and Node version are dashboard state too, invisible to `git`. If prod differs from local on identical code, check Vercel first.
- **Backend**: Self-hosted Convex running in Docker on a VPS (`https://boss-convex.grayhux.io`). Deployed via `npm run deploy:convex:vps`.
- **UAT tier (built 2026-08-24)**: `precious-magpie-647` holds a full unscrubbed clone of prod data, guarded by `EMAIL_ALLOWLIST`, a separate VAPID pair and a mocked kiosk gate. Verify there before promoting: `npm run clone:uat -- --yes` → `npm run deploy:convex:uat` → merge `uat` → `main`. **Read `docs/runbooks/uat-environment.md`** for the full ritual and the guard list. `npm run dev` still points a local frontend at **live prod**.

### Feature-Driven Architecture

`src/features/` — one directory per domain. Run `ls src/features` for the current list rather than
trusting a snapshot here; as of 2026-08-23 it is:

```
actionCentre  admin      auth        availability  baSkills   bookings   brigadeTasks
calendar      contacts   dutyCrew    equipment     events     hoses      inventory
keys          kiosk      memberRecords            qrCodes    serviceAccounts
userSettings  vehicleFaults
```

### Backend Structure
```
convex/
├── schema.ts       # Database schema with domain entities
├── auth.ts         # Authentication logic
├── crons.ts        # Scheduled tasks (availability reset)
├── lib/            # Shared backend helpers (accountType, notifyEvent, logging, dates)
├── actionCentreProviders/  # One provider per Action Centre source
└── [domain].ts     # Domain-specific queries/mutations (flat, one file per domain)
```

Note: there is **no** `convex/features/` directory — backend modules are flat files at `convex/`.

### Role-Based Security System
- **Ranks**: Brigade Member → Probationary → Firefighter → Lieutenant → Captain
  (`Brigade Member` is the non-operational floor rank and the signup default)
- **Roles**: Communications Officer, Secretary, Training Officer, etc.
- **Module Access Control**: Per-feature permissions via `moduleSettings`
- **Admin Controls**: Comprehensive user and system management

### Database Design Patterns
- **Audit Trails**: Comprehensive history tracking for all domains
- **Real-time Updates**: Convex subscriptions for live data
- **Modular Permissions**: Dynamic feature enablement per user role/rank
- **System Tables**: `_storage` for file management, custom tables for business logic

## Convex Development Guidelines

**Read `convex/_generated/ai/guidelines.md` before writing Convex code.** It is regenerated by
`npx convex ai-files update` (wired into `npm run skills:sync`), so it tracks the installed Convex
version, and it explicitly overrides Convex patterns learned from training data.

The former `rules/*.mdc` files were removed on 2026-08-23 — they predated both the generated
guidelines and skill files, and had gone 15 months without an update.

## UI Component System

### Component Structure
- **Base Components**: `src/components/ui/` (shadcn/ui based)
- **Layout Components**: `src/components/layout/` (Navigation, MainLayout)
- **Feature Components**: `src/features/[domain]/components/`
- **Common Components**: `src/components/common/` (DarkModeToggle, etc.)

### Styling Patterns
- **Tailwind CSS**: Utility-first with CSS variables for theming
- **Dark Mode**: Complete light/dark theme support via ThemeContext
- **Responsive Design**: Mobile-first approach with drawer navigation
- **Design Tokens**: Consistent spacing, colors, and typography

## Progressive Web App Features

### PWA Configuration
- **Installable**: Standalone display mode with proper manifest
- **Service Worker**: Asset precaching and push notification handling
- **Offline Support**: Application shell caching via Vite PWA plugin
- **Push Notifications**: VAPID-based web push with automated daily resets

### Push Notification System
- **Registration**: Browser permission and subscription management
- **Backend**: Node.js web-push integration in Convex actions
- **Automation**: Daily availability reset notifications (04:00 AEST)
- **Testing**: Admin interface for notification testing

## Development Patterns

### State Management
- **Real-time Queries**: `useQuery` for reactive data subscriptions
- **Optimistic Updates**: Immediate UI feedback with server synchronization
- **Error Handling**: Consistent error boundaries and user feedback via Sonner

### Code Organization
- **Domain-Driven**: Business logic organized by functional domains
- **Type Safety**: Comprehensive TypeScript with generated Convex types
- **Reusable Utilities**: Shared functions in `src/lib/` and `src/utils/`

### Authentication Flow
- **Provider-based**: Configured in `convex/auth.config.ts`
- **Role Assignment**: Admin-controlled role and rank management
- **Permission Checking**: Real-time permission validation per feature

## CFA Brigade Management Context

This system is designed for Country Fire Authority (CFA) volunteer fire brigades in Victoria, Australia. Key operational requirements:

### Core Domains
- **Member Availability**: Real-time turnout status for emergency response
- **Equipment Management**: Fire hose Management with testing schedules
- **Key Management**: Protected premises access control
- **Duty Crew**: Station checks and crew scheduling
- **Skills Tracking**: Member qualifications (BA Internal, Driver, etc.)

### Operational Workflows
- **Daily Availability Reset**: Automated 04:00 notifications for status updates
- **Equipment Testing**: Scheduled hose testing with compliance tracking
- **Role Assignments**: Dynamic role management for organizational structure
- **Audit Requirements**: Comprehensive change tracking for accountability

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
