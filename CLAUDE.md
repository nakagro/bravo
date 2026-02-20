# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start local Docker development (frontend + backend)
- `npm run dev:docker` - Docker-specific development environment
- `npm run dev:cloud` - Development with Convex Cloud backend
- `npm run dev:frontend` - Frontend only (Vite dev server)
- `npm run dev:backend` - Backend only (Convex dev)

### Build and Deployment
- `npm run build` - Standard Vite build
- `npm run build:docker` - Build for Docker deployment (grayhux.io)
- `npm run build:cloud` - Build for Convex Cloud development
- `npm run build:prod` - Production build (hushed-scorpion-51.convex.cloud)
- `npm run deploy` - Full deployment (Convex Cloud + Vercel)
- `npm run lint` - TypeScript checking for both frontend and Convex code

### Preview
- `npm run preview:docker` - Preview Docker build locally
- `npm run preview:cloud` - Preview cloud build locally
- `npm run preview:prod` - Preview production build locally

## Architecture

### Technology Stack
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS
- **Backend**: Convex (self-hosted Docker + Cloud deployments)
- **UI Framework**: Radix UI primitives with shadcn/ui components
- **Authentication**: @convex-dev/auth with role-based permissions
- **State Management**: Convex real-time queries/mutations
- **PWA**: Vite PWA plugin with service worker and push notifications

### Multi-Environment Setup
The project supports three deployment environments:
- **Local Docker**: `https://boss-convex.grayhux.io` (development)
- **Convex Cloud Dev**: `https://whimsical-hamster-488.convex.cloud`
- **Convex Cloud Prod**: `https://hushed-scorpion-51.convex.cloud`

### Feature-Driven Architecture
```
src/features/
├── auth/           # Authentication and authorization
├── availability/   # Member availability and deployment status
├── hoses/          # Fire hose Management management
├── keys/           # Protected premises key management
├── admin/          # User management and system configuration
├── userSettings/   # User profile and preferences
└── dutyCrew/       # Station checks and duty crew management
```

### Backend Structure
```
convex/
├── schema.ts       # Database schema with domain entities
├── auth.ts         # Authentication logic
├── crons.ts        # Scheduled tasks (availability reset)
├── features/       # Feature-specific backend modules
└── [domain].ts     # Domain-specific queries/mutations
```

### Role-Based Security System
- **Ranks**: Probationary → Firefighter → Lieutenant → Captain
- **Roles**: Communications Officer, Secretary, Training Officer, etc.
- **Module Access Control**: Per-feature permissions via `moduleSettings`
- **Admin Controls**: Comprehensive user and system management

### Database Design Patterns
- **Audit Trails**: Comprehensive history tracking for all domains
- **Real-time Updates**: Convex subscriptions for live data
- **Modular Permissions**: Dynamic feature enablement per user role/rank
- **System Tables**: `_storage` for file management, custom tables for business logic

## Convex Development Guidelines

@rules/claude_convex_rules.mdc

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