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

See [Running your own copy](#running-your-own-copy) below.

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
the feature directory rather than trusting a summary here.

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

## Running your own copy

BRAVO is built for one brigade per deployment: a Convex backend plus a static frontend.

### Prerequisites

*   [Node.js](https://nodejs.org/) 24 LTS (pinned in `.nvmrc`) and npm
*   A [Convex](https://convex.dev/) deployment: Convex Cloud, or [self-hosted](https://github.com/get-convex/convex-backend/tree/main/self-hosted) in Docker
*   Somewhere to host a static site (Vercel, Netlify, any web server)

### 1. Install

```bash
git clone https://github.com/nakagro/bravo.git
cd bravo
npm install
```

### 2. Create and configure the backend

```bash
npx convex dev --once            # creates/links a deployment and pushes the schema and functions
npx @convex-dev/auth             # sets the auth keys (JWT_PRIVATE_KEY, JWKS, SITE_URL)
npx web-push generate-vapid-keys # keys for push notifications
```

Set the backend's environment variables with `npx convex env set NAME value`:

| Variable | Needed for |
|---|---|
| `FRONTEND_URL` | Links in emails (your site's URL) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push notifications |
| `RESEND_API_KEY` | Sign-up, password-reset and notification emails (optional) |
| `POSTHOG_API_KEY`, `POSTHOG_HOST` | Notification analytics (optional) |
| `CALDAV_URL`, `CALDAV_USERNAME`, `CALDAV_PASSWORD` | Calendar sync (optional) |
| `EMAIL_ALLOWLIST` | Test deployments only: drops mail to anyone not listed. Never set it in production |

### 3. Configure and build the frontend

Frontend settings are `VITE_*` variables. **They are built into the JavaScript every visitor
downloads, so never put a secret in one.** Put them in `.env.vps` for local use (gitignored), and in
your host's dashboard for production builds.

| Variable | Needed for |
|---|---|
| `VITE_CONVEX_URL` | Your Convex deployment URL (required) |
| `VITE_VAPID_PUBLIC_KEY` | Push notifications (the public half only) |
| `VITE_HCAPTCHA_SITE_KEY` | Sign-in captcha; set your own, or `VITE_DISABLE_CAPTCHA=true` |
| `VITE_PUBLIC_POSTHOG_KEY`, `VITE_PUBLIC_POSTHOG_HOST` | Analytics (optional) |
| `VITE_GATE_API_BASE`, `VITE_GATE_MOCK` | Station door control on the kiosk (optional, station-specific) |

```bash
npm run dev:vps:frontend   # local dev server against the backend in .env.vps
npm run build              # production build into dist/
```

### 4. First sign-in

Sign up through the app, then make that account an admin by setting `isAdmin: true` on your user in
the Convex dashboard's Data view. From **Admin Settings** you can then set up ranks and roles,
module access, service accounts for shared station tablets, links and the contact book.

### Notes

*   Push-notification reset times and the duty week are set for Melbourne time; see
    `convex/lib/dates.ts` and `convex/crons.ts`.
*   Contact lists and other personal data belong in your Convex deployment behind sign-in (for
    example **Admin Settings → Contact Book**), never in `public/` or the repository.

## Development

```bash
npm run lint        # full gate: oxlint + typecheck + tests + Convex codegen + production build
npm run lint:code   # oxlint only (also runs in the husky pre-commit)
npm run typecheck   # TypeScript only
npm run test        # Vitest (frontend utils + convex-test backend tests)
```

The toolchain is **Vite+** (`vp` CLI wrapping Vite 8, Vitest and Oxlint). Lint rules live in the
`lint` block of `vite.config.ts`, and `vp lint` must stay at zero warnings. The pre-commit hook syncs
the date-based version in `package.json` and, if [gitleaks](https://github.com/gitleaks/gitleaks) is
installed, scans staged changes for secrets and personal data (`.gitleaks.toml`). CI runs the same
scan.

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request, and
[SECURITY.md](./SECURITY.md) to report a vulnerability.

## License

BRAVO is free software, licensed under the [GNU Affero General Public License v3.0](./LICENSE)
(AGPL-3.0-only). You may use, modify and host it, including for other brigades. If you run a
modified version for other people, you must make your modified source available to them under the
same licence.
