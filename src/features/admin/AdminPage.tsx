import React from "react";
import UserManagement from "./UserManagement";
import ModuleSettings from "./ModuleSettings";

const AdminPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Settings</h1>
      
      <div className="grid grid-cols-1 gap-8">
        {/* User Management - Control user roles, ranks, and permissions */}
        <UserManagement />

        {/* Module Settings - Control which modules are accessible */}
        <ModuleSettings />
      </div>
    </div>
  );
};

export default AdminPage;
