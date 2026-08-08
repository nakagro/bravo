import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, LoaderCircle, Mail, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Reusable "who gets told when this happens" editor.
 *
 * Any module that raises an event through `notifyEvent()` gets its admin UI by
 * dropping this in with the matching `conditionKey` — no per-module backend or
 * screen. Duty Crew uses it for submitted station checks; Inventory will use it
 * for completed stock checks the same way.
 */

const RANKS = [
  "Brigade Member",
  "Probationary",
  "Firefighter",
  "Lieutenant",
  "Captain",
] as const;

type Rank = (typeof RANKS)[number];

const NO_RANK = "__none__";

interface NotificationRecipientsSectionProps {
  /** Audience key, conventionally "module:event" (e.g. "dutyCrew:checksSubmitted"). */
  conditionKey: string;
  /** Module the notice belongs to; gates who can see it in the Action Centre. */
  moduleId: string;
  /** What the event is, in the officer's words. */
  title: string;
  description: string;
  /** Where a notice of this kind links to — used by the test send. */
  url: string;
}

export function NotificationRecipientsSection({
  conditionKey,
  moduleId,
  title,
  description,
  url,
}: NotificationRecipientsSectionProps) {
  const config = useQuery(api.actionAccountability.getAccountability, { conditionKey });
  const members = useQuery(api.users.getMemberUsers);
  const roles = useQuery(api.users.getRoles);
  const setAccountability = useMutation(api.actionAccountability.setAccountability);
  const sendTest = useMutation(api.actionAccountability.sendTestNotification);

  const [isEnabled, setIsEnabled] = useState(false);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [userIds, setUserIds] = useState<Id<"users">[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [minimumRank, setMinimumRank] = useState<Rank | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Seed the form once from the server, then leave it alone — this is a live
  // query, and re-seeding on every update would fight the officer's edits.
  useEffect(() => {
    if (!config || loaded) return;
    setIsEnabled(config.isEnabled);
    setNotifyInApp(config.notifyInApp);
    setNotifyEmail(config.notifyEmail);
    setUserIds(config.userIds);
    setSelectedRoles(config.roles);
    setMinimumRank(config.minimumRank as Rank | undefined);
    setLoaded(true);
  }, [config, loaded]);

  // `config` is null for a signed-out caller — nothing useful to render either way.
  if (config == null || members === undefined || roles === undefined) {
    return (
      <div className="flex justify-center py-8">
        <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  const activeRoles = roles.filter((r) => r.isActive);
  const memberName = (m: { firstName?: string; lastName?: string; name?: string; email?: string }) =>
    [m.firstName, m.lastName].filter(Boolean).join(" ") || m.name || m.email || "Unknown";

  const sortedMembers = [...members].sort((a, b) =>
    memberName(a).localeCompare(memberName(b))
  );

  const toggleUser = (id: Id<"users">) =>
    setUserIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));

  const toggleRole = (role: string) =>
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );

  const hasRecipients =
    userIds.length > 0 || selectedRoles.length > 0 || minimumRank !== undefined;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setAccountability({
        conditionKey,
        roles: selectedRoles,
        userIds,
        minimumRank,
        isEnabled,
        notifyInApp,
        notifyEmail,
      });
      toast.success("Notification settings saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save notification settings"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // The test reads the saved row, not this form — say so rather than silently
  // sending the previous settings.
  const hasUnsavedChanges =
    isEnabled !== config.isEnabled ||
    notifyInApp !== config.notifyInApp ||
    notifyEmail !== config.notifyEmail ||
    minimumRank !== config.minimumRank ||
    selectedRoles.length !== config.roles.length ||
    selectedRoles.some((r) => !config.roles.includes(r)) ||
    userIds.length !== config.userIds.length ||
    userIds.some((id) => !config.userIds.includes(id));

  const handleSendTest = async () => {
    setIsTesting(true);
    try {
      const result = await sendTest({ conditionKey, moduleId, title, url });
      const channels = [
        result.inApp ? "the notification bell" : null,
        result.emailedTo,
      ].filter(Boolean);
      toast.success("Test notification sent to you", {
        description: `Check ${channels.join(" and ")}.`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send the test notification"
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            aria-label="Enable these notifications"
          />
        </div>

        {isEnabled && (
          <>
            <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
              <Label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                How they're told
              </Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 min-h-[40px] cursor-pointer">
                  <Checkbox
                    checked={notifyInApp}
                    onCheckedChange={(v) => setNotifyInApp(v === true)}
                  />
                  <Bell className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Action Centre notice
                  </span>
                </label>
                <label className="flex items-center gap-3 min-h-[40px] cursor-pointer">
                  <Checkbox
                    checked={notifyEmail}
                    onCheckedChange={(v) => setNotifyEmail(v === true)}
                  />
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Email</span>
                </label>
              </div>
            </div>

            <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
              <Label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                People
              </Label>
              <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {sortedMembers.map((member) => (
                  <label
                    key={member._id}
                    className="flex items-center gap-3 px-3 min-h-[44px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <Checkbox
                      checked={userIds.includes(member._id)}
                      onCheckedChange={() => toggleUser(member._id)}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {memberName(member)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {activeRoles.length > 0 && (
              <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                <Label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Roles
                </Label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Anyone holding the role is notified — survives a handover without
                  editing this list.
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeRoles.map((role) => (
                    <button
                      key={role._id}
                      type="button"
                      onClick={() => toggleRole(role.name)}
                      aria-pressed={selectedRoles.includes(role.name)}
                      className={`min-h-[40px] rounded-full border px-3 text-sm transition-colors ${
                        selectedRoles.includes(role.name)
                          ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-4">
              <Label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Minimum rank
              </Label>
              <Select
                value={minimumRank ?? NO_RANK}
                onValueChange={(v) => setMinimumRank(v === NO_RANK ? undefined : (v as Rank))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RANK}>No rank requirement</SelectItem>
                  {RANKS.map((rank) => (
                    <SelectItem key={rank} value={rank}>
                      {rank} and above
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              {hasRecipients ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {config.resolvedRecipientNames.length > 0 ? (
                    <>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        Currently notifies:
                      </span>{" "}
                      {config.resolvedRecipientNames.join(", ")}
                    </>
                  ) : (
                    "Save to see who this resolves to."
                  )}
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No recipients selected — nobody will be notified.
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
          {isEnabled ? (
            <div className="min-w-0">
              <Button
                variant="outline"
                onClick={handleSendTest}
                disabled={isTesting || isSaving || hasUnsavedChanges}
                className="w-full sm:w-auto"
              >
                {isTesting ? (
                  <span className="flex items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send test to me
                  </span>
                )}
              </Button>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {hasUnsavedChanges
                  ? "Save first — the test uses the saved settings."
                  : "Goes only to you, using the saved settings. Nobody else is notified."}
              </p>
            </div>
          ) : (
            <span />
          )}
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
