import { Fragment, Suspense, lazy, useEffect, type ReactNode } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { isDisabledAccount } from "./lib/accountType";
import { AccountDisabled } from "./components/AccountDisabled";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { ServiceLayout } from "./components/layout/ServiceLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./lib/context/ThemeContext";
import { PushNotifier } from "./components/PushNotifier";
import { PWAUpdateNotification } from "./components/PWAUpdateNotification";
import { InstallPrompt } from "./components/InstallPrompt";
import { usePostHogIdentify } from "./hooks/usePostHogIdentify";
import {
  ServiceAccountProvider,
  useServiceAccount,
  hasServiceToken,
} from "./features/serviceAccounts/ServiceAccountContext";
import { ConvexDebugObserver } from "./components/debug/ConvexDebugObserver";
import { ErrorBoundary } from "./components/ErrorBoundary";

const HosesPage = lazy(() => import("./pages/HosesPage").then((m) => ({ default: m.HosesPage })));
const KeysPage = lazy(() => import("./pages/KeysPage").then((m) => ({ default: m.KeysPage })));
const AuthPage = lazy(() => import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const DutyCrewPage = lazy(() => import("./pages/DutyCrewPage").then((m) => ({ default: m.DutyCrewPage })));
const VehicleFaultsPage = lazy(() => import("./pages/VehicleFaultsPage").then((m) => ({ default: m.VehicleFaultsPage })));
const InventoryPage = lazy(() => import("./pages/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const InventoryChecksTab = lazy(() => import("./features/inventory/pages/InventoryChecksTab").then((m) => ({ default: m.InventoryChecksTab })));
const InventoryTemplateTab = lazy(() => import("./features/inventory/pages/InventoryTemplateTab").then((m) => ({ default: m.InventoryTemplateTab })));
const MemberRecordsPage = lazy(() => import("./pages/MemberRecordsPage"));
const MemberKitProfilePage = lazy(() => import("./pages/MemberKitProfilePage"));
const MemberKitHistoryPage = lazy(() => import("./pages/MemberKitHistoryPage"));
const MemberKitSetPage = lazy(() => import("./pages/MemberKitSetPage"));
const MemberKitItemPage = lazy(() => import("./pages/MemberKitItemPage"));
const MemberKitBulkPage = lazy(() => import("./pages/MemberKitBulkPage"));
const BookingsPage = lazy(() => import("./pages/BookingsPage").then((m) => ({ default: m.BookingsPage })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const EventsPage = lazy(() => import("./pages/EventsPage").then((m) => ({ default: m.EventsPage })));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage").then((m) => ({ default: m.EventDetailPage })));
const ActionsPage = lazy(() => import("./pages/ActionsPage").then((m) => ({ default: m.ActionsPage })));
const AvailabilityPage = lazy(() => import("./pages/AvailabilityPage").then((m) => ({ default: m.AvailabilityPage })));
const FireReportsPage = lazy(() => import("./pages/FireReportsPage").then((m) => ({ default: m.FireReportsPage })));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage").then((m) => ({ default: m.FeedbackPage })));
const UserSettingsPage = lazy(() => import("./pages/UserSettingsPage").then((m) => ({ default: m.UserSettingsPage })));
const AdminSettingsPage = lazy(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminSettingsPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const LinksPage = lazy(() => import("./pages/LinksPage").then((m) => ({ default: m.LinksPage })));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const FDRPage = lazy(() => import("./pages/FDRPage").then((m) => ({ default: m.FDRPage })));
const EquipmentPage = lazy(() => import("./pages/EquipmentPage").then((m) => ({ default: m.EquipmentPage })));
const BASkillsPage = lazy(() => import("./pages/BASkillsPage").then((m) => ({ default: m.BASkillsPage })));
const BrigadeTasksPage = lazy(() => import("./features/brigadeTasks/pages/BrigadeTasksPage").then((m) => ({ default: m.BrigadeTasksPage })));
const ExtrasPage = lazy(() => import("./pages/ExtrasPage"));
const ContactDirectoryPage = lazy(() => import("./features/contacts/ContactDirectoryPage"));
const ShortcutsPage = lazy(() => import("./pages/ShortcutsPage"));
const QRCodesPage = lazy(() => import("./features/qrCodes/QRCodesPage"));
const KioskPage = lazy(() => import("./pages/KioskPage"));
const FeedbackManagementPage = lazy(() => import("./pages/FeedbackManagementPage"));
const AuthManagementPage = lazy(() => import("./pages/AuthManagementPage"));
const ServiceLoginPage = lazy(() => import("./pages/ServiceLoginPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));

// --- Startup timing helper (reads from global set in main.tsx) ---
const _t = (label: string) => (window as any).__BRAVO_T?.(label);

function TimingMarker({ label }: { label: string }) {
  _t(label);
  useEffect(() => { _t(`${label} (useEffect)`); }, [label]);
  return null;
}

function RouteLoading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-red-600" />
        <p className="text-sm text-muted-foreground">Loading page...</p>
      </div>
    </div>
  );
}

function RouteSuspense({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    // Keyed by pathname so a crashed page resets when the user navigates away
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ConvexDebugObserver />
        <BrowserRouter>
          <ServiceAccountProvider>
            <ServiceAccountGate />
          </ServiceAccountProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

/**
 * Decides whether to show the regular auth flow or the service account app.
 * Service accounts bypass Convex Auth entirely.
 */
function ServiceAccountGate() {
  const { isServiceAccount, isLoading } = useServiceAccount();

  // If we have a service token and it's still loading, show a loader
  if (isLoading && hasServiceToken()) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-red-600" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If service account session is active, render the service app
  if (isServiceAccount) {
    return <ServiceAccountApp />;
  }

  // Otherwise, use the normal Convex Auth flow
  return (
    <>
      <AuthLoading>
        <TimingMarker label="AuthLoading phase" />
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-red-600" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </AuthLoading>
      <Authenticated>
        <TimingMarker label="Auth resolved → Authenticated" />
        <AuthenticatedApp />
      </Authenticated>
      <Unauthenticated>
        <TimingMarker label="Auth resolved → Unauthenticated" />
        <UnauthenticatedApp />
      </Unauthenticated>
    </>
  );
}

/**
 * App shell for service account sessions.
 * Only renders modules that the service account has access to.
 */
function ServiceAccountApp() {
  const { allowedModules } = useServiceAccount();

  // Map of moduleId → route config
  const moduleRoutes: Record<string, ReactNode> = {
    dashboard: <Route key="dashboard" path="/" element={<DashboardPage />} />,
    kiosk: <Route key="kiosk" path="/kiosk" element={<KioskPage />} />,
    hoses: <Route key="hoses" path="/hoses" element={<HosesPage />} />,
    keys: <Route key="keys" path="/keys" element={<KeysPage />} />,
    dutyCrew: <Route key="dutyCrew" path="/dutycrew" element={<DutyCrewPage />} />,
    inventory: (
      <Route key="inventory" path="/inventory" element={<InventoryPage />} />
    ),
    vehicleFaults: (
      <Route key="vehicleFaults" path="/vehicle-faults" element={<VehicleFaultsPage />} />
    ),
    bookings: <Route key="bookings" path="/bookings" element={<BookingsPage />} />,
    events: (
      <Fragment key="events">
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
      </Fragment>
    ),
    availability: (
      <Route key="availability" path="/availability" element={<AvailabilityPage />} />
    ),
    fireReports: (
      <Route key="fireReports" path="/fire-reports" element={<FireReportsPage />} />
    ),
    feedback: <Route key="feedback" path="/feedback" element={<FeedbackPage />} />,
    links: <Route key="links" path="/links" element={<LinksPage />} />,
    equipment: <Route key="equipment" path="/equipment" element={<EquipmentPage />} />,
    baSkills: <Route key="baSkills" path="/ba-skills" element={<BASkillsPage />} />,
    brigadeTasks: (
      <Route key="brigadeTasks" path="/brigade-tasks" element={<BrigadeTasksPage />} />
    ),
  };

  // Determine the default landing page - first allowed module, or kiosk if available
  const defaultPath = allowedModules.includes("kiosk")
    ? "/kiosk"
    : allowedModules.includes("dashboard")
      ? "/"
      : "/";

  return (
    <ServiceLayout>
      <RouteSuspense>
        <Routes>
          {/* Render only routes for allowed modules */}
          {allowedModules.map((moduleId) => moduleRoutes[moduleId]).filter(Boolean)}

          {/* Catch-all: redirect to the default allowed page */}
          <Route path="*" element={<Navigate to={defaultPath} replace />} />
        </Routes>
      </RouteSuspense>
    </ServiceLayout>
  );
}

function AuthenticatedApp() {
  // Identify user with PostHog for analytics
  usePostHogIdentify();

  // A disabled account is a member who has left: every module gate on the server
  // already denies them, so render the explanation instead of an app full of
  // Access Denied pages.
  const currentUser = useQuery(api.auth.loggedInUser);
  if (isDisabledAccount(currentUser)) {
    return <AccountDisabled />;
  }

  return (
    <MainLayout>
      <PushNotifier />
      <PWAUpdateNotification />
      <InstallPrompt />
      <RouteSuspense>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute moduleId="dashboard">
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/hoses" element={
            <ProtectedRoute moduleId="hoses">
              <HosesPage />
            </ProtectedRoute>
          } />
          <Route path="/keys" element={
            <ProtectedRoute moduleId="keys">
              <KeysPage />
            </ProtectedRoute>
          } />
          <Route path="/dutycrew" element={
            <ProtectedRoute moduleId="dutyCrew">
              <DutyCrewPage />
            </ProtectedRoute>
          } />
          <Route path="/inventory" element={
            <ProtectedRoute moduleId="inventory">
              <InventoryPage />
            </ProtectedRoute>
          } />
          <Route path="/inventory/templates/:templateId" element={
            <ProtectedRoute moduleId="inventory">
              <InventoryTemplateTab />
            </ProtectedRoute>
          } />
          <Route path="/inventory/run/:runId" element={
            <ProtectedRoute moduleId="inventory">
              <InventoryChecksTab />
            </ProtectedRoute>
          } />
          <Route path="/member-records" element={
            <ProtectedRoute moduleId="memberRecords">
              <MemberRecordsPage />
            </ProtectedRoute>
          } />
          {/* Kit-definition routes are gated on memberRecordsAdmin, not just the
              visibility of the Kit tab, and must sit before /:userId so "kit"
              isn't matched as a member id. */}
          <Route path="/member-records/kit/new" element={
            <ProtectedRoute moduleId="memberRecordsAdmin">
              <MemberKitSetPage mode="form" />
            </ProtectedRoute>
          } />
          <Route path="/member-records/kit/items/new" element={
            <ProtectedRoute moduleId="memberRecordsAdmin">
              <MemberKitItemPage />
            </ProtectedRoute>
          } />
          <Route path="/member-records/kit/items/:itemId" element={
            <ProtectedRoute moduleId="memberRecordsAdmin">
              <MemberKitItemPage />
            </ProtectedRoute>
          } />
          <Route path="/member-records/kit/items/:itemId/all" element={
            <ProtectedRoute moduleId="memberRecords">
              <MemberKitBulkPage />
            </ProtectedRoute>
          } />
          <Route path="/member-records/kit/:setId" element={
            <ProtectedRoute moduleId="memberRecordsAdmin">
              <MemberKitSetPage />
            </ProtectedRoute>
          } />
          <Route path="/member-records/kit/:setId/edit" element={
            <ProtectedRoute moduleId="memberRecordsAdmin">
              <MemberKitSetPage mode="form" />
            </ProtectedRoute>
          } />
          <Route path="/member-records/:userId" element={
            <ProtectedRoute moduleId="memberRecords">
              <MemberKitProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/member-records/:userId/history" element={
            <ProtectedRoute moduleId="memberRecords">
              <MemberKitHistoryPage />
            </ProtectedRoute>
          } />
          {/* The editors are addressable: the profile renders behind them. A
              kit set is edited whole; a standalone item is edited on its own. */}
          <Route path="/member-records/:userId/set/:setId" element={
            <ProtectedRoute moduleId="memberRecords">
              <MemberKitProfilePage editing="set" />
            </ProtectedRoute>
          } />
          <Route path="/member-records/:userId/item/:itemId" element={
            <ProtectedRoute moduleId="memberRecords">
              <MemberKitProfilePage editing="item" />
            </ProtectedRoute>
          } />
          <Route path="/vehicle-faults" element={
            <ProtectedRoute moduleId="vehicleFaults">
              <VehicleFaultsPage />
            </ProtectedRoute>
          } />
          <Route path="/bookings" element={
            <ProtectedRoute moduleId="bookings">
              <BookingsPage />
            </ProtectedRoute>
          } />
          <Route path="/events" element={
            <ProtectedRoute moduleId="events">
              <EventsPage />
            </ProtectedRoute>
          } />
          <Route path="/events/:eventId" element={
            <ProtectedRoute moduleId="events">
              <EventDetailPage />
            </ProtectedRoute>
          } />
          {/* The PWA's start_url is /availability, so non-operational members
              land here on every app launch without choosing to. Send them to
              the dashboard rather than a dead end they can't act on. */}
          <Route path="/availability" element={
            <ProtectedRoute moduleId="availability" fallbackPath="/">
              <AvailabilityPage />
            </ProtectedRoute>
          } />
          <Route path="/fire-reports" element={
            <ProtectedRoute moduleId="fireReports">
              <FireReportsPage />
            </ProtectedRoute>
          } />
          <Route path="/feedback" element={
            <ProtectedRoute moduleId="feedback">
              <FeedbackPage />
            </ProtectedRoute>
          } />
          <Route path="/links" element={
            <ProtectedRoute moduleId="links">
              <LinksPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute moduleId="settings">
              <UserSettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute moduleId="admin">
              <AdminSettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/feedback" element={
            <ProtectedRoute moduleId="admin">
              <FeedbackManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/auth" element={
            <ProtectedRoute moduleId="admin">
              <AuthManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute moduleId="calendar">
              <CalendarPage />
            </ProtectedRoute>
          } />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/extras" element={<ExtrasPage />} />
          <Route path="/contacts" element={<ContactDirectoryPage />} />
          <Route path="/shortcuts" element={
            <ProtectedRoute moduleId="availability" fallbackPath="/">
              <ShortcutsPage />
            </ProtectedRoute>
          } />
          <Route path="/kiosk" element={
            <ProtectedRoute moduleId="kiosk">
              <KioskPage />
            </ProtectedRoute>
          } />
          <Route path="/fdr" element={<FDRPage />} />
          <Route path="/equipment" element={
            <ProtectedRoute moduleId="equipment">
              <EquipmentPage />
            </ProtectedRoute>
          } />
          <Route path="/ba-skills" element={
            <ProtectedRoute moduleId="baSkills">
              <BASkillsPage />
            </ProtectedRoute>
          } />
          <Route path="/brigade-tasks" element={
            <ProtectedRoute moduleId="brigadeTasks">
              <BrigadeTasksPage />
            </ProtectedRoute>
          } />
          <Route path="/qr" element={<QRCodesPage />} />
          <Route path="/actions" element={
            <ProtectedRoute moduleId="actions">
              <ActionsPage />
            </ProtectedRoute>
          } />
          {/* Catch all other routes and redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouteSuspense>
    </MainLayout>
  );
}

function UnauthenticatedApp() {
  return (
    <RouteSuspense>
      <Routes>
        {/* Service login is full-screen - must not be wrapped in AuthLayout */}
        <Route path="/service-login" element={<ServiceLoginPage />} />
        {/* Kiosk devices should use service PIN login, not user sign-in */}
        <Route path="/kiosk/*" element={<KioskToServiceLoginRedirect />} />
        <Route path="*" element={
          <AuthLayout>
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="*" element={<AuthPage />} />
            </Routes>
          </AuthLayout>
        } />
      </Routes>
    </RouteSuspense>
  );
}

function KioskToServiceLoginRedirect() {
  const location = useLocation();
  const nextPath = `${location.pathname}${location.search}`;

  return (
    <Navigate
      to={`/service-login?next=${encodeURIComponent(nextPath)}`}
      replace
    />
  );
}
