import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "../../../components/shared/ResponsiveModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { formatUserName, getInitials } from "../types";

interface ResponsesModeDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  /** The mode being switched *to* */
  mode: "open" | "closed";
  hasShifts: boolean;
  /** Offered after reopening, so the organiser can tell people it's open again */
  onNotify?: () => void;
}

/**
 * Confirms a switch between open and closed member responses.
 *
 * Neither direction destroys anything - the flag is all that moves, so an event
 * can go back and forth as the plan firms up or falls apart. The one write on
 * offer is the carry-over when closing: the people who had already said yes get
 * placed on the roster, pre-ticked because that's usually the intent, but
 * un-tickable because the whole point may be that the organiser has a different
 * list in mind.
 */
export function ResponsesModeDialog({
  open,
  onClose,
  eventId,
  mode,
  hasShifts,
  onNotify,
}: ResponsesModeDialogProps) {
  const closing = mode === "closed";
  const attendance = useQuery(
    api.events.getEventAttendance,
    open && closing ? { eventId } : "skip"
  );
  const setMemberResponses = useMutation(api.events.setMemberResponses);

  const going = attendance?.attending ?? [];
  const [carryOver, setCarryOver] = useState<Set<Id<"users">>>(new Set());
  const [saving, setSaving] = useState(false);

  // Pre-tick everyone currently going, once the list arrives. Keyed on the ids
  // themselves so re-renders don't fight the organiser's un-ticking.
  const goingKey = going.map((member) => member._id).join(",");
  useEffect(() => {
    if (!open || !closing) return;
    setCarryOver(new Set(goingKey ? (goingKey.split(",") as Id<"users">[]) : []));
  }, [open, closing, goingKey]);

  const toggle = (userId: Id<"users">) =>
    setCarryOver((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await setMemberResponses({
        eventId,
        mode,
        carryOverUserIds: closing ? [...carryOver] : undefined,
      });
      onClose();
      if (closing) {
        toast.success("Responses closed", {
          description: "You set who's going. Members can still say they can't make it.",
        });
      } else {
        toast.success("Responses open", {
          description: "Members can put their hand up again. Your roster is unchanged.",
          ...(onNotify ? { action: { label: "Notify", onClick: onNotify } } : {}),
        });
      }
    } catch (error) {
      console.error("Error changing responses mode:", error);
      toast.error("Couldn't change responses", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex gap-2 justify-end">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={saving}
        className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {closing ? "Close responses" : "Open responses"}
      </button>
    </div>
  );

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={closing ? "Set who's going" : "Open responses"}
      footer={footer}
      drawerHeight="h-[80vh]"
    >
      {closing ? (
        <div className="space-y-4 pb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Members will stop being asked{" "}
            {hasShifts ? "to pick a shift" : "to RSVP"} - you set the roster instead.
            Nothing is deleted, so you can open responses again at any time and
            everything comes back.
          </p>

          {attendance === undefined ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : going.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nobody has responded yet, so there&apos;s nothing to carry over. Use
              Allocate to build the roster.
            </p>
          ) : (
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">
                  Add to the roster
                </h4>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {carryOver.size} of {going.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                These members are already going. Untick anyone who shouldn&apos;t be
                on your list.
              </p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50 max-h-72 overflow-y-auto">
                {going.map((member) => {
                  const checked = carryOver.has(member._id);
                  return (
                    <button
                      key={member._id}
                      type="button"
                      onClick={() => toggle(member._id)}
                      aria-pressed={checked}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                    >
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                          checked
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-gray-300 dark:border-gray-500 text-transparent"
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {getInitials(member)}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200">
                        {formatUserName(member)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Members will be able to {hasShifts ? "pick a shift" : "RSVP"} again, and
            this event goes back on their action list.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Your roster stays exactly as it is - anyone you placed is still going and
            doesn&apos;t need to respond. Any responses from before you closed it
            start counting again.
          </p>
        </div>
      )}
    </ResponsiveModal>
  );
}
