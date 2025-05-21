# Brigade Management System

This project is a comprehensive Brigade Management System designed to assist CFA (Country Fire Authority) volunteer fire brigades in Victoria, Australia, starting with the Wyndham Vale Fire Brigade. It aims to manage various aspects of brigade operations, evolving from an initial focus on hose inventory to a broader suite of tools.

This system is built using [Vite](https://vitejs.dev/) (with React and TypeScript) for the frontend and [Convex](https://convex.dev/) as the backend. The Convex backend is self-hosted and managed via a Docker container.

This project was initially bootstrapped using a template (potentially related to 'flex-template' or 'Chef').

## Purpose of this Document

This README serves as a guide for developers, contributors, and AI assistants (like Cascade) to understand the project's architecture, features, and setup. Providing this context helps in efficiently developing, debugging, and extending the application.

## Technology Stack

*   **Frontend**: [Vite](https://vitejs.dev/), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **Backend**: [Convex](https://convex.dev/) (Self-hosted via Docker)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Routing**: [React Router DOM](https://reactrouter.com/)
*   **UI Components**: Custom components, potentially using libraries like [clsx](https://github.com/lukeed/clsx) for conditional class names and [tailwind-merge](https://github.com/dcastil/tailwind-merge) for merging Tailwind classes.
*   **Notifications**: [Sonner](https://sonner.emilkowal.ski/) for toasts/notifications.
*   **Authentication**: [@convex-dev/auth](https://auth.convex.dev/)

## Development and Deployment

For detailed instructions on developing and deploying with both local Docker-based Convex and Convex Cloud, see [CONVEX-SETUP.md](./CONVEX-SETUP.md).

## Project Structure

```
/var/www/vite-convex-test
├── convex/                 # Backend Convex functions, schema, and configuration
│   ├── _generated/         # Auto-generated Convex files
│   ├── features/           # Backend logic for specific features (planned)
│   ├── auth.config.ts      # Authentication provider configuration
│   ├── auth.ts             # Custom authentication logic
│   ├── hoses.ts            # Queries and mutations for hoses
│   ├── hoseComments.ts     # Queries and mutations for hose comments
│   ├── http.ts             # HTTP action endpoints
│   └── schema.ts           # Convex database schema definition
├── public/                 # Static assets
├── src/                    # Frontend application code (Vite + React)
│   ├── components/         # Reusable UI components
│   │   └── ui/             # Base UI elements (e.g., buttons, inputs)
│   ├── features/           # Frontend logic and components for specific features
│   │   ├── auth/
│   │   └── hoses/
│   ├── lib/                # Utility functions and helpers
│   ├── main.tsx            # Main entry point for the React application
│   ├── App.tsx             # Root React component, sets up routing
│   ├── pages/              # Top-level page components
│   └── index.css           # Global styles and Tailwind CSS setup
├── .env.local              # Local environment variables (e.g., Convex keys)
├── components.json         # Potentially for UI component generation (e.g. shadcn/ui)
├── eslint.config.js        # ESLint configuration
├── index.html              # Main HTML file for Vite
├── package.json            # Project dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration (root)
├── tsconfig.app.json       # TypeScript configuration for the app
├── vite.config.ts          # Vite configuration
└── README.md               # This file
```

## Features

The system is being developed in a modular, feature-based manner.

### Current Features:

*   **Hose Inventory Management**:
    *   Tracking individual fire hoses (ID, length, size, type, test date, status).
    *   Recording hose history (status changes, replacements, etc.).
    *   Adding comments to hoses.
    *   User authentication to track who made changes.

### Planned Features:

*   **Duty Crew Checks**: Managing and recording checks for duty crews.
*   **Appliance Checks**: Tracking and managing checks for fire trucks (appliances).
*   **Availability Screen**: A system for members to indicate their turnout status/availability.
*   **Key Register**: Management for keys to protected premises.

## Backend Details (Convex)

The backend is built with Convex and resides in the `convex/` directory.

*   **Schema (`convex/schema.ts`)**: Defines the data models, including:
    *   `users`: Extends `@convex-dev/auth` user table with CFA-specific fields like `firstName`, `lastName`, and `memberNumber`.
    *   `hoses`: Stores detailed information about each fire hose.
    *   `hoseHistory`: Logs changes made to hose records.
    *   `hoseComments`: Stores comments related to specific hoses.
*   **Queries and Mutations**: Located in files like `convex/hoses.ts` and `convex/hoseComments.ts`, these functions handle data interaction with the Dockerized Convex instance.
*   **Authentication**: Uses `@convex-dev/auth`. Configuration in `convex/auth.config.ts` should be reviewed for the self-hosted environment.

## Frontend Details (Vite + React)

The frontend is built with Vite, React, and TypeScript, located in the `src/` directory.

*   **Entry Point**: `src/main.tsx` initializes the React application.
*   **Root Component**: `src/App.tsx` sets up the main application layout and routing.
*   **Components**: Reusable UI elements are in `src/components/`.
*   **Features**: Feature-specific modules are organized under `src/features/` (e.g., `src/features/hoses/`).
*   **Pages**: Top-level views are in `src/pages/`.
*   **Styling**: Tailwind CSS is used for styling, configured in `tailwind.config.js` and `src/index.css`.

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
2.  Install frontend dependencies:
    ```bash
    npm install
    ```
3.  Set up Convex (Self-hosted Docker):
    *   Ensure your Convex Docker container is built and running. (Refer to your project's Docker setup for specific instructions, e.g., `docker-compose up -d` if you have a `docker-compose.yml`.)
    *   The Convex CLI will be used to interact with this local Docker instance (e.g., for pushing schema changes).
    *   Configure your `.env.local` file. It should contain the URL for your local Convex Docker instance. The `CONVEX_DEPLOYMENT` variable, when using the CLI with a self-hosted instance, typically points to this local URL (e.g., `http://localhost:8000` or as configured).
    Example `.env.local`:
    ```
    CONVEX_DEPLOYMENT="http://localhost:YOUR_CONVEX_DOCKER_PORT"
    # Ensure VITE_CONVEX_URL in your frontend's .env files also points to this local Docker instance during development
    ```

### Running Locally

1.  **Start your Convex Docker container**: Ensure it's running and accessible at the configured URL (e.g., `http://localhost:YOUR_CONVEX_DOCKER_PORT`).
2.  **Start the development servers** for both frontend (Vite) and Convex CLI utilities (for schema/function updates):

```bash
npm run dev
```

This command typically performs the following:
*   `convex dev --local --once`: Initializes or checks the connection with your Convex backend. With a self-hosted setup, this command (and `dev:backend`) should be configured to target your Dockerized Convex instance, often via the `CONVEX_DEPLOYMENT` environment variable or by having the CLI point to the local Convex data directory used by Docker.
*   `node setup.mjs`: (Likely for initial configuration or checks).
*   `npm-run-all --parallel dev:frontend dev:backend`:
    *   `dev:frontend`: `vite --open` - Starts the Vite frontend development server.
    *   `dev:backend`: `convex dev --local` - Watches for changes in your `convex/` directory and pushes them to your (Dockerized) Convex backend.

Your application should open in your default browser, connecting to the self-hosted Convex backend.

### Linting and Type Checking

To lint the code and check for TypeScript errors:

```bash
npm run lint
```

This script usually runs `tsc` for type checking on both frontend and Convex code. `convex dev --once` as part of this script will interact with your Dockerized Convex backend.

## Deployment

*   **Backend (Convex)**: The Convex backend is deployed as a Docker container. Follow your standard Docker deployment procedures to host the container on your preferred infrastructure.
*   **Frontend (Vite)**: The Vite frontend can be built using `npm run build` (or `vite build`) and the resulting static assets can be deployed to any static hosting provider or served via your backend.

## Contributing

(Optional: Add guidelines for contributing if this is an open project or has multiple collaborators.)

---

*This README was enhanced with the assistance of Cascade, an AI coding assistant.*
