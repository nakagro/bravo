import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Lock, Search } from "lucide-react";
import { formatUserName, getInitials } from "../types";
import { errorMessage } from "@/lib/errors";

interface EventInvitesDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  isPrivate: boolean;
  invitedUserIds: Id<"users">[];
  organiserId: Id<"users">;
  teamLeaderIds: Id<"users">[];
  /** Attending members, so switching a public event to private can offer one-tap carry-over */
  attendingIds?: Id<"users">[];
}

const OFFICER_RANKS = new Set(["Lieutenant", "Captain"]);

/**
 * Toggle whether an event is private (invite-only) and choose which brigade
 * members are invited. Opened directly from EventDetailPage so an organiser
 * can manage privacy without stepping through the full Edit form.
 */
export function EventInvitesDialog({
  open,
  onClose,
  eventId,
  isPrivate: initialPrivate,
  invitedUserIds: initialInvited,
  organiserId,
  teamLeaderIds,
  attendingIds = [],
}: EventInvitesDialogProps) {
  const members = useQuery(api.users.getMemberUsers, open ? {} : "skip");
  const setEventPrivacy = useMutation(api.events.setEventPrivacy);

  const [isPrivate, setIsPrivate] = useState(initialPrivate);
  const [selected, setSelected] = useState<Set<Id<"users">>>(() => new Set(initialInvited));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "invited">("all");
  const [saving, setSaving] = useState(false);

  // Reset local draft each time the dialog opens
  const initialKey = `${initialPrivate ? "1" : "0"}:${[...initialInvited].sort().join(",")}`;
  useEffect(() => {
    if (!open) return;
    setIsPrivate(initialPrivate);
    setSelected(new Set(initialInvited));
    setSearch("");
    setFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  // Organiser and team leaders are always part of the event and can't be
  // locked out of their own private event.
  const lockedIds = useMemo(
    () => new Set<Id<"users">>([organiserId, ...teamLeaderIds]),
    [organiserId, teamLeaderIds]
  );

  const sortedMembers = useMemo(
    () =>
      [...(members ?? [])].sort((a, b) =>
        formatUserName(a).localeCompare(formatUserName(b))
      ),
    [members]
  );

  const isIncluded = (id: Id<"users">) => lockedIds.has(id) || selected.has(id);

  const totalInvitedCount = useMemo(() => {
    if (!members) return new Set([...lockedIds, ...selected]).size;
    return members.filter((m) => lockedIds.has(m._id) || selected.has(m._id)).length;
  }, [members, lockedIds, selected]);

  const uninvitedOfficers = useMemo(
    () =>
      sortedMembers.filter(
        (m) => m.rank && OFFICER_RANKS.has(m.rank) && !lockedIds.has(m._id) && !selected.has(m._id)
      ),
    [sortedMembers, lockedIds, selected]
  );

  const uninvitedAttending = useMemo(
    () =>
      attendingIds.filter(
        (id) => !lockedIds.has(id) && !selected.has(id)
      ),
    [attendingIds, lockedIds, selected]
  );

  const query = search.trim().toLowerCase();
  const visibleMembers = useMemo(
    () =>
      sortedMembers.filter((member) => {
        if (filter === "invited" && !lockedIds.has(member._id) && !selected.has(member._id)) {
          return false;
        }
        if (!query) return true;
        return formatUserName(member).toLowerCase().includes(query);
      }),
    [sortedMembers, filter, lockedIds, selected, query]
  );

  const toggle = (userId: Id<"users">) => {
    if (lockedIds.has(userId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const addMany = (ids: Id<"users">[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (!lockedIds.has(id)) next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setEventPrivacy({
        eventId,
        isPrivate,
        invitedUserIds: [...selected],
      });
      onClose();
      if (isPrivate && !initialPrivate) {
        toast.success("Event is now private", {
          description: `${totalInvitedCount} ${totalInvitedCount === 1 ? "member" : "members"} invited.`,
        });
      } else if (!isPrivate && initialPrivate) {
        toast.success("Event is now visible to the whole brigade");
      } else {
        toast.success("Invite list updated");
      }
    } catch (error) {
      console.error("Error updating event privacy:", error);
      toast.error("Couldn't update invites", {
        description: errorMessage(error, "An unexpected error occurred."),
      });
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </>
  );

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={initialPrivate ? "Manage invites" : "Event visibility"}
      footer={footer}
      drawerHeight="h-[92vh]"
    >
      <div className="space-y-4 pb-6">
        <label className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg cursor-pointer">
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
              <Lock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              Private event (invite only)
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isPrivate
                ? "Only invited members, the organiser, team leaders and Events Admins can see this event."
                : "Visible to the whole brigade. Turn on to pick who is invited."}
            </span>
          </span>
          <Switch
            checked={isPrivate}
            onCheckedChange={setIsPrivate}
            aria-label="Private event (invite only)"
            className="h-7 w-12 flex-shrink-0 [&>span]:h-6 [&>span]:w-6 [&>span]:data-[state=checked]:translate-x-5"
          />
        </label>

        {isPrivate && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  aria-pressed={filter === "all"}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    filter === "all"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  All ({sortedMembers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("invited")}
                  aria-pressed={filter === "invited"}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    filter === "invited"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
                >
                  Invited ({totalInvitedCount})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {uninvitedAttending.length > 0 && (
                  <button
                    type="button"
                    onClick={() => addMany(uninvitedAttending)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    + Add yes RSVPs ({uninvitedAttending.length})
                  </button>
                )}
                {uninvitedOfficers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => addMany(uninvitedOfficers.map((m) => m._id))}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    + Add officers ({uninvitedOfficers.length})
                  </button>
                )}
                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search members..."
                className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {members === undefined ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50 max-h-80 overflow-y-auto">
                {visibleMembers.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 px-3 py-6 text-center">
                    {query
                      ? `No members match "${search}"`
                      : "No members invited yet."}
                  </p>
                ) : (
                  visibleMembers.map((member) => {
                    const isOrganiser = member._id === organiserId;
                    const isLead = !isOrganiser && teamLeaderIds.includes(member._id);
                    const locked = lockedIds.has(member._id);
                    const checked = isIncluded(member._id);
                    return (
                      <button
                        key={member._id}
                        type="button"
                        onClick={() => toggle(member._id)}
                        disabled={locked}
                        aria-pressed={checked}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                          locked
                            ? "bg-gray-50/70 dark:bg-gray-900/30 cursor-default"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                            checked
                              ? locked
                                ? "bg-purple-400/70 dark:bg-purple-700/70 border-purple-400/70 dark:border-purple-700/70 text-white"
                                : "bg-purple-600 border-purple-600 text-white"
                              : "border-gray-300 dark:border-gray-500 text-transparent"
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </span>
                        <span className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {getInitials(member)}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className={`block truncate text-sm ${
                              checked
                                ? "text-gray-900 dark:text-white font-medium"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {formatUserName(member)}
                          </span>
                          {member.rank && (
                            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                              {member.rank}
                            </span>
                          )}
                        </span>
                        {isOrganiser ? (
                          <span className="flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Organiser
                          </span>
                        ) : isLead ? (
                          <span className="flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                            Team leader
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}
