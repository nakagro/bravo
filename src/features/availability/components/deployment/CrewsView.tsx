import { useMemo, useState } from 'react';
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import CrewDialog, { type CrewDraft } from './CrewDialog';
import { CrewSeatRow } from "@/components/shared/crew/CrewSeatRow";
import { emptySeats, toSeatsDraft } from "@/components/shared/crew/crewSeats";
import { SendAssignmentsButton } from "@/components/shared/assignments/SendAssignmentsSheet";

interface CrewsViewProps {
  deploymentDates: Date[];
}

type Crew = NonNullable<ReturnType<typeof useQuery<typeof api.deploymentCrews.listCrews>>>[number];
function formatDayHeading(timestamp: number) {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(new Date(timestamp));
}

function CrewsView({ deploymentDates }: CrewsViewProps) {
  const startDate = deploymentDates[0]?.getTime() ?? 0;
  const endDate = deploymentDates[deploymentDates.length - 1]?.getTime() ?? 0;

  const crews = useQuery(
    api.deploymentCrews.listCrews,
    startDate && endDate ? { startDate, endDate } : "skip"
  );
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const canManage = moduleAccess?.availabilityAdmin === true;
  const deleteCrew = useMutation(api.deploymentCrews.deleteCrew);
  // Days whose crews are gone but whose members were told: they still need
  // the "no longer crewed" send, so they keep a heading with just the button.
  const removalOnlyDays = useQuery(
    api.assignmentNotices.deploymentDaysWithReceiptsOnly,
    canManage && startDate && endDate ? { startDate, endDate } : "skip"
  );

  const [editing, setEditing] = useState<CrewDraft | null>(null);
  const [deleting, setDeleting] = useState<Crew | null>(null);

  const crewsByDate = useMemo(() => {
    const map = new Map<number, Crew[]>();
    for (const crew of crews ?? []) {
      map.set(crew.date, [...(map.get(crew.date) ?? []), crew]);
    }
    return map;
  }, [crews]);

  const openNew = (date: number) =>
    setEditing({
      date,
      applianceName: '',
      ...emptySeats(),
      notes: '',
    });

  const openEdit = (crew: Crew) =>
    setEditing({
      crewId: crew._id,
      date: crew.date,
      applianceName: crew.applianceName,
      ...toSeatsDraft(crew),
      notes: crew.notes ?? '',
    });

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCrew({ crewId: deleting._id });
      toast.success(`${deleting.applianceName} crew removed`);
    } catch (error) {
      console.error("Error deleting crew:", error);
      toast.error("The crew was NOT removed", { description: "Check your connection and try again." });
    } finally {
      setDeleting(null);
    }
  };

  if (crews === undefined) {
    return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading crews…</div>;
  }

  const hasAny = crews.length > 0;

  return (
    <div className="space-y-4">
      {canManage && (
        <Button className="w-full min-h-[44px]" onClick={() => openNew(startDate)}>
          <Plus className="h-4 w-4 mr-2" />
          Crew an appliance
        </Button>
      )}

      {!hasAny && (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded p-6 text-center">
          <Truck className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-300">No appliances crewed for the next 7 days.</p>
        </div>
      )}

      {deploymentDates.map((date) => {
        const dayCrews = crewsByDate.get(date.getTime());
        const removalsOnly = !dayCrews && removalOnlyDays?.includes(date.getTime());
        if (!dayCrews && !removalsOnly) return null;
        return (
          <section key={date.getTime()}>
            <div className="flex items-center justify-between gap-2 mb-2 px-1">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {formatDayHeading(date.getTime())}
              </h3>
              {canManage && (
                <SendAssignmentsButton
                  source="deploymentDay"
                  scopeId={String(date.getTime())}
                  heading={`Deployment crews, ${formatDayHeading(date.getTime())}`}
                />
              )}
            </div>
            {removalsOnly && (
              <p className="px-1 text-sm text-gray-600 dark:text-gray-400">
                No crews any more. Members told earlier haven't heard yet.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(dayCrews ?? []).map((crew) => (
                <article key={crew._id} className="bg-white dark:bg-gray-800 shadow-sm rounded border border-gray-200 dark:border-gray-700">
                  <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="font-bold truncate min-w-0">{crew.applianceName}</h4>
                    {canManage && (
                      <div className="flex shrink-0">
                        <Button variant="ghost" size="icon" aria-label={`Edit ${crew.applianceName} crew`} onClick={() => openEdit(crew)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Remove ${crew.applianceName} crew`} onClick={() => setDeleting(crew)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </header>
                  <div className="px-3 py-1">
                    <CrewSeatRow role="Crew Leader" seat={crew.crewLeader} />
                    <CrewSeatRow role="Driver" seat={crew.driver} />
                    {[0, 1, 2].map((i) => (
                      <CrewSeatRow key={i} role={`Crew ${i + 1}`} seat={crew.crewMembers[i]} />
                    ))}
                  </div>
                  {crew.notes && (
                    <div className="px-3 pb-2 pt-1">
                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Notes:</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{crew.notes}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}

      {editing && (
        <CrewDialog
          open={editing !== null}
          onClose={() => setEditing(null)}
          initial={editing}
          dates={deploymentDates}
        />
      )}

      <ConfirmDialog
        tone="destructive"
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Remove this crew?"
        description={deleting ? `${deleting.applianceName} on ${formatDayHeading(deleting.date)} will be removed for everyone.` : ''}
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default CrewsView;
