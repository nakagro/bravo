import { useEffect } from "react";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
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
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ThemeProvider } from "./lib/context/ThemeContext";
import { PushNotifier } from "./components/PushNotifier";
import { PWAUpdateNotification } from "./components/PWAUpdateNotification";
import { usePostHogIdentify } from "./hooks/usePostHogIdentify";

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
      </BrowserRouter>
    </ThemeProvider>
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
        <Route path="/kiosk" element={<KioskPage />} />
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
    <AuthLayout>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    </AuthLayout>
  );
}
