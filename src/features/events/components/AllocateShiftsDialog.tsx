import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ResponsiveModal } from "../../../components/shared/ResponsiveModal";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { formatSlotWhen, slotCoverageLabel, getInitials, formatUserName } from "../types";

interface AllocateShiftsDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: Id<"events">;
}

/**
 * Admin roster editor for a shift event. Per slot, tap members to place/remove
 * them on the official roster. Interested members are flagged and sorted first,
 * but anyone can be allocated.
 */
export function AllocateShiftsDialog({ open, onClose, eventId }: AllocateShiftsDialogProps) {
  const roster = useQuery(api.events.getSlotRoster, open ? { eventId } : "skip");
  const toggleAllocation = useMutation(api.events.toggleSlotAllocation);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();

  const handleToggle = async (slotId: Id<"eventSlots">, userId: Id<"users">) => {
    try {
      await toggleAllocation({ slotId, userId });
    } catch (error) {
      toast.error("Couldn't update the roster", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  // Members filtered by the search box (applied per slot below)
  const filteredMembers = useMemo(() => {
    if (!roster) return [];
    if (!query) return roster.members;
    return roster.members.filter((m) => formatUserName(m).toLowerCase().includes(query));
  }, [roster, query]);

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Allocate shifts" drawerHeight="h-[92vh]">
      {roster === undefined ? (
        <div className="space-y-3 pb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : roster === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 pb-4">
          You don&apos;t have access to manage this roster.
        </p>
      ) : roster.slots.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 pb-4">
          This event has no shifts to allocate.
        </p>
      ) : (
        <div className="space-y-5 pb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {roster.slots.map((slot) => {
            const allocatedSet = new Set(slot.allocatedIds);
            const interestedSet = new Set(slot.interestedIds);
            const when = formatSlotWhen(slot);
            const underfilled = !!slot.targetCount && slot.allocatedIds.length < slot.targetCount;

            // Interested members first, then the rest — both already name-sorted
            const ordered = [...filteredMembers].sort((a, b) => {
              const ai = interestedSet.has(a._id) ? 0 : 1;
              const bi = interestedSet.has(b._id) ? 0 : 1;
              return ai - bi;
            });

            return (
              <div
                key={slot._id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {slot.label}
                    </div>
                    {when && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">{when}</div>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full ${
                      underfilled
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                        : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                    }`}
                  >
                    {slotCoverageLabel(slot.allocatedIds.length, slot.targetCount)} placed
                  </span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 max-h-64 overflow-y-auto">
                  {ordered.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 px-3 py-4 text-center">
                      No members match &ldquo;{search}&rdquo;
                    </p>
                  ) : (
                    ordered.map((member) => {
                      const isAllocated = allocatedSet.has(member._id);
                      const isInterested = interestedSet.has(member._id);
                      return (
                        <button
                          key={member._id}
                          type="button"
                          onClick={() => handleToggle(slot._id, member._id)}
                          aria-pressed={isAllocated}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                        >
                          <span
                            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                              isAllocated
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-gray-300 dark:border-gray-500 text-transparent"
                            }`}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </span>
                          <span className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {getInitials(member)}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200">
                            {formatUserName(member)}
                          </span>
                          {isInterested && (
                            <span className="flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                              interested
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ResponsiveModal>
  );
}
