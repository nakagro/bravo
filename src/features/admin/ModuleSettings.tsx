import React, { Fragment, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Switch, Dialog } from "@headlessui/react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon, PlusIcon, TrashIcon, XMarkIcon, PencilIcon } from "@heroicons/react/20/solid";
import { Id } from "../../../convex/_generated/dataModel";

interface ModuleSettingsProps {
  showTitle?: boolean
}

// Define rank options
const rankOptions = [
  { value: undefined, label: "No Rank Required" },
  { value: "Brigade Member", label: "Brigade Member" },
  { value: "Probationary", label: "Probationary" },
  { value: "Firefighter", label: "Firefighter" },
  { value: "Lieutenant", label: "Lieutenant" },
  { value: "Captain", label: "Captain" },
];

function ModuleSettings({ showTitle = true }: ModuleSettingsProps) {
  // Fetch module settings and roles
  const moduleSettings = useQuery(api.modules.getModuleSettings);
  const roles = useQuery(api.users.getRoles);
  
  // State for the module being edited
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedRank, setSelectedRank] = useState<"Brigade Member" | "Probationary" | "Firefighter" | "Lieutenant" | "Captain" | undefined>(undefined);
  const [isAdminOnly, setIsAdminOnly] = useState<boolean>(false);
  const [requirementMode, setRequirementMode] = useState<"all" | "any">("all");
  
  // State for role management dialog
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);
  
  // State for editing an existing role
  const [editingRoleId, setEditingRoleId] = useState<Id<"roles"> | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRoleDescription, setEditRoleDescription] = useState("");
  
  // Initialize module settings if they don't exist
  const initializeSettings = useMutation(api.modules.initializeModuleSettings);
  const syncSettings = useMutation(api.modules.syncModuleSettings);
  const updateModuleStatus = useMutation(api.modules.updateModuleStatus);
  const updateModuleRequirements = useMutation(api.modules.updateModuleRequirements);
  const createRole = useMutation(api.users.createRole);
  const deleteRole = useMutation(api.users.deleteRole);
  const updateRole = useMutation(api.users.updateRole);
  
  // Initialize settings on component mount if needed
  useEffect(() => {
    if (moduleSettings && moduleSettings.length === 0) {
      initializeSettings();
    } else if (moduleSettings && moduleSettings.length > 0) {
      // Sync missing modules to existing settings
      syncSettings();
    }
  }, [moduleSettings, initializeSettings, syncSettings]);
  
  // Handle toggle change
  const handleToggleChange = async (moduleId: string, isEnabled: boolean) => {
    try {
      await updateModuleStatus({ moduleId, isEnabled });
    } catch (error) {
      console.error(`Error updating module status: ${error}`);
    }
  };
  
  // Start editing a module's requirements
  const startEditing = (moduleId: string) => {
    const module = moduleSettings?.find(m => m.moduleId === moduleId);
    if (module) {
      setEditingModuleId(moduleId);
      setSelectedRoles(module.requiredRoles || []);
      // Type assertion to ensure the rank is one of the allowed values
      const rank = module.minimumRank as "Brigade Member" | "Probationary" | "Firefighter" | "Lieutenant" | "Captain" | undefined;
      setSelectedRank(rank);
      setIsAdminOnly(module.adminOnly || false);
      setRequirementMode(module.requirementMode === "any" ? "any" : "all");
    }
  };
  
  // Save module requirements
  const saveRequirements = async () => {
    if (!editingModuleId) return;
    
    try {
      await updateModuleRequirements({
        moduleId: editingModuleId,
        adminOnly: isAdminOnly,
        requiredRoles: selectedRoles,
        minimumRank: selectedRank,
        requirementMode,
      });
      setEditingModuleId(null);
    } catch (error) {
      console.error(`Error updating module requirements: ${error}`);
    }
  };
  
  // Cancel editing
  const cancelEditing = () => {
    setEditingModuleId(null);
    setSelectedRoles([]);
    setSelectedRank(undefined);
    setRequirementMode("all");
  };
  
  // Toggle a role selection
  const toggleRole = (roleName: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleName)) {
        return prev.filter(r => r !== roleName);
      } else {
        return [...prev, roleName];
      }
    });
  };
  
  // Handle adding a new role
  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      setRoleError("Role name is required");
      return;
    }
    
    try {
      await createRole({
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined,
      });
      setNewRoleName("");
      setNewRoleDescription("");
      setRoleError(null);
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : "Failed to create role");
    }
  };
  
  // Handle deleting a role
  const handleDeleteRole = async (roleId: Id<"roles">) => {
    if (!confirm("Are you sure you want to delete this role? This will not remove the role from users who already have it.")) {
      return;
    }
    
    try {
      await deleteRole({ roleId });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete role");
    }
  };
  
  // Handle toggling role active status
  const handleToggleRoleActive = async (roleId: Id<"roles">, isActive: boolean) => {
    try {
      await updateRole({ roleId, isActive });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update role");
    }
  };
  
  // Start editing a role
  const startEditingRole = (role: { _id: Id<"roles">; name: string; description?: string }) => {
    setEditingRoleId(role._id);
    setEditRoleName(role.name);
    setEditRoleDescription(role.description || "");
    setRoleError(null);
  };
  
  // Cancel editing a role
  const cancelEditingRole = () => {
    setEditingRoleId(null);
    setEditRoleName("");
    setEditRoleDescription("");
    setRoleError(null);
  };
  
  // Save role edits
  const handleSaveRoleEdit = async () => {
    if (!editingRoleId) return;
    
    if (!editRoleName.trim()) {
      setRoleError("Role name is required");
      return;
    }
    
    try {
      await updateRole({
        roleId: editingRoleId,
        name: editRoleName.trim(),
        description: editRoleDescription.trim() || undefined,
      });
      cancelEditingRole();
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : "Failed to update role");
    }
  };
  
  if (!moduleSettings) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {showTitle && (
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Module Settings</h2>
        )}
        <p className="text-gray-500 dark:text-gray-400">Loading module settings...</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      {showTitle && (
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Module Settings</h2>
      )}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure access to modules based on global availability, user roles, and ranks.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setIsRoleDialogOpen(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors"
          >
            Manage Roles
          </button>
          <button
            onClick={async () => {
              try {
                const result = await syncSettings();
                console.log('Sync result:', result);
                alert(`Sync completed! Added ${result.addedCount} new modules. Total: ${result.totalModules}`);
              } catch (error) {
                console.error('Sync failed:', error);
                alert('Sync failed. Check console for details.');
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
          >
            Sync Missing Modules
          </button>
        </div>
      </div>
      
      {/* Role Management Dialog */}
      <Dialog open={isRoleDialogOpen} onClose={() => setIsRoleDialogOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-lg w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                Manage Roles
              </Dialog.Title>
              <button
                onClick={() => setIsRoleDialogOpen(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4">
              {/* Add new role form */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add New Role</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Role name"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {roleError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{roleError}</p>
                  )}
                  <button
                    onClick={handleAddRole}
                    className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Role
                  </button>
                </div>
              </div>
              
              {/* Existing roles list */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Existing Roles</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {!roles || roles.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No roles defined yet</p>
                  ) : (
                    roles.map((role) => (
                      <div
                        key={role._id}
                        className="p-2 bg-gray-50 dark:bg-gray-700 rounded-md"
                      >
                        {editingRoleId === role._id ? (
                          // Edit mode
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Role name"
                              value={editRoleName}
                              onChange={(e) => setEditRoleName(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <input
                              type="text"
                              placeholder="Description (optional)"
                              value={editRoleDescription}
                              onChange={(e) => setEditRoleDescription(e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {roleError && (
                              <p className="text-xs text-red-600 dark:text-red-400">{roleError}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveRoleEdit}
                                className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditingRole}
                                className="px-2 py-1 text-xs bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View mode
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {role.name}
                                </span>
                                {!role.isActive && (
                                  <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              {role.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{role.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={role.isActive}
                                onChange={(isActive) => handleToggleRoleActive(role._id, isActive)}
                                className={`${
                                  role.isActive ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-600'
                                } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2`}
                              >
                                <span className="sr-only">
                                  {role.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span
                                  className={`${
                                    role.isActive ? 'translate-x-5' : 'translate-x-1'
                                  } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                                />
                              </Switch>
                              <button
                                onClick={() => startEditingRole(role)}
                                className="p-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                                title="Edit role"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRole(role._id)}
                                className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete role"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsRoleDialogOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Module
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Admin Only
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Required Roles
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Minimum Rank
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {moduleSettings?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No module settings found. Please initialize settings.
                </td>
              </tr>
            ) : (
              moduleSettings
                ?.sort((a, b) => a.moduleName.localeCompare(b.moduleName))
                .map((module) => (
                  <React.Fragment key={module._id}>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {module.moduleName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <Switch
                          checked={module.isEnabled}
                          onChange={(isEnabled) => handleToggleChange(module.moduleId, isEnabled)}
                          className={`${
                            module.isEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                          } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
                        >
                          <span className="sr-only">
                            {module.isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <span
                            className={`${
                              module.isEnabled ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                          />
                        </Switch>
                        <span className="ml-2">
                          {module.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {module.adminOnly ? (
                          <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-xs">
                            Admin Only
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">No</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {module.requiredRoles && module.requiredRoles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {module.requiredRoles.map(role => (
                              <span key={role} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                                {role}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          {module.requiredRoles && module.requiredRoles.length > 0 && module.minimumRank && (
                            <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded text-xs font-semibold">
                              {module.requirementMode === "any" ? "OR" : "AND"}
                            </span>
                          )}
                          {module.minimumRank ? (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs">
                              {module.minimumRank}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        <button
                          onClick={() => startEditing(module.moduleId)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Edit Requirements
                        </button>
                      </td>
                    </tr>
                    
                    {/* Edit requirements panel */}
                    {editingModuleId === module.moduleId && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4">
                          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                              Edit Access Requirements for {module.moduleName}
                            </h3>
                            
                            {/* Admin-only toggle */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Admin Only Access
                                </label>
                                <Switch
                                  checked={isAdminOnly}
                                  onChange={setIsAdminOnly}
                                  className={`${
                                    isAdminOnly ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-600'
                                  } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2`}
                                >
                                  <span className="sr-only">
                                    {isAdminOnly ? 'Admin Only' : 'Not Admin Only'}
                                  </span>
                                  <span
                                    className={`${
                                      isAdminOnly ? 'translate-x-6' : 'translate-x-1'
                                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                  />
                                </Switch>
                              </div>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                When enabled, only admin users can access this module, regardless of their roles or rank.
                              </p>
                            </div>
                            
                            {/* Role requirements */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Roles
                              </label>
                              <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-md">
                                {!roles || roles.length === 0 ? (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">No roles defined in the system</p>
                                ) : (
                                  roles
                                    .filter(role => role.isActive)
                                    .map(role => (
                                      <div key={role._id} className="flex items-center">
                                        <input
                                          type="checkbox"
                                          id={`role-${role._id}`}
                                          checked={selectedRoles.includes(role.name)}
                                          onChange={() => toggleRole(role.name)}
                                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded dark:border-gray-500"
                                        />
                                        <label htmlFor={`role-${role._id}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                                          {role.name}
                                          {role.description && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({role.description})</span>
                                          )}
                                        </label>
                                      </div>
                                    ))
                                )}
                              </div>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Leave empty if no role restrictions are needed.
                              </p>
                            </div>
                            
                            {/* Rank requirements */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Minimum Rank Required
                              </label>
                              <div className="relative">
                                <Listbox value={selectedRank} onChange={setSelectedRank}>
                                  <div className="relative mt-1">
                                    <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white dark:bg-gray-800 py-2 pl-3 pr-10 text-left border border-gray-300 dark:border-gray-600 focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
                                      <span className="block truncate">
                                        {rankOptions.find(r => r.value === selectedRank)?.label || "No Rank Required"}
                                      </span>
                                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                        <ChevronUpDownIcon
                                          className="h-5 w-5 text-gray-400"
                                          aria-hidden="true"
                                        />
                                      </span>
                                    </Listbox.Button>
                                    <Transition
                                      as={Fragment}
                                      leave="transition ease-in duration-100"
                                      leaveFrom="opacity-100"
                                      leaveTo="opacity-0"
                                    >
                                      <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-10">
                                        {rankOptions.map((rank, rankIdx) => (
                                          <Listbox.Option
                                            key={rankIdx}
                                            className={({ active }) =>
                                              `relative cursor-default select-none py-2 pl-10 pr-4 ${
                                                active ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                                              }`
                                            }
                                            value={rank.value}
                                          >
                                            {({ selected }) => (
                                              <>
                                                <span
                                                  className={`block truncate ${
                                                    selected ? 'font-medium' : 'font-normal'
                                                  }`}
                                                >
                                                  {rank.label}
                                                </span>
                                                {selected ? (
                                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400">
                                                    <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                  </span>
                                                ) : null}
                                              </>
                                            )}
                                          </Listbox.Option>
                                        ))}
                                      </Listbox.Options>
                                    </Transition>
                                  </div>
                                </Listbox>
                              </div>
                            </div>
                            
                            {/* How role and rank combine; only bites when both are set */}
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                When both a role and a rank are set
                              </label>
                              <div className="space-y-2">
                                {([
                                  {
                                    value: "all" as const,
                                    label: "Must meet both (rank AND role)",
                                    hint: "Strictest. A member needs the minimum rank and one of the roles.",
                                  },
                                  {
                                    value: "any" as const,
                                    label: "Either is enough (rank OR role)",
                                    hint: "e.g. Lieutenant and above, or anyone with the Social Admin role.",
                                  },
                                ]).map(option => (
                                  <div key={option.value} className="flex items-start">
                                    <input
                                      type="radio"
                                      id={`mode-${module.moduleId}-${option.value}`}
                                      name={`mode-${module.moduleId}`}
                                      checked={requirementMode === option.value}
                                      onChange={() => setRequirementMode(option.value)}
                                      className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-500"
                                    />
                                    <label
                                      htmlFor={`mode-${module.moduleId}-${option.value}`}
                                      className="ml-2 block text-sm text-gray-900 dark:text-gray-200"
                                    >
                                      {option.label}
                                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                                        {option.hint}
                                      </span>
                                    </label>
                                  </div>
                                ))}
                              </div>
                              {(selectedRoles.length === 0 || !selectedRank) && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Has no effect until both a role and a minimum rank are set.
                                </p>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex justify-end space-x-2 mt-4">
                              <button
                                onClick={cancelEditing}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveRequirements}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                Save Requirements
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Access Rules:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Disabled modules are not accessible to any users</li>
          <li>Admin users always have access to all enabled modules</li>
          <li>If role requirements are set, users must have at least one of the required roles</li>
          <li>If a minimum rank is set, users must have at least that rank</li>
          <li>
            If both role and rank requirements are set, the module&apos;s AND/OR setting decides
            whether users must meet both conditions or just one of them
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ModuleSettings;
