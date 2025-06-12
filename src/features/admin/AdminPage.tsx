import UserManagement from "./UserManagement";
import ModuleSettings from "./ModuleSettings";
import NotificationTester from "./NotificationTester";

export default function AdminPage() {
  return (
    <div className="space-y-6" data-component="AdminPage">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Settings</h1>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {/* User Management - Control user roles, ranks, and permissions */}
        <UserManagement />

        {/* Module Settings - Control which modules are accessible */}
        <ModuleSettings />

        {/* Push Notification Tester */}
        <NotificationTester />
      </div>
    </div>
  );
}
