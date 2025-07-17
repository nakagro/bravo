import React, { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Combobox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

// --- shadcn ui imports ---
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

// Format user display name
const formatUserName = (user: {
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  memberNumber?: string
}): string => {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}${user.memberNumber ? ` (${user.memberNumber})` : ''}`;
  }
  return user.name || user.email || "Unknown User";
};

// Password strength functions
const passwordStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 8) strength += 1;
  if (/[a-z]/.test(password)) strength += 1;
  if (/[A-Z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  return strength;
};

const getStrengthColor = (strength: number) => {
  if (strength <= 2) return "bg-red-500";
  if (strength <= 3) return "bg-yellow-500";
  if (strength <= 4) return "bg-blue-500";
  return "bg-green-500";
};

const getStrengthText = (strength: number) => {
  if (strength <= 2) return "Weak";
  if (strength <= 3) return "Fair";
  if (strength <= 4) return "Good";
  return "Strong";
};

const UserManagement: React.FC = () => {
  // constant for no rank
  const NO_RANK_VALUE = "none";

  // State
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Fetch users and roles from Convex
  const users = useQuery(api.users.getUsers);
  const roles = useQuery(api.users.getRoles);

  // Mutations
  const updateRank = useMutation(api.users.updateUserRank);
  const updateRoles = useMutation(api.users.updateUserRoles);
  const updateAdminStatus = useMutation(api.users.updateUserAdminStatus);
  const setDutyOfficer = useMutation(api.availability.setDutyOfficer);

  // Actions
  const adminResetPassword = useAction(api.auth.adminResetPassword);

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
    
    // Reset password fields when user changes
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
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
    setDialogOpen(userId !== null);
  };

  // Handle rank selection via shadcn Select
  const handleRankChange = (value: string) => {
    if (value === NO_RANK_VALUE) {
      setSelectedRank(null);
    } else {
      setSelectedRank(value);
    }
  };

  // Handle role selection
  const handleRoleToggle = (roleName: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(roleName)) {
        return prev.filter((r) => r !== roleName);
      } else {
        return [...prev, roleName];
      }
    });
  };

  // Handle admin status toggle
  const handleAdminToggle = (checked: boolean) => {
    setIsAdmin(checked);
  };

  // Handle duty officer toggle
  const handleDutyOfficerToggle = async (checked: boolean) => {
    const newValue = checked;
    setIsDutyOfficer(newValue);

    if (newValue && selectedUserId) {
      if (window.confirm('Setting a new duty officer will remove this status from any current duty officer. Continue?')) {
        try {
          await setDutyOfficer({ userId: selectedUserId });
        } catch (error) {
          console.error('Error setting duty officer:', error);
          setIsDutyOfficer(false);
        }
      } else {
        setIsDutyOfficer(false);
      }
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    if (!selectedUserId) return;

    // Validation
    if (!newPassword || !confirmPassword) {
      setStatusMessage({
        type: "error",
        message: "Please enter both password fields",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage({
        type: "error",
        message: "Passwords do not match",
      });
      return;
    }

    if (newPassword.length < 8) {
      setStatusMessage({
        type: "error",
        message: "Password must be at least 8 characters long",
      });
      return;
    }

    setIsResettingPassword(true);
    setStatusMessage(null);

    try {
      await adminResetPassword({
        targetUserId: selectedUserId,
        newPassword,
      });

      setStatusMessage({
        type: "success",
        message: "Password reset successfully",
      });

      // Clear password fields
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      setStatusMessage({
        type: "error",
        message: `Error resetting password: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setIsResettingPassword(false);
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
        if (selectedRank === null) {
          throw new Error("Please select a rank for this user before updating. Rank cannot be empty.");
        }

        await updateRank({
          userId: selectedUserId,
          rank: selectedRank as "Probationary" | "Firefighter" | "Lieutenant" | "Captain",
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
        message: "User updated successfully",
      });
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("ArgumentValidationError") && errorMessage.includes(".rank")) {
        errorMessage = "Please select a valid rank for this user. Rank cannot be empty.";
      }
      setStatusMessage({
        type: "error",
        message: `Error updating user: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
                    const user = users?.find((u) => u._id === userId);
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
              afterLeave={() => setQuery("")}
            >
              <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {filteredUsers?.length === 0 && query !== "" ? (
                  <div className="relative cursor-default select-none py-2 px-4 text-gray-700 dark:text-gray-300">
                    No users found.
                  </div>
                ) : (
                  filteredUsers
                    ?.slice()
                    .sort((a, b) => {
                      const nameA = formatUserName(a).toLowerCase();
                      const nameB = formatUserName(b).toLowerCase();
                      return nameA.localeCompare(nameB);
                    })
                    .map((user) => (
                      <Combobox.Option
                        key={user._id}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2 pl-10 pr-4 ${
                            active
                              ? "bg-indigo-600 text-white"
                              : "text-gray-900 dark:text-gray-200"
                          }`
                        }
                        value={user._id}
                      >
                        {({ selected, active }) => (
                          <>
                            <span
                              className={`block truncate ${
                                selected ? "font-medium" : "font-normal"
                              }`}
                            >
                              {formatUserName(user)}
                            </span>
                            {selected ? (
                              <span
                                className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                  active ? "text-white" : "text-indigo-600"
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

      {/* Settings Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedUserId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? formatUserName(selectedUser) : "User Settings"}
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Rank selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-200" htmlFor="rank-select">
                  Rank
                </label>
                <Select
                  value={selectedRank ?? NO_RANK_VALUE}
                  onValueChange={handleRankChange}
                >
                  <SelectTrigger id="rank-select" className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                    <SelectValue placeholder="-- No rank --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_RANK_VALUE}>-- No rank --</SelectItem>
                    <SelectItem value="Probationary">Probationary</SelectItem>
                    <SelectItem value="Firefighter">Firefighter</SelectItem>
                    <SelectItem value="Lieutenant">Lieutenant</SelectItem>
                    <SelectItem value="Captain">Captain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Roles selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-200">Roles</label>
                <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700">
                  {!roles || roles.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No roles defined in the system
                    </p>
                  ) : (
                    roles
                      .filter((role) => role.isActive)
                      .map((role) => (
                        <div key={role._id} className="flex items-center gap-2">
                          <Checkbox
                            id={`role-${role._id}`}
                            checked={selectedRoles.includes(role.name)}
                            onCheckedChange={() => handleRoleToggle(role.name)}
                          />
                          <label
                            htmlFor={`role-${role._id}`}
                            className="text-sm text-gray-900 dark:text-gray-200"
                          >
                            {role.name}
                            {role.description && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                ({role.description})
                              </span>
                            )}
                          </label>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Admin status toggle */}
              <div className="flex items-center justify-between">
                <label htmlFor="admin-toggle" className="text-sm font-medium dark:text-gray-200">
                  Admin
                </label>
                <Switch
                  id="admin-toggle"
                  checked={isAdmin}
                  onCheckedChange={handleAdminToggle}
                  className="dark:data-[state=unchecked]:bg-gray-600"
                />
              </div>

              {/* Duty Officer toggle */}
              <div className="flex items-center justify-between">
                <label htmlFor="duty-officer-toggle" className="text-sm font-medium dark:text-gray-200">
                  Duty Officer
                </label>
                <Switch
                  id="duty-officer-toggle"
                  checked={isDutyOfficer}
                  onCheckedChange={handleDutyOfficerToggle}
                  className="dark:data-[state=unchecked]:bg-gray-600 dark:data-[state=checked]:bg-red-600"
                />
              </div>

              <Separator />

              {/* Password Reset Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium dark:text-gray-200">Reset Password</h3>
                </div>
                
                <div className="space-y-4">
                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-medium dark:text-gray-200">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        disabled={isResettingPassword}
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={isResettingPassword}
                      >
                        {showNewPassword ? (
                          <EyeSlashIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {/* Password Strength Indicator */}
                    {newPassword && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(passwordStrength(newPassword))}`}
                              style={{ width: `${(passwordStrength(newPassword) / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {getStrengthText(passwordStrength(newPassword))}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Use 8+ characters with a mix of letters, numbers & symbols
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-medium dark:text-gray-200">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        disabled={isResettingPassword}
                        className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isResettingPassword}
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-sm text-red-500">Passwords do not match</p>
                    )}
                  </div>
                  
                  <Button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                    className="w-full"
                    variant="destructive"
                  >
                    {isResettingPassword ? "Resetting Password..." : "Reset Password"}
                  </Button>
                </div>
              </div>

              {/* Status message */}
              {statusMessage && (
                <div
                  className={`p-2 rounded text-sm ${
                    statusMessage.type === "success"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  }`}
                >
                  {statusMessage.message}
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Updating..." : "Update User"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
