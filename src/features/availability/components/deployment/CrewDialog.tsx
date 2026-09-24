import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { MemberCombobox, type MemberOption } from "@/components/shared/MemberCombobox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const BRIGADE_NAME = 'Wyndham Vale';
const QUICK_APPLIANCES = ['Pumper', 'Tanker', 'FCV'];
const CREW_SEATS = 3;

/** A seat holds a BRAVO member or, for crew from another brigade, a typed name. */
export interface SeatDraft {
  userId: Id<"users"> | null;
  name: string;
}

export const emptySeat = (): SeatDraft => ({ userId: null, name: '' });

export interface CrewDraft {
  crewId?: Id<"deploymentCrews">;
  date: number;
  applianceName: string;
  crewLeader: SeatDraft;
  driver: SeatDraft;
  crewMembers: SeatDraft[];
  notes: string;
}

type SeatKey = 'crewLeader' | 'driver' | number;

function toSeat(seat: SeatDraft) {
  if (seat.userId) return { userId: seat.userId };
  const name = seat.name.trim();
  return name ? { name } : undefined;
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

  const getSeat = (key: SeatKey) => (typeof key === 'number' ? draft.crewMembers[key] : draft[key]);

  const updateSeat = (key: SeatKey, change: Partial<SeatDraft>) =>
    setDraft((d) => {
      if (typeof key === 'number') {
        const crewMembers = [...d.crewMembers];
        crewMembers[key] = { ...crewMembers[key], ...change };
        return { ...d, crewMembers };
      }
      return { ...d, [key]: { ...d[key], ...change } };
    });

  // Hide members already seated elsewhere on this truck from each picker.
  const optionsFor = (current: Id<"users"> | null) => {
    const taken = new Set(
      [draft.driver, draft.crewLeader, ...draft.crewMembers]
        .filter((s) => s.userId !== null && s.userId !== current)
        .map((s) => s.userId)
    );
    return options.filter((o) => !taken.has(o._id));
  };

  const renderSeat = (key: SeatKey, label: string) => {
    const seat = getSeat(key);
    return (
      <MemberCombobox
        key={label}
        label={label}
        options={optionsFor(seat.userId)}
        value={seat.userId}
        onChange={(v) => updateSeat(key, { userId: v })}
        externalName={seat.name}
        onExternalChange={(name) => updateSeat(key, { name })}
      />
    );
  };

  const handleSave = async () => {
    const applianceName = draft.applianceName.trim();
    if (!applianceName) {
      setNameError('Give the appliance a name');
      return;
    }
    const payload = {
      date: draft.date,
      applianceName,
      driver: toSeat(draft.driver),
      crewLeader: toSeat(draft.crewLeader),
      crewMembers: draft.crewMembers.flatMap((seat) => toSeat(seat) ?? []),
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
      const message = error instanceof Error ? error.message.replace(/^.*Uncaught Error: /, '').split('\n')[0] : '';
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
        <div className="flex gap-2 w-full">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save crew'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <div>
          <label htmlFor="crew-appliance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Appliance<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {QUICK_APPLIANCES.map((appliance) => {
              const name = `${BRIGADE_NAME} ${appliance}`;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setDraft((d) => ({ ...d, applianceName: name })); setNameError(undefined); }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition-colors min-h-[36px]',
                    draft.applianceName === name
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                  )}
                >
                  {appliance}
                </button>
              );
            })}
          </div>
          <input
            id="crew-appliance"
            value={draft.applianceName}
            onChange={(e) => { setDraft((d) => ({ ...d, applianceName: e.target.value })); setNameError(undefined); }}
            placeholder="Or type a name, e.g. Werribee Tanker"
            maxLength={60}
            aria-invalid={!!nameError}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-base"
          />
          {nameError && <p className="mt-1 text-sm text-destructive">{nameError}</p>}
        </div>

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

        {renderSeat('crewLeader', 'Crew Leader')}
        {renderSeat('driver', 'Driver')}
        {Array.from({ length: CREW_SEATS }, (_, i) => renderSeat(i, `Crew ${i + 1}`))}

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
