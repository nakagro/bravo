# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Maintainers:** if `docs/AGENT_PRIVATE.md` exists (the private docs repo cloned into `docs/`), it is
loaded through the gitignored `CLAUDE.local.md` and its rules override this file.

## Safety rules

- **Know which backend you are talking to.** `npm run dev` and every `:vps` script target whatever
  deployment `.env.vps` names. For the maintainers that is a live brigade's production data. Never
  run `deploy:convex:vps`, `import:vps`, `release:prod` or `convex deploy` against a deployment you
  don't own. Production deploys and pushes to `main` are human-only and guarded
  (`scripts/guard-prod.sh`, `.husky/pre-push`); if a guard refuses, stop and hand the step back.
  Don't route around it and don't set `BRAVO_ALLOW_PROD`.
- **`VITE_*` is public.** Every `VITE_*` value is built into the JavaScript any visitor downloads.
  Never put a secret, password or API key in one.
- **No personal data in the repo.** No real member names, phone numbers, emails or contact lists in
  code, tests, fixtures, `public/` or screenshots. Use invented names (e.g. "Alex Carter"). Data that
  holds people's details belongs in Convex behind auth. `.gitleaks.toml` checks this in the
  pre-commit hook and CI.

## Changelog

`CHANGELOG.md` feeds the in-app About page. **Whenever a user-facing change is committed, add it to
`CHANGELOG.md` in the same piece of work** — don't wait to be asked. At the start of a session, if
`git log` shows user-facing commits dated after the newest `## [YYYY.MM.DD]` heading, offer to
catch it up.

- Heading is the date, `## [YYYY.MM.DD]`, newest first.
- One bullet per change, **one short sentence**, prefixed with the module (`- Events: ...`).
  No second sentences, no explaining why. E.g. `- Events: An event can now let members bring guests.`
- Plain language for members. Skip refactors, dependency bumps and tooling unless members notice them.

## Documentation

Public docs: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`. The maintainers' working docs (plans,
runbooks, references) live in a **private** repo cloned into `docs/`, which is gitignored here, so
`docs/` is absent in public clones. Code comments that point at `docs/...` are maintainer
references.

When `docs/` is present: `docs/README.md` is a **generated index** grouped by status, which lives in
each doc's frontmatter. Read it before assuming a plan is or isn't implemented. After changing a doc,
update its frontmatter and run `npm run docs:index`; never hand-edit `docs/README.md`. Search `docs/`
by passing the path explicitly (ripgrep skips gitignored directories from the repo root), and commit
docs changes inside that repo (`git -C docs ...`).

## Commands

### Development
- **Node**: 24.x LTS, pinned in `.nvmrc` and `package.json#engines`. Some backup scripts hardcode the nvm path, so bump them along with `.nvmrc`.
- `npm run dev` / `npm run dev:vps:frontend` - Vite dev server pointed at the backend in `.env.vps`
- `npm run dev:uat` - Frontend + the UAT backend. ⚠️ Runs `convex dev`, a watch loop that continuously pushes your working copy to that deployment

### Build and Deployment
- `npm run deploy:convex:vps` - Deploy the backend to production (human-only, guarded)
- `npm run deploy:convex:uat` - Deploy the backend to UAT
- `npm run build:vps` - Build the frontend
- `npm run lint` - Full gate: Oxlint + typecheck + tests + Convex codegen + production build
- `npm run lint:code` - Oxlint only (`vp lint`, config in the `lint` block of `vite.config.ts`; also runs in the husky pre-commit)
- `npm run test` / `npm run test:watch` - Vitest via `vp test` (frontend utils + `convex-test` backend tests)

The toolchain is **Vite+** (`vp` CLI wrapping Vite 8/Vitest/Oxlint). The `vite` package is aliased to `@voidzero-dev/vite-plus-core` via an npm override. Formatting stays on Prettier, but there is no Prettier config and no format script, so it runs on defaults and is unenforced. Match surrounding style; do not bulk-reformat.

**Lint policy**: `vp lint` must stay at **zero warnings**. Warnings don't fail CI, so the baseline is enforced by convention: underscore-prefix required-but-unused signatures, `ignoreRestSiblings` covers destructure-to-omit, verify dead code with grep before deleting, and flag unfinished-feature removals in the PR.

### Preview
- `npm run preview:vps` - Build and preview the frontend locally

