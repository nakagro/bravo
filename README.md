# Brigade Availability and Operations (BRAVO)

BRAVO (BRigade AVailability and Operations) is a comprehensive brigade management system designed for CFA (Country Fire Authority) volunteer fire brigades in Victoria, Australia, developed for the Wyndham Vale Fire Brigade. It provides a complete suite of tools for managing brigade operations, equipment, personnel, and emergency response readiness.

This system is built using [Vite](https://vitejs.dev/) (with React and TypeScript) for the frontend and [Convex](https://convex.dev/) as the backend. The Convex backend supports both self-hosted Docker deployment and Convex Cloud.

## Purpose of this Document

This README serves as a guide for developers, contributors, and AI assistants (like Cascade) to understand the project's architecture, features, and setup. Providing this context helps in efficiently developing, debugging, and extending the application.

## Technology Stack

*   **Frontend**: [Vite](https://vitejs.dev/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **Backend**: [Convex](https://convex.dev/) (Self-hosted via Docker or Convex Cloud)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Routing**: [React Router DOM](https://reactrouter.com/)
*   **UI Components**: [shadcn/ui](https://ui.shadcn.com/) with custom components
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Notifications**: [Sonner](https://sonner.emilkowal.ski/) for toasts/notifications
*   **Authentication**: [Auth0](https://auth0.com/) via [@convex-dev/auth](https://auth.convex.dev/)
*   **Monitoring**: Health check endpoints with external monitoring support (Healthcheck.io, Zabbix, Uptime Kuma)

## Development and Deployment

For detailed instructions on developing and deploying with both local Docker-based Convex and Convex Cloud, see [CONVEX-SETUP.md](./CONVEX-SETUP.md).

## Project Structure

```
/var/www/vite-convex-test
├── convex/                 # Backend Convex functions, schema, and configuration
│   ├── _generated/         # Auto-generated Convex files
│   ├── features/           # Backend logic organized by feature
│   │   ├── auth/           # Authentication logic
│   │   └── hoses/          # Hose management backend
│   ├── availability/       # Availability status management
│   ├── auth.config.ts      # Auth0 provider configuration
│   ├── auth.ts             # Custom authentication logic
│   ├── crons.ts            # Scheduled tasks (daily availability reset)
│   ├── dutyCrew.ts         # Duty crew management
│   ├── fireReports.ts      # Fire report system
│   ├── hoses.ts            # Hose inventory queries and mutations
│   ├── http.ts             # HTTP endpoints (health checks, webhooks)
│   ├── keys.ts             # Key register management
│   ├── modules.ts          # Permission system and module access control
│   ├── schema.ts           # Complete database schema
│   ├── skills.ts           # User skills management
│   ├── vehicleFaults.ts    # Vehicle fault tracking
│   └── ...                 # Additional backend modules
├── public/                 # Static assets and PWA configuration
│   ├── icons/              # PWA icons and favicons
│   ├── manifest.json       # PWA manifest
│   └── sw-push.js          # Push notification service worker
├── src/                    # Frontend application code
│   ├── components/         # Reusable UI components
│   │   ├── admin/          # Admin-specific components
│   │   ├── common/         # Shared components
│   │   ├── layout/         # Layout components (MainLayout, AuthLayout)
│   │   └── ui/             # shadcn/ui base components
│   ├── features/           # Feature-based modules
│   │   ├── admin/          # Admin dashboard and tools
│   │   ├── applianceChecks/ # Appliance check templates and runs
│   │   ├── auth/           # Authentication components
│   │   ├── availability/   # Availability status management
│   │   ├── dutyCrew/       # Duty crew scheduling
│   │   ├── fireReports/    # Fire report forms and management
│   │   ├── hoses/          # Hose inventory management
│   │   └── keys/           # Key register
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
*   Minimum rank: Probationary

#### **Appliance Checks**
*   Customizable check templates for Pumper, Tanker, FCV
*   Template editor with item management
*   Check run tracking with pass/fail/N/A status
*   Concurrency control (one active run per template)
*   Recent runs history and reporting
*   Minimum rank: Probationary

#### **Vehicle Faults**
*   Fault reporting for all appliances
*   EAM request number tracking
*   Status workflow (reported → logged → in progress → completed)
*   Comprehensive audit trail
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

### Permission System

*   **Role-based access control**: Admin, Officer, Member roles
*   **Rank-based requirements**: Minimum rank per module (Probationary, Firefighter, etc.)
*   **Module-level control**: Global enable/disable per feature
*   **Route protection**: Both navigation hiding and direct URL blocking
*   **Real-time permission checking**: Dynamic access control

## Backend Details (Convex)

The backend is built with Convex and resides in the `convex/` directory.

### Database Schema (`convex/schema.ts`)

Comprehensive data models including:

*   **User Management**: `users`, `userSkills`, `skills`, `userRoles`, `roles`
*   **Availability**: `availabilityStatuses`, `dutyOfficer`, `applianceLocations`
*   **Equipment**: `hoses`, `hoseHistory`, `hoseComments`, `keys`, `keyHistory`
*   **Duty Crew**: `dutyCrew`, `dutyCrewSchedule`
*   **Appliances**: `applianceCheckTemplates`, `applianceCheckRuns`, `applianceCheckItems`, `vehicleFaults`
*   **Fire Reports**: `fireReports` with comprehensive incident tracking
*   **Permissions**: `modules` for access control
*   **Notifications**: `pushSubscriptions` for web push

### Backend Functions

*   **Queries and Mutations**: Feature-organized functions for all CRUD operations
*   **Scheduled Tasks**: Daily availability reset cron job (4:00 AM AEST)
*   **Push Notifications**: Web push integration using `web-push` package

### Authentication

*   **Provider**: Auth0 integration via `@convex-dev/auth`
*   **Configuration**: `convex/auth.config.ts` for Auth0 setup
*   **Environment Variables**: 
    *   Backend: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`
    *   Frontend: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`

## Frontend Details (Vite + React)

The frontend is built with Vite, React, and TypeScript, located in the `src/` directory.

### Architecture

*   **Entry Point**: `src/main.tsx` with Auth0 and Convex providers
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
*   **Form Validation**: Comprehensive validation with user feedback
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

### VAPID keys

Generate once with `npx web-push generate-vapid-keys` and set:

*   `.env.local`  `VITE_VAPID_PUBLIC_KEY` ( for the browser)
*   Convex env      `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (in the Convex dashboard)

## Deployment

### Backend (Convex)

Two deployment options:

1. **Self-hosted Docker**: Deploy Convex as a Docker container on your infrastructure
   *   Local URL: `https://convex.grayhux.io/http`
   *   Full control over data and infrastructure
   *   Requires Docker and container orchestration

2. **Convex Cloud**: Deploy to Convex's managed cloud service
   *   Cloud URL: `https://whimsical-hamster-488.convex.cloud`
   *   Simplified deployment and scaling
   *   Managed infrastructure

See [CONVEX-SETUP.md](./CONVEX-SETUP.md) for detailed deployment instructions.

### Frontend (Vite)

*   Build: `npm run build`
*   Output: Static assets in `dist/` directory
*   Deploy to: Any static hosting (Vercel, Netlify, etc.) or serve via backend
*   PWA support: Automatically generates service worker and manifest

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended)
*   [npm](https://www.npmjs.com/) (comes with Node.js)
*   [Docker](https://www.docker.com/get-started) and Docker Compose (recommended)
*   [Convex CLI](https://docs.convex.dev/getting-started/installation#install-the-convex-cli): `npm install -g convex` (used for schema/function pushes and local development utilities)

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd vite-convex-test
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables in `.env.local`:
    ```bash
    # Convex Backend
    CONVEX_DEPLOYMENT="http://localhost:YOUR_CONVEX_DOCKER_PORT"
    VITE_CONVEX_URL="http://localhost:YOUR_CONVEX_DOCKER_PORT"
    
    # Auth0
    AUTH0_DOMAIN="your-domain.auth0.com"
    AUTH0_CLIENT_ID="your-client-id"
    VITE_AUTH0_DOMAIN="your-domain.auth0.com"
    VITE_AUTH0_CLIENT_ID="your-client-id"
    
    # VAPID Keys (for push notifications)
    VITE_VAPID_PUBLIC_KEY="your-public-key"
    # Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Convex dashboard
    ```

4.  Generate VAPID keys for push notifications:
    ```bash
    npx web-push generate-vapid-keys
    ```

5.  Set up Convex backend:
    *   For Docker: Ensure container is running (`docker-compose up -d`)
    *   For Cloud: Follow Convex Cloud setup in [CONVEX-SETUP.md](./CONVEX-SETUP.md)

6.  Initialize database (optional):
    ```bash
    npm run setup
    ```

### Running Locally

1.  **Start Convex backend**:
    *   Docker: `docker-compose up -d`
    *   Cloud: Already running

2.  **Start development servers**:
    ```bash
    npm run dev
    ```

    This command:
    *   Initializes Convex connection
    *   Runs setup scripts
    *   Starts Vite dev server (frontend)
    *   Watches Convex functions for changes (backend)

3.  **Access the application**:
    *   Opens automatically in your default browser
    *   Default URL: `http://localhost:5173`
    *   Connects to configured Convex backend

### Development Workflow

*   **Frontend changes**: Hot module replacement (HMR) via Vite
*   **Backend changes**: Automatic push to Convex on save
*   **Schema changes**: Automatically applied to Convex database
*   **Type safety**: Full TypeScript support across frontend and backend

### Linting and Type Checking

```bash
# Type checking
npm run lint

# Format code (if configured)
npm run format
```

### Version Management

```bash
# Increment feature version
npm run increment:feature

# Increment major version
npm run increment:major
```

## Documentation

Additional documentation available in the `docs/` directory:

*   **[CONVEX-SETUP.md](./CONVEX-SETUP.md)**: Detailed Convex deployment guide
*   **[PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)**: Performance best practices
*   **[docs/creating-new-modules.md](./docs/creating-new-modules.md)**: Guide for adding new features
*   **[docs/ADD_MODULE_TO_PERMISSIONS.md](./docs/ADD_MODULE_TO_PERMISSIONS.md)**: Permission system integration

## Support and Maintenance

This system is designed for the Wyndham Vale Fire Brigade and CFA volunteer operations. For issues, feature requests, or contributions, please contact the development team.

## License

(Add license information as appropriate)

---
