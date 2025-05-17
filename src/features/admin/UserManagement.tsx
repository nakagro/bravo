import React, { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Combobox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

// Format user display name
const formatUserName = (user: { firstName?: string; lastName?: string; name?: string; email?: string; memberNumber?: string }): string => {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}${user.memberNumber ? ` (${user.memberNumber})` : ''}`;
  }
  return user.name || user.email || "Unknown User";
};

const UserManagement: React.FC = () => {
  // State
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isDutyOfficer, setIsDutyOfficer] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Fetch users and roles from Convex
  const users = useQuery(api.users.getUsers);
  const roles = useQuery(api.users.getRoles);
  
  // Mutations
  const updateRank = useMutation(api.users.updateUserRank);
  const updateRoles = useMutation(api.users.updateUserRoles);
  const updateAdminStatus = useMutation(api.users.updateUserAdminStatus);
  const setDutyOfficer = useMutation(api.availability.setDutyOfficer);

  // Get the selected user
  const selectedUser = users?.find((user) => user._id === selectedUserId);

  // Update state when a user is selected
  useEffect(() => {
    if (selectedUser) {
      setSelectedRank(selectedUser.rank || null);
      setSelectedRoles(selectedUser.roles || []);
      setIsAdmin(selectedUser.isAdmin || false);
      setIsDutyOfficer(selectedUser.isDutyOfficer || false);
    } else {
      setSelectedRank(null);
      setSelectedRoles([]);
      setIsAdmin(false);
      setIsDutyOfficer(false);
    }
  }, [selectedUser]);

  // Filter users based on search query
  const filteredUsers = query === ""
    ? users
    : users?.filter((user) => {
        const displayName = formatUserName(user).toLowerCase();
        return displayName.includes(query.toLowerCase());
      });
      
  // Handle user selection
  const handleUserChange = (userId: Id<"users"> | null) => {
    setSelectedUserId(userId);
    setStatusMessage(null);
  };

  // Handle rank selection
  const handleRankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRank(e.target.value || null);
  };

  // Handle role selection
  const handleRoleToggle = (roleName: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleName)) {
        return prev.filter(r => r !== roleName);
      } else {
        return [...prev, roleName];
      }
    });
  };

  // Handle admin status toggle
  const handleAdminToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsAdmin(e.target.checked);
  };

  // Handle duty officer toggle
  const handleDutyOfficerToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setIsDutyOfficer(newValue);
    
    // If turning on duty officer status, show a confirmation dialog
    if (newValue && selectedUserId) {
      if (window.confirm('Setting a new duty officer will remove this status from any current duty officer. Continue?')) {
        try {
          await setDutyOfficer({ userId: selectedUserId });
        } catch (error) {
          console.error('Error setting duty officer:', error);
          setIsDutyOfficer(false); // Revert the UI state if the operation failed
        }
      } else {
        setIsDutyOfficer(false); // User cancelled, revert the UI state
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUserId) return;
    
    setIsSubmitting(true);
    setStatusMessage(null);
    
    try {
      // Update rank if changed
      if (selectedRank !== selectedUser?.rank) {
        // Check if selectedRank is null and provide a clear error message
        if (selectedRank === null) {
          throw new Error("Please select a rank for this user before updating. Rank cannot be empty.");
        }
        
        await updateRank({ 
          userId: selectedUserId, 
          rank: selectedRank as "Probationary" | "Firefighter" | "Lieutenant" | "Captain" 
        });
      }
      
      // Update roles if changed
      const currentRoles = selectedUser?.roles || [];
      if (JSON.stringify(selectedRoles.sort()) !== JSON.stringify(currentRoles.sort())) {
        await updateRoles({ userId: selectedUserId, roles: selectedRoles });
      }
      
      // Update admin status if changed
      if (isAdmin !== (selectedUser?.isAdmin || false)) {
        await updateAdminStatus({ userId: selectedUserId, isAdmin });
      }
      
      setStatusMessage({
        type: "success",
        message: "User updated successfully"
      });
    } catch (error) {
      // Provide more user-friendly error messages
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for specific Convex validation errors
      if (errorMessage.includes("ArgumentValidationError") && errorMessage.includes(".rank")) {
        errorMessage = "Please select a valid rank for this user. Rank cannot be empty.";
      }
      
      setStatusMessage({
        type: "error",
        message: `Error updating user: ${errorMessage}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // formatUserName function has been moved to the top of the file to avoid the reference error

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4 dark:text-white">User Management</h2>
      
      {/* User selection with search */}
      <div className="mb-6">
        <Combobox value={selectedUserId} onChange={handleUserChange} nullable>
          <div className="relative mt-1">
            <div className="relative w-full">
              <Combobox.Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select User
              </Combobox.Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <Combobox.Input
                  className="w-full pl-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  displayValue={(userId: Id<"users"> | null) => {
                    if (!userId) return "";
                    const user = users?.find(u => u._id === userId);
                    return user ? formatUserName(user) : "";
                  }}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search for a user"
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </Combobox.Button>
              </div>
            </div>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
              afterLeave={() => setQuery('')}
            >
              <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {filteredUsers?.length === 0 && query !== '' ? (
                  <div className="relative cursor-default select-none py-2 px-4 text-gray-700 dark:text-gray-300">
                    No users found.
                  </div>
                ) : (
                  filteredUsers
                    ?.slice() // Create a copy of the array to avoid mutating the original
                    .sort((a, b) => {
                      // Sort by name if available, otherwise by email or ID
                      const nameA = formatUserName(a).toLowerCase();
                      const nameB = formatUserName(b).toLowerCase();
                      return nameA.localeCompare(nameB);
                    })
                    .map((user) => (
                      <Combobox.Option
                        key={user._id}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-gray-200'
                          }`
                        }
                        value={user._id}
                      >
                        {({ selected, active }) => (
                          <>
                            <span
                              className={`block truncate ${
                                selected ? 'font-medium' : 'font-normal'
                              }`}
                            >
                              {formatUserName(user)}
                            </span>
                            {selected ? (
                              <span
                                className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                  active ? 'text-white' : 'text-indigo-600'
                                }`}
                              >
                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                              </span>
                            ) : null}
                          </>
                        )}
                      </Combobox.Option>
                    ))
                )}
              </Combobox.Options>
            </Transition>
          </div>
        </Combobox>
      </div>
      
      {selectedUser && (
        <form onSubmit={handleSubmit}>
          {/* Rank selection */}
          <div className="mb-6">
            <label htmlFor="rank-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Rank
            </label>
            <select
              id="rank-select"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              value={selectedRank || ""}
              onChange={handleRankChange}
            >
              <option value="">-- No rank --</option>
              <option value="Probationary">Probationary</option>
              <option value="Firefighter">Firefighter</option>
              <option value="Lieutenant">Lieutenant</option>
              <option value="Captain">Captain</option>
            </select>
          </div>
          
          {/* Roles selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Roles
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700">
              {!roles || roles.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No roles defined in the system</p>
              ) : (
                roles
                  .filter((role) => role.isActive)
                  .map((role) => (
                    <div key={role._id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`role-${role._id}`}
                        checked={selectedRoles.includes(role.name)}
                        onChange={() => handleRoleToggle(role.name)}
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
          </div>
          
          {/* Admin status toggle */}
          <div className="mb-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="admin-toggle"
                checked={isAdmin}
                onChange={handleAdminToggle}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded dark:border-gray-500"
              />
              <label htmlFor="admin-toggle" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                Admin
              </label>
            </div>
          </div>
          
          {/* Duty Officer toggle */}
          <div className="mb-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="duty-officer-toggle"
                checked={isDutyOfficer}
                onChange={handleDutyOfficerToggle}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded dark:border-gray-500"
              />
              <label htmlFor="duty-officer-toggle" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                Duty Officer
              </label>
            </div>
          </div>
          
          {/* Status message */}
          {statusMessage && (
            <div className={`mb-4 p-2 rounded ${
              statusMessage.type === "success" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
            }`}>
              {statusMessage.message}
            </div>
          )}
          
          {/* Submit button */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting 
                  ? "bg-indigo-300 dark:bg-indigo-800 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              }`}
            >
              {isSubmitting ? "Updating..." : "Update User"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default UserManagement;
