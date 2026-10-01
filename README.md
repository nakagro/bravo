# Brigade Availability and Operations (BRAVO)

BRAVO (BRigade AVailability and Operations) is a comprehensive brigade management system designed for CFA (Country Fire Authority) volunteer fire brigades in Victoria, Australia, developed for the Wyndham Vale Fire Brigade. It provides a complete suite of tools for managing brigade operations, equipment, personnel, and emergency response readiness.

This system is built using [Vite](https://vitejs.dev/) (with React and TypeScript) for the frontend and [Convex](https://convex.dev/) as the backend. The Convex backend supports both self-hosted Docker deployment and Convex Cloud.

## Purpose of this Document

This README serves as a guide for developers, contributors, and AI assistants to understand the project's architecture, features, and setup. Providing this context helps in efficiently developing, debugging, and extending the application.

## Technology Stack

*   **Frontend**: [Vite](https://vitejs.dev/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **Backend**: [Convex](https://convex.dev/) (Self-hosted via Docker or Convex Cloud)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Routing**: [React Router DOM](https://reactrouter.com/)
*   **UI Components**: [shadcn/ui](https://ui.shadcn.com/) with [Radix UI](https://www.radix-ui.com/) primitives, plus [Headless UI](https://headlessui.com/) for complex widgets (Combobox, Transition)
*   **Icons**: [Lucide React](https://lucide.dev/) and [Heroicons](https://heroicons.com/) (`@heroicons/react`)
*   **Form Validation**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) schema validation via `@hookform/resolvers` — provides type-safe form state, inline field-level error messages, and cross-field validation (e.g. end date must be after start date). Currently used in the Bookings module forms as a reference pattern for adoption in other modules (Hoses, Keys, etc.)
*   **Date Handling**: [date-fns](https://date-fns.org/) for all date formatting, parsing, and manipulation. [react-day-picker](https://react-day-picker.js.org/) v9 powers the inline calendar date picker component.
*   **Notifications**: [Sonner](https://sonner.emilkowal.ski/) for toasts/notifications
*   **Authentication**: [Convex Auth](https://docs.convex.dev/auth) — built-in authentication system with support for multiple providers
*   **Analytics**: [PostHog](https://posthog.com/) for notification tracking and analytics
*   **Monitoring**: Health check endpoints with external monitoring support (Healthcheck.io, Zabbix, Uptime Kuma)

## Development and Deployment

For detailed instructions on developing and deploying with both local Docker-based Convex and Convex Cloud, see [docs/reference/convex-setup.md](./docs/reference/convex-setup.md).

## Project Structure

```
/var/www/bravo
├── convex/                 # Backend Convex functions, schema, and configuration
│   ├── _generated/         # Auto-generated Convex files
│   ├── features/           # Backend logic organized by feature
│   │   ├── auth/           # Authentication logic
│   │   └── hoses/          # Hose management backend
│   ├── auth.config.ts      # Convex Auth provider configuration
│   ├── auth.ts             # Custom authentication logic
│   ├── bookings.ts         # Booking resources and reservations
│   ├── crons.ts            # Scheduled tasks (daily availability reset)
│   ├── dutyCrew.ts         # Duty crew management
│   ├── fireReports.ts      # Fire report system
│   ├── hoses.ts            # Hose inventory queries and mutations
│   ├── http.ts             # HTTP endpoints (health checks, webhooks)
│   ├── keys.ts             # Key register management
│   ├── modules.ts          # Permission system and module access control
│   ├── schema.ts           # Complete database schema
│   ├── skills.ts           # User skills management
│   ├── stationChecks.ts    # Station check templates and runs
│   ├── vehicleFaults.ts    # Vehicle fault tracking
│   ├── vehicleFaultVehicleTypes.ts  # Vehicle type administration
│   └── ...                 # Additional backend modules
├── public/                 # Static assets and PWA configuration
│   ├── icons/              # PWA icons and favicons
│   ├── manifest.json       # PWA manifest
│   └── sw-push.js          # Push notification service worker
├── src/                    # Frontend application code
│   ├── components/         # Reusable UI components
│   │   ├── admin/          # Admin-specific components
│   │   ├── common/         # Shared components (DarkModeToggle, etc.)
│   │   ├── layout/         # Layout components (MainLayout, AuthLayout)
│   │   ├── shared/         # Cross-feature shared components (ResponsiveModal, DatePicker, etc.)
│   │   └── ui/             # shadcn/ui base components (Sheet, Calendar, Form, etc.)
│   ├── features/           # Feature-based modules
│   │   ├── admin/          # Admin dashboard and tools
│   │   ├── auth/           # Authentication components
│   │   ├── availability/   # Availability status management
│   │   ├── bookings/       # Resource booking and scheduling
│   │   ├── dutyCrew/       # Duty crew scheduling and station checks
│   │   ├── equipment/      # Equipment stock management
│   │   ├── fireReports/    # Fire report forms and management
│   │   ├── hoses/          # Hose inventory management
│   │   ├── keys/           # Key register
│   │   ├── kiosk/          # Kiosk mode components (gate control, etc.)
│   │   ├── qrCodes/        # QR code generation and management
│   │   └── vehicleFaults/  # Vehicle fault tracking and management
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions and monitoring
│   ├── pages/              # Top-level page components
│   ├── App.tsx             # Root component with routing
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles and Tailwind setup
├── docs/                   # Documentation
├── rules/                  # AI assistant rules and guidelines
├── scripts/                # Utility scripts
├── .env.local              # Local environment variables
├── components.json         # shadcn/ui configuration
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
├── vite.config.ts          # Vite and PWA configuration
└── README.md               # This file
```

## Features

BRAVO is built with a modular, feature-based architecture and comprehensive permission system.

### Core Modules:

#### **Dashboard**
*   Personalized overview with pending actions and reminders
*   Quick access to common tasks
*   Available to all authenticated users

#### **Availability Management**
*   Real-time member availability status tracking
*   Multiple status options (Available, Unavailable, Responding, etc.)
*   Automatic daily reset with push notifications (4:00 AM AEST)
*   Duty Officer self-service (officers can take over without admin)
*   Appliance location tracking (Main Station/Satellite Station)
*   Skills-based filtering and display

#### **Hose Inventory Management**
*   Complete hose tracking (ID, length, size, type, test date, status)
*   Automatic status management based on test dates (365-day cycle)
*   Comprehensive history logging with audit trail
*   Comment system for maintenance notes
*   Status synchronization tools for admins
*   Minimum rank: Probationary

#### **Key Register**
*   Protected premises key management
*   Key location tracking and assignment
*   Access history and audit logging
*   Minimum rank: Probationary

#### **Duty Crew Management**
*   Sunday duty crew scheduling (4 crews + working bee)
*   Automatic crew assignment by week of month
*   Crew member and leader tracking
*   Station check templates with customisable check items
*   Check history tracking and reporting
*   This week's crew shown inline on the Availability Brigade tab
*   Minimum rank: Probationary

#### **Appliance Checks**
*   Customizable check templates for Pumper, Tanker, FCV
*   Template editor with item management
*   Check run tracking with pass/fail/N/A status
*   Concurrency control (one active run per template)
*   Recent runs history and reporting
*   Minimum rank: Probationary

#### **Bookings**
*   Resource booking system for shared brigade assets (vehicles, facilities, equipment)
*   Admin-configurable resources with optional approval workflows
*   Weekly schedule view with conflict detection
*   Multi-day and single-day bookings with time ranges
*   Inline calendar date picker and form validation (React Hook Form + Zod)
*   Minimum rank: Probationary

#### **Vehicle Faults**
*   Fault reporting for all appliances with file attachments
*   EAM request number tracking
*   Status workflow (reported → logged → in progress → completed)
*   Comments, comprehensive audit trail, and change history
*   Vehicle type administration for managing the fleet inventory
*   Admin-only deletion
*   Minimum rank: Probationary

#### **Fire Reports**
*   Comprehensive incident reporting
*   Draft and submitted states
*   Multi-section forms (incident details, property info, casualties, etc.)
*   Photo upload support
*   Integration with CFA systems
*   Minimum rank: Probationary

#### **Settings**
*   Personal profile management
*   Skills selection with "None" option for non-operational members
*   Notification preferences
*   Available to all authenticated users

#### **Admin Tools**
*   User management and permissions
*   Module access control (role and rank-based)
*   Appliance location management
*   System health monitoring
*   Push notification testing
*   Hose status synchronization
*   Admin-only access

#### **Additional Modules**

Added since the detailed sections above were written. Descriptions are deliberately brief — read
the feature directory and `docs/README.md` rather than trusting a summary here.

*   **Action Centre** (`actionCentre`) — personal work queue aggregating outstanding obligations across modules (availability, RSVPs, tasks, duty crew, notices)
*   **Events** (`events`) — one-off brigade events with RSVPs, shifts/slots, team leaders and post-event attendance confirmation
*   **Inventory** (`inventory`) — appliance inventory checks; the backend tables are named `appliance*` (see Database Schema)
*   **Member Records** (`memberRecords`) — kit register tracking gear issued to members
*   **Calendar** (`calendar`) — month view overlaying Events and Bookings, with CalDAV write support
*   **Contacts** (`contacts`), **QR Codes** (`qrCodes`), **Equipment** (`equipment`), **BA Skills** (`baSkills`), **Kiosk** (`kiosk`, wall-mounted station tablets), **Service Accounts** (`serviceAccounts`)

`ls src/features` is the authoritative list.

### Permission System

*   **Role-based access control**: Admin, Officer, Member roles
*   **Rank-based requirements**: Minimum rank per module. Ranks ascend: Brigade Member → Probationary → Firefighter → Lieutenant → Captain (`Brigade Member` is the non-operational floor rank and the signup default)
*   **Module-level control**: Global enable/disable per feature
*   **Route protection**: Both navigation hiding and direct URL blocking
*   **Real-time permission checking**: Dynamic access control

## Backend Details (Convex)

The backend is built with Convex and resides in the `convex/` directory.

### Database Schema (`convex/schema.ts`)

Comprehensive data models including:

*   **User Management**: `users`, `userSkills`, `skills`, `userRoles`, `roles`
*   **Availability**: `availabilityStatuses`, `dutyOfficer`, `applianceLocations`
*   **Equipment**: `hoses`, `hoseHistory`, `hoseComments`, `keys`, `keyHistory`, `keyComments`
*   **Bookings**: `bookingResources`, `bookings` with approval workflows
*   **Duty Crew**: `dutyCrew`, `dutyCrewSchedule`, `stationChecks`, `stationCheckSubitems`, `stationCheckAllocations`, `stationCheckSubmissions`
*   **Appliances / Inventory**: `applianceTemplates`, `applianceSections`, `applianceItems`, `applianceCheckRuns`, `applianceCheckRunItems`, `applianceLocations`
*   **Vehicle Faults**: `vehicleFaults`, `vehicleFaultComments`, `vehicleFaultAttachments`, `vehicleFaultVehicleTypes`
*   **Fire Reports**: `fireReports` with comprehensive incident tracking
*   **Permissions**: `moduleSettings` for access control
*   **Notifications**: `pushSubscriptions` for web push

> Table names drift. `convex/schema.ts` is the only authority — check there before relying on any
> name listed here.

### Backend Functions

*   **Queries and Mutations**: Feature-organized functions for all CRUD operations
*   **Scheduled Tasks**: Daily availability reset cron job (4:00 AM AEST)
*   **Push Notifications**: Web push integration using `web-push` package

### Authentication

*   **Provider**: [Convex Auth](https://docs.convex.dev/auth) — built-in auth system via `@convex-dev/auth`
*   **Configuration**: `convex/auth.config.ts` defines authentication providers (currently using the self-hosted Convex domain)
*   **Frontend Integration**: `ConvexAuthProvider` in `src/main.tsx` manages auth state across the app
*   **Environment Variables**:
    *   Backend: `CONVEX_SITE_URL` — the URL of your self-hosted Convex instance

## Frontend Details (Vite + React)

The frontend is built with Vite, React, and TypeScript, located in the `src/` directory.

### Architecture

*   **Entry Point**: `src/main.tsx` with Convex Auth and Convex providers
*   **Root Component**: `src/App.tsx` with protected routing
*   **Layouts**: 
    *   `MainLayout` - Authenticated app with navigation
    *   `AuthLayout` - Clean authentication pages without navbar
*   **Components**: shadcn/ui base components with custom extensions
*   **Features**: Feature-based organization (e.g., `src/features/hoses/`)
*   **Styling**: Tailwind CSS with dark mode support

### Key Frontend Features

*   **Protected Routes**: Permission-based route protection with `ProtectedRoute` component
*   **Dark Mode**: Full dark mode support with subtle input backgrounds (`dark:bg-white/5`)
*   **Responsive Design**: Mobile-first approach with tablet and desktop optimizations
*   **Real-time Updates**: Convex reactive queries for live data
*   **Form Validation**: Schema-based validation with React Hook Form + Zod — inline field-level errors, cross-field validation (e.g. date ranges), and type-safe form state. See Bookings module forms as the reference implementation.
*   **Shared Components**: `ResponsiveModal` (Drawer on mobile, Sheet on desktop), `DatePicker` (inline collapsible calendar), `EmptyState`, `DeleteConfirmDialog`, `PageTabs` — reusable across all modules
*   **Accessibility**: ARIA labels, keyboard navigation, screen reader support

## Progressive Web App (PWA)

The frontend is configured as an installable PWA via [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/):

*   `vite.config.ts` registers the plugin with `strategies: "generateSW"`.
*   The generated service-worker precaches build assets.
*   A custom push handler is imported via `workbox.importScripts` and lives in `public/sw-push.js`.
*   `public/manifest.json` defines icons, theme colours, and `display: "standalone"`, allowing the site to be installed on iOS/Android/Desktop.

During development Vite serves a temporary worker at `/dev-dist/dev-sw.js`; the same service-worker logic (including push handling) is available in dev via `devOptions.enabled: true`.

### Offline support

The precache list contains all static assets needed to render the application shell. Dynamic data is fetched from Convex APIs and will appear once online.

## Push Notifications

### Registration (client)

`usePushRegister` hook requests browser permission, subscribes to `navigator.serviceWorker.ready.pushManager`, and stores the subscription in Convex via `pushNotifications.register`.

### Backend sending

*   Node-only package `web-push` is used inside `convex/pushNotificationAction.ts` (annotated with `"use node"`).
*   The action fetches subscriptions and sends notifications; stale subscriptions are cleaned up automatically.

### Testing UI

`NotificationTester` component on the Admin page lets admins broadcast a test notification from the browser.

### Automatic "daily reset" notifications

*   `availabilityResetAction.ts` clears every member's `currentStatus` each day and notifies them to update it.
*   Scheduled via `convex/crons.ts` – runs at 04:00 AEST (18:00 UTC). Edit the UTC time to suit your region.
*   Sends push notifications to all registered devices
*   Critical for maintaining accurate availability data for emergency response
*   Analytics tracked via PostHog (delivery rates, success/failure, performance)

### VAPID keys

Generate once with `npx web-push generate-vapid-keys` and set:

*   `.env.local`  `VITE_VAPID_PUBLIC_KEY` ( for the browser)
*   Convex env      `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (in the Convex dashboard)

## Deployment

### Production Architecture

This project uses a split deployment model:

| Layer | Where | How |
|---|---|---|
| **Frontend** | [Vercel](https://vercel.com) | Auto-deploys on merge to `main` via GitHub integration — environment variables are managed in the **Vercel dashboard**, not in this repo |
| **Backend** | Self-hosted VPS (BinaryLane) | Convex running in a Docker container, deployed via `npm run deploy:convex:vps` |

> **Important for contributors/AI assistants**: Frontend environment variables (e.g. `VITE_CONVEX_URL`, `VITE_VAPID_PUBLIC_KEY`) live in Vercel's dashboard, not in `.env` files in this repo. If the frontend isn't picking up a change, check Vercel environment variables first.

### Deploy Backend to VPS

```bash
npm run deploy:convex:vps
```

This pushes all Convex functions and schema changes to the self-hosted Convex instance on the VPS. **This targets the live production instance.** Verify on the UAT tier first — see `docs/runbooks/uat-environment.md`.

### Deploy Frontend to Vercel

Frontend deploys are triggered automatically — Vercel is connected to the private GitHub repository and builds on every merge to `main`. There is no manual deploy step for the frontend.

Vercel bakes `VITE_*` environment variables into the build at build time. After changing a Vercel env var you must trigger a redeploy for it to take effect.

See [docs/reference/convex-setup.md](./docs/reference/convex-setup.md) for detailed VPS/Docker setup instructions.

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended)
*   [npm](https://www.npmjs.com/) (comes with Node.js)
*   [Convex CLI](https://docs.convex.dev/getting-started/installation#install-the-convex-cli): `npm install -g convex` (used for schema/function pushes)

Docker is **not** required for development. Running Convex locally in Docker was retired — see
[docs/reference/convex-setup.md](./docs/reference/convex-setup.md). Docker is only relevant on the
VPS itself, and for `npm run backup:drill`, which spins up a throwaway container to verify backups.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd bravo
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Obtain the environment files. Backend targets are selected by **env file + Vite mode**, and the
    files are gitignored — you need copies from the maintainer:

    | File | Selects | Used by |
    |---|---|---|
    | `.env.vps` | **live production** (self-hosted VPS) | `dev:vps:frontend`, `deploy:convex:vps`, `export:vps` |
    | `.env.cloud` | UAT (`precious-magpie-647`) | `dev:uat`, `build:cloud` |
    | `.env.local` | local overrides (lowest priority) | all modes |

    Only `.env` is committed. **[docs/reference/environments.md](./docs/reference/environments.md)
    explains what belongs in each file** — in particular that variables live in three distinct
    places (frontend build-time `VITE_*`, Convex CLI target selection, and deployment runtime set
    via `npx convex env set`), and that several entries in `.env.vps` are CLI-local leftovers the
    backend never reads.

    Running Convex locally in Docker is **retired, not impossible** — the `*:docker` scripts were
    removed to cut maintenance, but nothing in the app requires a remote backend. That doc has what
    you'd need to revive it.

4.  Generate VAPID keys for push notifications (only when standing up a **new** deployment —
    existing deployments already have them):
    ```bash
    npm run keys:generate     # or: npx web-push generate-vapid-keys
    ```

### Running Locally

**Frontend only (most common):**
```bash
npm run dev:frontend
```
Starts the Vite dev server pointing at the production VPS backend (`https://boss-convex.grayhux.io`). This is the standard way to develop and test frontend changes locally.

**Backend changes:**
```bash
npm run deploy:convex:vps
```
Deploys Convex functions and schema to the VPS (live production). Promote via the UAT tier rather than deploying straight from a feature branch — see `docs/runbooks/uat-environment.md`.

### Development Workflow

*   **Frontend changes**: Run `npm run dev:frontend` — Vite HMR gives instant hot reloads, connected to the live VPS backend
*   **Backend changes**: Edit Convex functions then run `npm run deploy:convex:vps` to push to VPS
*   **Schema changes**: Deployed along with backend via `deploy:convex:vps`
*   **Type safety**: Full TypeScript support — run `npx tsc --noEmit` to check before deploying
*   **Vercel env vars**: If frontend behaviour looks wrong in production but fine locally, check Vercel dashboard environment variables — they are not stored in this repo

### Linting and Type Checking

The toolchain is **Vite+** (`vp` CLI wrapping Vite 8 / Vitest / Oxlint), not plain Vite. Lint rules
live in the `lint` block of `vite.config.ts` — not `.oxlintrc.json` or ESLint (removed). Formatting
is Prettier; there is no `npm run format` script.

```bash
npm run lint        # full gate: oxlint + typecheck + tests + Convex codegen + production build
npm run lint:code   # oxlint only (also runs in the husky pre-commit)
npm run typecheck   # TypeScript only, across convex/ + app + node configs
npm run test        # Vitest (frontend utils + convex-test backend tests)
```

`vp lint` must stay at **zero warnings** — warnings don't fail CI, so the baseline is convention.
See [docs/reference/linting.md](./docs/reference/linting.md).

### Version Management

```bash
# Sync version to today's build date (YYYY.MM.DD)
npm run version:sync

# The local pre-commit hook also syncs and stages package.json automatically
git commit -m "Your change"
```

## Documentation

**[docs/README.md](./docs/README.md) is a generated index of all documentation**, grouped by status.
Start there — it is the authority on what is implemented and what is only planned. Status lives in
each doc's YAML frontmatter, not in its prose. After adding or editing a doc, run `npm run docs:index`
to validate and regenerate; never hand-edit `docs/README.md`.

Docs are organised by kind: `docs/plans/` (proposed, in-flight, completed work) ·
`docs/reference/` (how things work today) · `docs/runbooks/` (operational procedures) ·
`docs/audits/` (point-in-time assessments) · `docs/archive-pre-2026/` (historical, unindexed).

### Start here
*   **[docs/reference/environments.md](./docs/reference/environments.md)**: which backend each command talks to — **read before running anything that touches a backend**
*   **[docs/reference/convex-setup.md](./docs/reference/convex-setup.md)**: Detailed Convex deployment guide
*   **[docs/reference/creating-new-modules.md](./docs/reference/creating-new-modules.md)**: Guide for adding new features
*   **[docs/reference/performance-optimization.md](./docs/reference/performance-optimization.md)**: Performance best practices
*   **[docs/archive-pre-2026/ADD_MODULE_TO_PERMISSIONS.md](./docs/archive-pre-2026/ADD_MODULE_TO_PERMISSIONS.md)**: Permission system integration

### Analytics & Monitoring
*   **[docs/archive-pre-2026/POSTHOG_NOTIFICATION_ANALYTICS.md](./docs/archive-pre-2026/POSTHOG_NOTIFICATION_ANALYTICS.md)**: PostHog analytics setup and usage
*   **[docs/archive-pre-2026/sentrysetup.md](./docs/archive-pre-2026/sentrysetup.md)**: Sentry error tracking configuration

### Multi-Brigade Architecture (Future)
*   **[docs/archive-pre-2026/MULTI_BRIGADE_SUMMARY.md](./docs/archive-pre-2026/MULTI_BRIGADE_SUMMARY.md)**: Executive summary of multi-brigade support
*   **[docs/archive-pre-2026/MULTI_BRIGADE_MIGRATION.md](./docs/archive-pre-2026/MULTI_BRIGADE_MIGRATION.md)**: Complete migration guide
*   **[docs/archive-pre-2026/multi-brigade/](./docs/archive-pre-2026/multi-brigade/)**: Detailed phase-by-phase implementation guides

> **Note**: BRAVO currently supports a single brigade (Wyndham Vale Fire Brigade). The multi-brigade documentation outlines the architecture and effort required to support multiple brigades in the future.

## Support and Maintenance

This system is designed for the Wyndham Vale Fire Brigade and CFA volunteer operations. For issues, feature requests, or contributions, please contact the development team.

## License

(Add license information as appropriate)

---
