import { useEffect } from "react";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { ServiceLayout } from "./components/layout/ServiceLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HosesPage } from "./pages/HosesPage";
import { KeysPage } from "./pages/KeysPage";
import { AuthPage } from "./pages/AuthPage";
import { DutyCrewPage } from "./pages/DutyCrewPage";
import { VehicleFaultsPage } from "./pages/VehicleFaultsPage";
import { InventoryPage } from "./pages/InventoryPage";
import { InventoryChecksTab, InventoryTemplateTab } from "./features/inventory/pages";
import { BookingsPage } from "./pages/BookingsPage";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { FireReportsPage } from "./pages/FireReportsPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { UserSettingsPage } from "./pages/UserSettingsPage";
import { AdminSettingsPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LinksPage } from "./pages/LinksPage";
import AboutPage from "./pages/AboutPage";
import { FDRPage } from "./pages/FDRPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { BASkillsPage } from "./pages/BASkillsPage";
import { BrigadeTasksPage } from "./features/brigadeTasks/pages/BrigadeTasksPage";
import ExtrasPage from "./pages/ExtrasPage";
import ShortcutsPage from "./pages/ShortcutsPage";
import QRCodesPage from "./features/qrCodes/QRCodesPage";
import KioskPage from "./pages/KioskPage";
import FeedbackManagementPage from "./pages/FeedbackManagementPage";
import AuthManagementPage from "./pages/AuthManagementPage";
import ServiceLoginPage from "./pages/ServiceLoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ThemeProvider } from "./lib/context/ThemeContext";
import { PushNotifier } from "./components/PushNotifier";
import { PWAUpdateNotification } from "./components/PWAUpdateNotification";
import { usePostHogIdentify } from "./hooks/usePostHogIdentify";
import {
  ServiceAccountProvider,
  useServiceAccount,
  hasServiceToken,
} from "./features/serviceAccounts/ServiceAccountContext";

// --- Startup timing helper (reads from global set in main.tsx) ---
const _t = (label: string) => (window as any).__BRAVO_T?.(label);

function TimingMarker({ label }: { label: string }) {
  _t(label);
  useEffect(() => { _t(`${label} (useEffect)`); }, []);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ServiceAccountProvider>
          <ServiceAccountGate />
        </ServiceAccountProvider>
      </BrowserRouter>
    </ThemeProvider>
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
  const moduleRoutes: Record<string, React.ReactNode> = {
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
      <Routes>
        {/* Render only routes for allowed modules */}
        {allowedModules.map((moduleId) => moduleRoutes[moduleId]).filter(Boolean)}

        {/* Catch-all: redirect to the default allowed page */}
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </ServiceLayout>
  );
}

function AuthenticatedApp() {
  // Identify user with PostHog for analytics
  usePostHogIdentify();

  return (
    <MainLayout>
      <PushNotifier />
      <PWAUpdateNotification />
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
        <Route path="/availability" element={
          <ProtectedRoute moduleId="availability">
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
        <Route path="/about" element={<AboutPage />} />
        <Route path="/extras" element={<ExtrasPage />} />
        <Route path="/shortcuts" element={
          <ProtectedRoute moduleId="availability">
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

        {/* Catch all other routes and redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}

function UnauthenticatedApp() {
  return (
    <Routes>
      {/* Service login is full-screen — must not be wrapped in AuthLayout */}
      <Route path="/service-login" element={<ServiceLoginPage />} />
      <Route path="*" element={
        <AuthLayout>
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<AuthPage />} />
          </Routes>
        </AuthLayout>
      } />
    </Routes>
  );
}
