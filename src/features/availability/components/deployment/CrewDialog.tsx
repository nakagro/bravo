import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
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
import { toast } from 'sonner';

export interface CrewDraft extends CrewSeatsDraft {
  crewId?: Id<"deploymentCrews">;
  date: number;
  applianceName: string;
  notes: string;
}

interface CrewDialogProps {
  open: boolean;
  onClose: () => void;
  initial: CrewDraft;
  dates: Date[];
}

function formatDay(timestamp: number) {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(timestamp));
}

function CrewDialog({ open, onClose, initial, dates }: CrewDialogProps) {
  const [draft, setDraft] = useState<CrewDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string>();

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setNameError(undefined);
    }
  }, [open, initial]);

  const members = useQuery(api.users.getMemberUsers, open ? {} : "skip");
  const dayAvailability = useQuery(
    api.deploymentAvailability.getAggregatedDeploymentAvailability,
    open ? { startDate: draft.date, endDate: draft.date } : "skip"
  );

  const createCrew = useMutation(api.deploymentCrews.createCrew);
  const updateCrew = useMutation(api.deploymentCrews.updateCrew);

  // Members who put their hand up for short or long haul that day sort first;
  // anyone marked not available is still pickable, just flagged.
  const options = useMemo<MemberOption[]>(() => {
    const byUser = new Map(
      (dayAvailability?.[0]?.users ?? []).map((u) => [u.userId, u.availability])
    );
    const rankOf = (a: ReturnType<typeof byUser.get>) =>
      !a ? 1 : a.notAvailable ? 2 : a.shortHaul || a.longHaul ? 0 : 1;
    const hintOf = (a: ReturnType<typeof byUser.get>, rank?: string) => {
      const tags: string[] = [];
      if (a?.notAvailable) tags.push('Not available');
      else {
        if (a?.shortHaul) tags.push('Short haul');
        if (a?.longHaul) tags.push('Long haul');
      }
      return [rank, ...tags].filter(Boolean).join(' · ') || undefined;
    };

    return (members ?? [])
      .map((m) => {
        const availability = byUser.get(m._id);
        const name = m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : m.name || 'Unknown member';
        return { _id: m._id, name, rank: hintOf(availability, m.rank), order: rankOf(availability) };
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(({ order: _order, ...option }) => option);
  }, [members, dayAvailability]);

  const handleSave = async () => {
    const applianceName = draft.applianceName.trim();
    if (!applianceName) {
      setNameError('Give the appliance a name');
      return;
    }
    const payload = {
      date: draft.date,
      applianceName,
      ...seatsPayload(draft),
      notes: draft.notes.trim() || undefined,
    };
    setSaving(true);
    try {
      if (draft.crewId) {
        await updateCrew({ crewId: draft.crewId, ...payload });
      } else {
        await createCrew(payload);
      }
      toast.success(`${applianceName} crew saved`);
      onClose();
    } catch (error) {
      console.error("Error saving crew:", error);
      const message = saveErrorMessage(error);
      toast.error("The crew was NOT saved", { description: message || "Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={onClose}
      title={draft.crewId ? 'Edit crew' : 'Crew an appliance'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save crew'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-4">
        <ApplianceNameField
          id="crew-appliance"
          value={draft.applianceName}
          onChange={(applianceName) => { setDraft((d) => ({ ...d, applianceName })); setNameError(undefined); }}
          error={nameError}
        />

        <div>
          <label htmlFor="crew-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Day</label>
          <select
            id="crew-date"
            value={draft.date}
            onChange={(e) => setDraft((d) => ({ ...d, date: Number(e.target.value) }))}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base"
          >
            {/* keep an out-of-window date selectable when editing an older crew */}
            {!dates.some((d) => d.getTime() === draft.date) && (
              <option value={draft.date}>{formatDay(draft.date)}</option>
            )}
            {dates.map((d) => (
              <option key={d.getTime()} value={d.getTime()}>{formatDay(d.getTime())}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          Members available for short or long haul that day are listed first. Crew from
          another brigade? Type their name and tap Add.
        </p>

        <CrewSeatPickers
          options={options}
          seats={draft}
          onChange={(seats) => setDraft((d) => ({ ...d, ...seats }))}
        />

        <div>
          <label htmlFor="crew-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
          <textarea
            id="crew-notes"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            maxLength={500}
            rows={2}
            placeholder="Optional, e.g. meet at station 0600"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base"
          />
        </div>
      </div>
    </ResponsiveModal>
  );
}

export default CrewDialog;
