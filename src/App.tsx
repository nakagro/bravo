import { Authenticated, Unauthenticated } from "convex/react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HosesPage } from "./pages/HosesPage";
import { KeysPage } from "./pages/KeysPage";
import { AuthPage } from "./pages/AuthPage";
import { DutyCrewPage } from "./pages/DutyCrewPage";
import { AppliancesPage } from "./pages/AppliancesPage";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { FireReportsPage } from "./pages/FireReportsPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { UserSettingsPage } from "./pages/UserSettingsPage";
import { AdminSettingsPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ThemeProvider } from "./lib/context/ThemeContext";
import { PushNotifier } from "./components/PushNotifier";

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
  return (
    <MainLayout>
      <PushNotifier />
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
