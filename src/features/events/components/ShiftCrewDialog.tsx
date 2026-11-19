import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { type MemberOption } from "@/components/shared/MemberCombobox";
import { CrewSeatPickers } from "@/components/shared/crew/CrewSeatPickers";
import {
  SEAT_KEYS,
  getSeat,
  seatsPayload,
  type CrewSeatsDraft,
} from "@/components/shared/crew/crewSeats";
import { Button } from "@/components/ui/button";
import { toastError } from "@/lib/errors";

export interface ShiftCrewTarget {
  crewId: Id<"eventCrews">;
  applianceName: string;
  slotId: Id<"eventSlots">;
  slotLabel: string;
  /** Who's on this shift's roster, listed first in the pickers */
  rosteredIds: Id<"users">[];
  interestedIds: Id<"users">[];
  seats: CrewSeatsDraft;
}

interface ShiftCrewDialogProps {
  eventId: Id<"events">;
  target: ShiftCrewTarget | null;
  onClose: () => void;
}

// One shift's crew on a per-shift appliance. Crewing still doesn't touch the
// roster: members rostered on this shift come first in the lists, and anyone
// seated who isn't rostered on it gets a quiet note, but nothing is enforced.
export function ShiftCrewDialog({ eventId, target, onClose }: ShiftCrewDialogProps) {
  const open = target !== null;
  const [seats, setSeats] = useState<CrewSeatsDraft | null>(target?.seats ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) setSeats(target.seats);
  }, [target]);

  const members = useQuery(api.users.getMemberUsers, open ? {} : "skip");
  const status = useQuery(api.eventCrews.getCrewPickerStatus, open ? { eventId } : "skip");
  const saveShiftCrew = useMutation(api.eventCrews.saveShiftCrew);

  const rostered = useMemo(() => new Set(target?.rosteredIds ?? []), [target]);

  const options = useMemo<MemberOption[]>(() => {
    const interested = new Set(target?.interestedIds ?? []);
    const declined = new Set(status?.declined ?? []);
    const orderOf = (id: Id<"users">) =>
      declined.has(id) ? 3 : rostered.has(id) ? 0 : interested.has(id) ? 1 : 2;
    const tagOf = (id: Id<"users">) =>
      declined.has(id)
        ? "Can't make it"
        : rostered.has(id)
          ? "On this shift"
          : interested.has(id)
            ? "Interested"
            : undefined;

    return (members ?? [])
      .map((m) => ({
        _id: m._id,
        name: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.name || "Unknown member",
        rank: [m.rank, tagOf(m._id)].filter(Boolean).join(" · ") || undefined,
        order: orderOf(m._id),
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(({ order: _order, ...option }) => option);
  }, [members, status, target, rostered]);

  // Seated members who aren't on this shift's roster - allowed, just noted
  const notRostered = useMemo(() => {
    if (!seats) return [];
    const ids = SEAT_KEYS.map((key) => getSeat(seats, key).userId).filter(
      (id): id is Id<"users"> => !!id && !rostered.has(id)
    );
    return options.filter((o) => ids.includes(o._id)).map((o) => o.name);
  }, [seats, rostered, options]);

  const handleSave = async () => {
    if (!target || !seats) return;
    setSaving(true);
    try {
      await saveShiftCrew({ crewId: target.crewId, slotId: target.slotId, ...seatsPayload(seats) });
      toast.success(`${target.applianceName} crew saved for ${target.slotLabel}`);
      onClose();
    } catch (error) {
      toastError(error, "The crew was NOT saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={target ? `${target.applianceName} · ${target.slotLabel}` : "Shift crew"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save crew
          </Button>
        </>
      }
    >
      {seats && (
        <div className="space-y-4 pb-4">
          <p className="text-xs text-muted-foreground">
            Members rostered on this shift are listed first. Crew from another brigade? Type their
            name and tap Add.
          </p>
          <CrewSeatPickers options={options} seats={seats} onChange={setSeats} />
          {notRostered.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Not rostered on this shift: {notRostered.join(", ")}
            </p>
          )}
        </div>
      )}
    </ResponsiveModal>
  );
}
