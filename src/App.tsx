import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HosesPage } from "./pages/HosesPage";
import { KeysPage } from "./pages/KeysPage";
import { AuthPage } from "./pages/AuthPage";
import { DutyCrewPage } from "./pages/DutyCrewPage";
import { AppliancesPage } from "./pages/AppliancesPage";
import { VehicleFaultsPage } from "./pages/VehicleFaultsPage";
import { BookingsPage } from "./pages/BookingsPage";
import { ApplianceChecksTab, ApplianceChecksTemplateTab } from "./features/applianceChecks/pages";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { FireReportsPage } from "./pages/FireReportsPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { UserSettingsPage } from "./pages/UserSettingsPage";
import { AdminSettingsPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LinksPage } from "./pages/LinksPage";
import AboutPage from "./pages/AboutPage";
import FeedbackManagementPage from "./pages/FeedbackManagementPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ThemeProvider } from "./lib/context/ThemeContext";
import { PushNotifier } from "./components/PushNotifier";
import { PWAUpdateNotification } from "./components/PWAUpdateNotification";
import { usePostHogIdentify } from "./hooks/usePostHogIdentify";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Authenticated>
          <AuthenticatedApp />
        </Authenticated>
        <Unauthenticated>
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
        <Route path="/appliances" element={
          <ProtectedRoute moduleId="applianceChecks">
            <AppliancesPage />
          </ProtectedRoute>
        } />
        <Route path="/appliances/templates/:templateId" element={
          <ProtectedRoute moduleId="applianceChecks">
            <ApplianceChecksTemplateTab />
          </ProtectedRoute>
        } />
        <Route path="/appliances/run/:runId" element={
          <ProtectedRoute moduleId="applianceChecks">
            <ApplianceChecksTab />
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
        <Route path="/about" element={<AboutPage />} />

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
