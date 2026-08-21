import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "../../../components/shared/ResponsiveModal";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { formatUserName, getInitials } from "../types";

interface ConfirmAttendanceDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: Id<"events">;
}

interface SheetMember {
  _id: Id<"users">;
  firstName?: string;
  lastName?: string;
  name?: string;
}

/**
 * The attendance sheet: tick who actually turned up.
 *
 * Prefilled from who was expected, because that's usually most of the answer -
 * but every name is un-tickable and every other member is one tap away, since
 * the entire reason this exists is that the real turnout deviates from the
 * plan. Saving replaces the stored list, so amending later is the same flow
 * with the same prefill.
 */
export function ConfirmAttendanceDialog({ open, onClose, eventId }: ConfirmAttendanceDialogProps) {
  const sheet = useQuery(api.events.getAttendanceSheet, open ? { eventId } : "skip");
  const setEventAttendance = useMutation(api.events.setEventAttendance);
  const clearEventAttendance = useMutation(api.events.clearEventAttendance);

  const [present, setPresent] = useState<Set<Id<"users">>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const alreadyConfirmed = sheet?.confirmedAt != null;

  // Seed once the sheet arrives: the stored list if it's been confirmed before,
  // otherwise everyone who was expected. Keyed on the ids so a re-render (or a
  // teammate's edit landing over the subscription) can't undo the ticking.
  const seedKey = sheet
    ? `${alreadyConfirmed ? "c" : "e"}:${(alreadyConfirmed ? sheet.confirmedIds : sheet.expectedIds).join(",")}`
    : "";
  useEffect(() => {
    if (!open || !seedKey) return;
    const ids = seedKey.slice(2);
    setPresent(new Set(ids ? (ids.split(",") as Id<"users">[]) : []));
  }, [open, seedKey]);

  // Clear the search each time the dialog is opened
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const toggle = (userId: Id<"users">) =>
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const query = search.trim().toLowerCase();

  // Two lists, because they're two different jobs: tick off the people who were
  // meant to be there, then add whoever else turned up.
  const { expected, others } = useMemo(() => {
    if (!sheet) return { expected: [] as SheetMember[], others: [] as SheetMember[] };
    const expectedIds = new Set(sheet.expectedIds);
    const matches = (member: SheetMember) =>
      !query || formatUserName(member).toLowerCase().includes(query);
    return {
      expected: sheet.members.filter((m) => expectedIds.has(m._id)).filter(matches),
      others: sheet.members.filter((m) => !expectedIds.has(m._id)).filter(matches),
    };
  }, [sheet, query]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setEventAttendance({ eventId, userIds: [...present] });
      onClose();
      toast.success(
        present.size === 1 ? "1 member recorded as attending" : `${present.size} members recorded as attending`
      );
    } catch (error) {
      console.error("Error confirming attendance:", error);
      toast.error("Couldn't record attendance", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await clearEventAttendance({ eventId });
      onClose();
      toast.success("Attendance record cleared");
    } catch (error) {
      console.error("Error clearing attendance:", error);
      toast.error("Couldn't clear the attendance record", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  const memberRow = (member: SheetMember, wasExpected: boolean) => {
    const checked = present.has(member._id);
    return (
      <button
        key={member._id}
        type="button"
        onClick={() => toggle(member._id)}
        aria-pressed={checked}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
      >
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
            checked
              ? "bg-green-600 border-green-600 text-white"
              : "border-gray-300 dark:border-gray-500 text-transparent"
          }`}
        >
          <CheckIcon className="h-4 w-4" />
        </span>
        <span className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {getInitials(member)}
        </span>
        <span
          className={`flex-1 min-w-0 truncate text-sm ${
            checked
              ? "text-gray-900 dark:text-white font-medium"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          {formatUserName(member)}
        </span>
        {/* Only worth saying on the expected list, where it's the deviation */}
        {wasExpected && !checked && (
          <span className="flex-shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            didn&apos;t attend
          </span>
        )}
      </button>
    );
  };

  const section = (
    label: string,
    hint: string,
    members: SheetMember[],
    wasExpected: boolean,
    emptyText: string
  ) => (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">
          {label}
        </h4>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {members.filter((m) => present.has(m._id)).length} of {members.length} ticked
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{hint}</p>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50 max-h-72 overflow-y-auto">
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 px-3 py-4 text-center">
            {emptyText}
          </p>
        ) : (
          members.map((member) => memberRow(member, wasExpected))
        )}
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center justify-between gap-2">
      {alreadyConfirmed ? (
        <button
          type="button"
          onClick={handleClear}
          disabled={saving}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
        >
          Clear record
        </button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !sheet}
          className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {alreadyConfirmed ? "Save changes" : `Confirm ${present.size} attended`}
        </button>
      </div>
    </div>
  );

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={alreadyConfirmed ? "Amend attendance" : "Confirm attendance"}
      footer={footer}
      drawerHeight="h-[92vh]"
    >
      {sheet === undefined ? (
        <div className="space-y-3 pb-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : sheet === null ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 pb-4">
          You don&apos;t have access to record attendance for this event.
        </p>
      ) : (
        <div className="space-y-5 pb-6">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Tick everyone who was actually there. RSVPs and the roster stay as they
            are - this is the record of what happened on the day.
          </p>

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

          {section(
            "Expected",
            "Rostered, or said they were coming. Untick anyone who didn't make it.",
            expected,
            true,
            query ? `No expected members match "${search}"` : "Nobody was expected at this one."
          )}

          {section(
            "Anyone else",
            "Tick anyone who turned up without being on the list.",
            others,
            false,
            query ? `No members match "${search}"` : "Every member was expected."
          )}
        </div>
      )}
    </ResponsiveModal>
  );
}
