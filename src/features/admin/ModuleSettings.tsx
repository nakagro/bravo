import React, { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Id } from "../../../convex/_generated/dataModel";

interface ModuleSettingsProps {
  showTitle?: boolean
}

// Define rank options
// Radix Select items cannot use an empty value, so "no rank" gets a sentinel.
const NO_RANK = "__none__";

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
      <ResponsiveModal
        open={isRoleDialogOpen}
        onClose={() => setIsRoleDialogOpen(false)}
        title="Manage Roles"
      >
        <div className="pb-4">
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
                <Plus className="h-4 w-4" />
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
                            onCheckedChange={(isActive) => handleToggleRoleActive(role._id, isActive)}
                            aria-label={`${role.name} active`}
                            className="dark:data-[state=unchecked]:bg-gray-600"
                          />
                          <button
                            onClick={() => startEditingRole(role)}
                            className="p-1 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                            title="Edit role"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRole(role._id)}
                            className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete role"
                          >
                            <Trash2 className="h-4 w-4" />
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
      </ResponsiveModal>
      
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
                          onCheckedChange={(isEnabled) => handleToggleChange(module.moduleId, isEnabled)}
                          aria-label={`${module.moduleName} enabled`}
                          className="dark:data-[state=unchecked]:bg-gray-600"
                        />
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
                                  onCheckedChange={setIsAdminOnly}
                                  aria-label="Admin only access"
                                  className="dark:data-[state=unchecked]:bg-gray-600"
                                />
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
                                <Select
                                  value={selectedRank ?? NO_RANK}
                                  onValueChange={(v) => setSelectedRank(v === NO_RANK ? undefined : (v as typeof selectedRank))}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rankOptions.map((rank) => (
                                      <SelectItem key={rank.value ?? NO_RANK} value={rank.value ?? NO_RANK}>
                                        {rank.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
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
