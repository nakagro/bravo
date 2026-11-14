import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Plus, Trash2, Pencil, Key, RefreshCw, Clipboard, Ban, CircleCheckBig } from "lucide-react";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/errors";

interface ServiceAccountSettingsProps {
  showTitle?: boolean;
}

function ServiceAccountSettings({
  showTitle = true,
}: ServiceAccountSettingsProps) {
  const serviceAccounts = useQuery(api.serviceAccounts.listServiceAccounts);
  const moduleSettings = useQuery(api.modules.getModuleSettings);

  const createAccount = useMutation(api.serviceAccounts.createServiceAccount);
  const updateAccount = useMutation(api.serviceAccounts.updateServiceAccount);
  const regeneratePin = useMutation(api.serviceAccounts.regeneratePin);
  const deleteAccount = useMutation(api.serviceAccounts.deleteServiceAccount);
  const revokeAllSessions = useMutation(api.serviceAccounts.revokeAllSessions);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPinOpen, setIsPinOpen] = useState(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<Id<"serviceAccounts"> | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formModules, setFormModules] = useState<string[]>([]);
  const [formPin, setFormPin] = useState("");
  const [editingId, setEditingId] = useState<Id<"serviceAccounts"> | null>(null);

  // PIN display
  const [displayPin, setDisplayPin] = useState<string | null>(null);
  const [pinCopied, setPinCopied] = useState(false);

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPinValid = (pin: string) => /^\d{4,10}$/.test(pin);

  // Available modules for selection
  const availableModules =
    moduleSettings?.map((m) => ({
      id: m.moduleId,
      name: m.moduleName,
    })) ?? [];

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormModules([]);
    setFormPin("");
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !isPinValid(formPin)) return;
    setIsSubmitting(true);
    try {
      const result = await createAccount({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        allowedModules: formModules,
        pin: formPin,
      });
      setDisplayPin(result.pin);
      setIsPinOpen(true);
      setIsCreateOpen(false);
      resetForm();
    } catch (error) {
      alert(errorMessage(error, "Failed to create service account"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account: any) => {
    setEditingId(account._id);
    setFormName(account.name);
    setFormDescription(account.description ?? "");
    setFormModules(account.allowedModules);
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingId || !formName.trim()) return;
    setIsSubmitting(true);
    try {
      await updateAccount({
        serviceAccountId: editingId,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        allowedModules: formModules,
      });
      setIsEditOpen(false);
      resetForm();
    } catch (error) {
      alert(errorMessage(error, "Failed to update service account"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (
    accountId: Id<"serviceAccounts">,
    currentlyActive: boolean
  ) => {
    const action = currentlyActive ? "deactivate" : "activate";
    if (
      currentlyActive &&
      !confirm(
        `Are you sure you want to deactivate this service account? All active sessions will be revoked.`
      )
    ) {
      return;
    }
    try {
      await updateAccount({
        serviceAccountId: accountId,
        isActive: !currentlyActive,
      });
    } catch (error) {
      alert(errorMessage(error, `Failed to ${action} service account`));
    }
  };

  const handleRegenerate = (accountId: Id<"serviceAccounts">) => {
    setFormPin("");
    setRegeneratingId(accountId);
    setIsRegenerateOpen(true);
  };

  const handleRegenerateSubmit = async () => {
    if (!regeneratingId || !isPinValid(formPin)) return;
    setIsSubmitting(true);
    try {
      const result = await regeneratePin({ serviceAccountId: regeneratingId, pin: formPin });
      setDisplayPin(result.pin);
      setIsRegenerateOpen(false);
      setFormPin("");
      setRegeneratingId(null);
      setIsPinOpen(true);
    } catch (error) {
      alert(errorMessage(error, "Failed to set new PIN"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (accountId: Id<"serviceAccounts">) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this service account? This cannot be undone."
      )
    ) {
      return;
    }
    try {
      await deleteAccount({ serviceAccountId: accountId });
    } catch (error) {
      alert(errorMessage(error, "Failed to delete service account"));
    }
  };

  const handleRevokeSessions = async (accountId: Id<"serviceAccounts">) => {
    if (!confirm("Are you sure you want to revoke all active sessions for this service account?")) {
      return;
    }
    try {
      const count = await revokeAllSessions({ serviceAccountId: accountId });
      alert(`${count} session(s) revoked.`);
    } catch (error) {
      alert(errorMessage(error, "Failed to revoke sessions"));
    }
  };

  const copyPin = async () => {
    if (displayPin) {
      await navigator.clipboard.writeText(displayPin);
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    }
  };

  const closeRegenerate = () => {
    setIsRegenerateOpen(false);
    setFormPin("");
    setRegeneratingId(null);
  };

  const closePinDisplay = () => {
    setIsPinOpen(false);
    setDisplayPin(null);
    setPinCopied(false);
  };

  const toggleModule = (moduleId: string) => {
    setFormModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (!serviceAccounts) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {showTitle && (
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Service Accounts</h2>
        )}
        <p className="text-gray-500 dark:text-gray-400">Loading service accounts...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      {showTitle && (
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Service Accounts</h2>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage headless accounts for kiosks, displays, and integrations. Each account authenticates
          via a PIN and can only access assigned modules.
        </p>
        <button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          New Service Account
        </button>
      </div>

      {/* Service accounts list */}
      {serviceAccounts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Key className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No service accounts yet.</p>
          <p className="text-xs mt-1">
            Create one to set up a kiosk, display, or integration.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Modules
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {serviceAccounts.map((account) => (
                <tr key={account._id}>
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </div>
                      {account.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {account.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {account.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CircleCheckBig className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        <Ban className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {account.allowedModules.length === 0 ? (
                        <span className="text-xs text-gray-400">None</span>
                      ) : (
                        account.allowedModules.slice(0, 3).map((mod) => (
                          <span
                            key={mod}
                            className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          >
                            {mod}
                          </span>
                        ))
                      )}
                      {account.allowedModules.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{account.allowedModules.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {account.lastLoginAt
                      ? formatDate(account.lastLoginAt)
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(account)}
                        className="p-1.5 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRegenerate(account._id)}
                        className="p-1.5 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 rounded hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                        title="Regenerate PIN"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(account._id, account.isActive)}
                        className={`p-1.5 rounded transition-colors ${
                          account.isActive
                            ? "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            : "text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30"
                        }`}
                        title={account.isActive ? "Deactivate" : "Activate"}
                      >
                        {account.isActive ? (
                          <Ban className="h-4 w-4" />
                        ) : (
                          <CircleCheckBig className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRevokeSessions(account._id)}
                        className="p-1.5 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 rounded hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                        title="Revoke All Sessions"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(account._id)}
                        className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Login URL info */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Login URL:</strong>{" "}
          <code className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">
            {window.location.origin}/service-login
          </code>{" "}
          Service accounts use this page to sign in with their PIN.
        </p>
      </div>

      {/* ─── Create Dialog ─── */}
      <ResponsiveModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Service Account"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || !isPinValid(formPin) || isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Account"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 pb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Station Kiosk"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="What this account is used for"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              PIN *
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={formPin}
              onChange={(e) => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="4–10 digits"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest"
            />
            {formPin.length > 0 && !isPinValid(formPin) && (
              <p className="mt-1 text-xs text-red-500">Must be 4–10 digits</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Allowed Modules
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 space-y-1">
              {availableModules.map((mod) => (
                <label key={mod.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={formModules.includes(mod.id)}
                    onChange={() => toggleModule(mod.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-900 dark:text-gray-200">{mod.name}</span>
                  <span className="text-xs text-gray-400">({mod.id})</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </ResponsiveModal>

      {/* ─── Edit Dialog ─── */}
      <ResponsiveModal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Service Account"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!formName.trim() || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 pb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Allowed Modules
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md p-2 space-y-1">
              {availableModules.map((mod) => (
                <label key={mod.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={formModules.includes(mod.id)}
                    onChange={() => toggleModule(mod.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-900 dark:text-gray-200">{mod.name}</span>
                  <span className="text-xs text-gray-400">({mod.id})</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </ResponsiveModal>

      {/* ─── Regenerate PIN Dialog ─── */}
      <ResponsiveModal
        open={isRegenerateOpen}
        onClose={closeRegenerate}
        title="Set New PIN"
        drawerHeight="max-h-[85vh]"
        maxWidth="sm:max-w-sm"
        footer={
          <>
            <Button variant="outline" onClick={closeRegenerate}>
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateSubmit}
              disabled={!isPinValid(formPin) || isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting ? "Saving..." : "Set PIN"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 pb-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            The old PIN will stop working immediately and all active sessions will be revoked.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New PIN *
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d*"
              value={formPin}
              onChange={(e) => setFormPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="4–10 digits"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest"
            />
            {formPin.length > 0 && !isPinValid(formPin) && (
              <p className="mt-1 text-xs text-red-500">Must be 4–10 digits</p>
            )}
          </div>
        </div>
      </ResponsiveModal>

      {/* ─── PIN Display Dialog ─── */}
      <Dialog open={isPinOpen} onOpenChange={(o) => { if (!o) closePinDisplay(); }}>
        <DialogContent className="max-w-sm p-0" hideClose aria-describedby={undefined}>
          <div className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <Key className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="mb-2">
              Service Account PIN
            </DialogTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Save this PIN now, it will not be shown again.
            </p>

            <div className="flex items-center justify-center gap-2 mb-4">
              <code className="text-3xl font-mono font-bold tracking-[0.25em] text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-6 py-3 rounded-lg">
                {displayPin}
              </code>
              <button
                onClick={copyPin}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Copy PIN"
              >
                <Clipboard className="h-5 w-5" />
              </button>
            </div>

            {pinCopied && (
              <p className="text-sm text-green-600 dark:text-green-400 mb-3">
                Copied to clipboard!
              </p>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Use this PIN at{" "}
              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">
                {window.location.origin}/service-login
              </code>
            </p>

            <button
              onClick={closePinDisplay}
              className="w-full px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
            >
              I've saved the PIN
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ServiceAccountSettings;
