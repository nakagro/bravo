import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CrewSeatRow } from "@/components/shared/crew/CrewSeatRow";
import { emptySeats, toSeatsDraft } from "@/components/shared/crew/crewSeats";
import { EventCrewDialog, type EventCrewDraft } from "./EventCrewDialog";
import { ShiftCrewDialog, type ShiftCrewTarget } from "./ShiftCrewDialog";
import { formatSlotWhen } from "../types";
import { shiftCrewSummary } from "./shiftCrews";

type Crew = NonNullable<
  ReturnType<typeof useQuery<typeof api.eventCrews.listEventCrews>>
>[number];

export const newEventCrewDraft = (): EventCrewDraft => ({
  applianceName: "",
  ...emptySeats(),
  notes: "",
  perShift: false,
});

interface EventCrewsSectionProps {
  eventId: Id<"events">;
  /** Shift events can crew an appliance per shift */
  hasShifts: boolean;
  canManage: boolean;
  /** Read-only once the event is past or cancelled */
  isEditable: boolean;
  /** Opened from the page's overflow menu to add the first appliance */
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}

const hasCrew = (crew: Crew) =>
  !!crew.crewLeader || !!crew.driver || crew.crewMembers.length > 0;

/**
 * The appliances crewed for an event. Hidden entirely when there are none -
 * most events don't need a truck, and an empty heading on each would be
 * noise. Managers add the first one from the event's menu or the event form.
 */
export function EventCrewsSection({
  eventId,
  hasShifts,
  canManage,
  isEditable,
  adding,
  onAddingChange,
}: EventCrewsSectionProps) {
  const crews = useQuery(api.eventCrews.listEventCrews, { eventId });
  const me = useQuery(api.auth.loggedInUser);
  const removeCrew = useMutation(api.eventCrews.removeEventCrew);
  const anyPerShift = !!crews?.some((crew) => crew.perShift);
  const slots = useQuery(api.events.getEventSlots, anyPerShift ? { eventId } : "skip");
  const shiftCrews = useQuery(api.eventCrews.listShiftCrews, anyPerShift ? { eventId } : "skip");
  const [editing, setEditing] = useState<EventCrewDraft | null>(null);
  const [editingShift, setEditingShift] = useState<ShiftCrewTarget | null>(null);
  const [removing, setRemoving] = useState<Crew | null>(null);

  const canEdit = canManage && isEditable;
  // A fresh draft each time "add" opens, but stable while it's open - the
  // dialog resets its form whenever `initial` changes identity.
  const addDraft = useMemo(() => (adding ? newEventCrewDraft() : null), [adding]);
  const dialogDraft = editing ?? addDraft;
  const closeDialog = () => {
    setEditing(null);
    onAddingChange(false);
  };

  const handleRemove = async () => {
    if (!removing) return;
    const { _id, applianceName } = removing;
    setRemoving(null);
    try {
      await removeCrew({ crewId: _id });
      toast.success(`${applianceName} removed`);
    } catch {
      toast.error(`${applianceName} was NOT removed`, {
        description: "Check your connection and try again.",
      });
    }
  };

  const dialog = dialogDraft && (
    <EventCrewDialog
      open
      onClose={closeDialog}
      eventId={eventId}
      initial={dialogDraft}
      hasShifts={hasShifts}
    />
  );

  if (!crews || crews.length === 0) return dialog;

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500 mb-3">
        Appliances
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {crews.map((crew) => {
          const isMine = (seat: Crew["driver"]) => !!seat?.userId && seat.userId === me?._id;
          return (
            <div
              key={crew._id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="min-w-0 flex-1 truncate font-semibold text-gray-900 dark:text-white">
                  {crew.applianceName}
                </span>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      aria-label={`Edit ${crew.applianceName} crew`}
                      onClick={() =>
                        setEditing({
                          crewId: crew._id,
                          applianceName: crew.applianceName,
                          ...toSeatsDraft(crew),
                          notes: crew.notes ?? "",
                          perShift: crew.perShift,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label={`Remove ${crew.applianceName}`}
                      onClick={() => setRemoving(crew)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {crew.perShift ? (
                // One line per shift; the seats themselves open from Edit
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(slots ?? []).map((slot) => {
                    const row = shiftCrews?.find(
                      (r) => r.crewId === crew._id && r.slotId === slot._id
                    );
                    const when = formatSlotWhen(slot);
                    const mine = !!row && !!me && shiftCrewSummary(row, me._id).mine;
                    return (
                      <div key={slot._id} className="flex items-center gap-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {slot.label}
                            {when && (
                              <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                                {when}
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-xs ${mine ? "text-blue-700 dark:text-blue-300" : "text-gray-500 dark:text-gray-400"}`}
                          >
                            {row ? shiftCrewSummary(row, me?._id).text : "No crew yet"}
                          </div>
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 shrink-0"
                            aria-label={`Crew ${crew.applianceName} for ${slot.label}`}
                            onClick={() =>
                              setEditingShift({
                                crewId: crew._id,
                                applianceName: crew.applianceName,
                                slotId: slot._id,
                                slotLabel: slot.label,
                                rosteredIds: slot.allocated.map((m) => m._id),
                                interestedIds: slot.interested.map((m) => m._id),
                                seats: row ? toSeatsDraft(row) : emptySeats(),
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
              {/* Only the seats someone is in - an empty seat isn't shown */}
              {crew.crewLeader && (
                <CrewSeatRow role="Crew Leader" seat={crew.crewLeader} isMine={isMine(crew.crewLeader)} />
              )}
              {crew.driver && (
                <CrewSeatRow role="Driver" seat={crew.driver} isMine={isMine(crew.driver)} />
              )}
              {crew.crewMembers.map((seat, i) => (
                <CrewSeatRow key={i} role={`Crew ${i + 1}`} seat={seat} isMine={isMine(seat)} />
              ))}
              {!hasCrew(crew) && (
                <p className="py-1.5 text-sm text-gray-400 dark:text-gray-500">No crew yet</p>
              )}
                </>
              )}
              {crew.notes && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {crew.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <Button
          variant="outline"
          className="mt-3 w-full sm:w-auto min-h-[44px]"
          onClick={() => onAddingChange(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Crew another appliance
        </Button>
      )}

      {dialog}
      <ShiftCrewDialog eventId={eventId} target={editingShift} onClose={() => setEditingShift(null)} />

      <ConfirmDialog
        tone="destructive"
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={`Remove ${removing?.applianceName ?? "this appliance"}?`}
        description="The appliance and its crew come off this event. Nobody's place on the roster changes."
        confirmLabel="Remove"
        onConfirm={() => void handleRemove()}
      />
    </div>
  );
}
