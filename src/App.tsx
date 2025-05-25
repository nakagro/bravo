import { Authenticated, Unauthenticated } from "convex/react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { HosesPage } from "./pages/HosesPage";
import { KeysPage } from "./pages/KeysPage";
import { AuthPage } from "./pages/AuthPage";
import { DutyCrewPage } from "./pages/DutyCrewPage";
import { AppliancesPage } from "./pages/AppliancesPage";
import { AvailabilityPage } from "./pages/AvailabilityPage";
import { UserSettingsPage } from "./pages/UserSettingsPage";
import { AdminSettingsPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ThemeProvider } from "./lib/context/ThemeContext";

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
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/hoses" element={<HosesPage />} />
        <Route path="/keys" element={<KeysPage />} />
        <Route path="/dutycrew" element={<DutyCrewPage />} />
        <Route path="/appliances" element={<AppliancesPage />} />
        <Route path="/availability" element={<AvailabilityPage />} />
        <Route path="/settings" element={<UserSettingsPage />} />
        <Route path="/admin" element={<AdminSettingsPage />} />
        
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
