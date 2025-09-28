import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HosesPage } from "./pages/HosesPage";
import { KeysPage } from "./pages/KeysPage";
import { AuthPage } from "./pages/AuthPage";
import { DutyCrewPage } from "./pages/DutyCrewPage";
import { AppliancesPage } from "./pages/AppliancesPage";
import { VehicleFaultsPage } from "./pages/VehicleFaultsPage";
import { ApplianceChecksTab, ApplianceChecksTemplateTab } from "./features/applianceChecks/pages";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { FireReportsPage } from "./pages/FireReportsPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { UserSettingsPage } from "./pages/UserSettingsPage";
import { AdminSettingsPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LinksPage } from "./pages/LinksPage";
import { ThemeProvider } from "./lib/context/ThemeContext";
import { PushNotifier } from "./components/PushNotifier";
import { PWAUpdateNotification } from "./components/PWAUpdateNotification";
import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { api } from "../convex/_generated/api";

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please reload the page.</p>}>
      <ThemeProvider>
        <SentryUserSync />
        <BrowserRouter>
          <Authenticated>
            <AuthenticatedApp />
          </Authenticated>
          <Unauthenticated>
            <UnauthenticatedApp />
          </Unauthenticated>
        </BrowserRouter>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

function SentryUserSync() {
  const user = useQuery(api.auth.loggedInUser);

  useEffect(() => {
    if (user === undefined) return; // loading
    if (user === null) {
      Sentry.setUser(null); // clear on logout / unauthenticated
      return;
    }
    const fullName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.name ?? undefined;

    Sentry.setUser({
      id: user._id,
      email: user.email ?? undefined,
      username: fullName,
    });
    // Useful tags for filtering
    if (user.rank) Sentry.setTag("rank", user.rank);
    if (user.memberNumber) Sentry.setTag("memberNumber", String(user.memberNumber));
  }, [user]);

  return null;
}

function AuthenticatedApp() {
  // PostHog integration removed

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
        
        {/* Catch all other routes and redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}

function UnauthenticatedApp() {
  return (
    <MainLayout>
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    </MainLayout>
  );
}