## Architecture

### Technology Stack
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Backend**: Convex (self-hosted Docker + Cloud deployments)
- **UI Framework**: Radix UI primitives with shadcn/ui components
- **Authentication**: @convex-dev/auth with role-based permissions
- **State Management**: Convex real-time queries/mutations
- **PWA**: Vite PWA plugin with service worker and push notifications

### Deployment Architecture
- **Frontend**: a static build, hosted on Vercel and built on every merge to `main`. Vercel runs `npm run build` → `vp build --mode vps`; `.env.vps` is gitignored and absent there, so every `VITE_*` comes from the **Vercel dashboard**. A new `VITE_*` therefore needs adding in *two* places (the env file for local dev, the dashboard for production) or it is `undefined` in prod with no build error. Vercel bakes `VITE_*` at build time, so a dashboard change needs a redeploy. Build command and Node version are dashboard state too; the Ignored Build Step is `vercel.json` → `scripts/vercel-ignore-build.sh` (production branches only, previews skipped).
- **Backend**: Convex, self-hosted (Docker) or Convex Cloud. A UAT deployment is used to verify changes before production.

### Feature-Driven Architecture

`src/features/` — one directory per domain. Run `ls src/features` for the current list rather than
trusting a snapshot here; as of 2026-09-29 it is:

```
actionCentre  admin      auth        availability  baSkills   bookings
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

### Forms, Pickers and the Phone Keyboard

Phones are the primary device. Focus, keyboard and dismissal behaviour live in the shared components,
so pages get it by default. Don't rebuild it per page.

- **Forms and detail panels open in `ResponsiveModal`** (`src/components/shared/`): a bottom drawer on
  phones, a side panel on desktop. Pass the action buttons as `footer` and a small header control as
  `headerAction`. Don't hand-roll `isMobile ? <Drawer> : <Dialog>`, and don't use `Sheet` or `Dialog`
  for a form members fill in on a phone.
- **The drawer (`ui/drawer.tsx`) owns the keyboard**: it sits above the keyboard, keeps iOS from
  scrolling the page, ignores taps outside while typing, pins the page behind (scroll position kept),
  and drops `autoFocus` on open for touch screens. Fixes go there, not in a page.
- **Pickers**: members via `MemberCombobox`, other lists via `ui/combobox.tsx`. Type-in-place by
  design: the field is the search box, and the chevron opens the full list without raising the
  keyboard on phones. Crew seats use `CrewSeatPickers` and the rules in `crew/crewSeats.ts`.
- **Text fields never render under 16px on touch screens** (a global rule in `src/index.css`), so
  iOS doesn't zoom on focus.
- `autoFocus` is fine for a field that appears because the member tapped something (e.g. Edit).
- **Yes/no prompts use `ConfirmDialog`** (`src/components/shared/`), never a hand-built `AlertDialog`.
  `tone="destructive"` for deletes and cancellations. Pass an async `onConfirm`: the button spins
  and the prompt stays up until it resolves, and stays open if it rejects (report the error, then
  rethrow).
- **Busy buttons use `<Button loading>`**: it disables the button and swaps the label's icon for
  the spinner. Keep the label as it is; don't swap it for "Saving...". Other loading indicators use
  `ui/spinner.tsx` (shadcn's), e.g. `<Spinner className="size-8 text-muted-foreground" />` for a
  section.
- **Form fields use `ui/field.tsx`** (shadcn's `Field`): `<Field><FieldLabel htmlFor>…</FieldLabel><Input id/></Field>`,
  with `FieldDescription` for hints and `FieldError` for errors. Not a hand-spaced `div` plus `Label`.
- **Failed calls report through `src/lib/errors.ts`**: `toastError(error, "Could not save")`, or
  `errorMessage(error, fallback)` for a toast description or inline text. It strips Convex's server
  wrapper, so members see the reason, not a stack trace.
- **Dates shown to members use `src/lib/dateFormat.ts`**: `formatDate` ("15 Nov 2026") and
  `formatDateTime`, on Melbourne time. Never a bare `toLocaleDateString()`, which follows the phone's
  locale.
- **Status colours use a tone** (`src/lib/statusTone.ts`): `<Badge tone="success|warning|danger|info|neutral">`,
  or `statusToneClasses[tone]` for a pill that isn't a Badge. Don't pick green/amber/red per module.

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
