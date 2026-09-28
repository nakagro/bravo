import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { type MemberOption } from "@/components/shared/MemberCombobox";
import { ApplianceNameField } from "@/components/shared/crew/ApplianceNameField";
import { CrewSeatPickers } from "@/components/shared/crew/CrewSeatPickers";
import {
  saveErrorMessage,
  seatsPayload,
  type CrewSeatsDraft,
} from "@/components/shared/crew/crewSeats";
import { Button } from "@/components/ui/button";

export interface EventCrewDraft extends CrewSeatsDraft {
  crewId?: Id<"eventCrews">;
  applianceName: string;
  notes: string;
}

interface EventCrewDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: Id<"events">;
  initial: EventCrewDraft;
}

// Same seats as Deployment → Crews. The difference is who's listed first:
// members going to this event, then maybes, then everyone else, with anyone
// who can't make it still pickable but flagged. Crewing someone doesn't put
// them on the roster - the two are independent.
export function EventCrewDialog({ open, onClose, eventId, initial }: EventCrewDialogProps) {
  const [draft, setDraft] = useState<EventCrewDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string>();

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setNameError(undefined);
    }
  }, [open, initial]);

  const members = useQuery(api.users.getMemberUsers, open ? {} : "skip");
  const status = useQuery(api.eventCrews.getCrewPickerStatus, open ? { eventId } : "skip");
  const saveCrew = useMutation(api.eventCrews.saveEventCrew);

  const options = useMemo<MemberOption[]>(() => {
    const going = new Set(status?.going ?? []);
    const maybe = new Set(status?.maybe ?? []);
    const declined = new Set(status?.declined ?? []);
    const orderOf = (id: Id<"users">) =>
      going.has(id) ? 0 : maybe.has(id) ? 1 : declined.has(id) ? 3 : 2;
    const tagOf = (id: Id<"users">) =>
      going.has(id) ? "Going" : maybe.has(id) ? "Maybe" : declined.has(id) ? "Can't make it" : undefined;

    return (members ?? [])
      .map((m) => ({
        _id: m._id,
        name: m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.name || "Unknown member",
        rank: [m.rank, tagOf(m._id)].filter(Boolean).join(" · ") || undefined,
        order: orderOf(m._id),
      }))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(({ order: _order, ...option }) => option);
  }, [members, status]);

  const handleSave = async () => {
    const applianceName = draft.applianceName.trim();
    if (!applianceName) {
      setNameError("Give the appliance a name");
      return;
    }
    setSaving(true);
    try {
      await saveCrew({
        eventId,
        crewId: draft.crewId,
        applianceName,
        ...seatsPayload(draft),
        notes: draft.notes.trim() || undefined,
      });
      toast.success(`${applianceName} crew saved`);
      onClose();
    } catch (error) {
      toast.error("The crew was NOT saved", {
        description: saveErrorMessage(error) || "Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={draft.crewId ? "Edit crew" : "Crew an appliance"}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save crew"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-4">
        <ApplianceNameField
          id="event-crew-appliance"
          value={draft.applianceName}
          onChange={(applianceName) => {
            setDraft((d) => ({ ...d, applianceName }));
            setNameError(undefined);
          }}
          error={nameError}
        />

        <p className="text-xs text-muted-foreground">
          Members going to this event are listed first. Seats can stay empty until you know who&apos;s
          on. Crew from another brigade? Type their name and tap Add.
        </p>

        <CrewSeatPickers
          options={options}
          seats={draft}
          onChange={(seats) => setDraft((d) => ({ ...d, ...seats }))}
        />

        <div>
          <label
            htmlFor="event-crew-notes"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Notes
          </label>
          <textarea
            id="event-crew-notes"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            maxLength={500}
            rows={2}
            placeholder="Optional, e.g. meet at station 0800"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base"
          />
        </div>
      </div>
    </ResponsiveModal>
  );
}
