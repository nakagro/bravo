import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Play, ClipboardList, CircleCheckBig, Clock, Lock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { weekBoundaries } from "@/lib/dutyWeek";

interface ApplianceTemplateDoc {
  _id: Id<"applianceTemplates">;
  name: string;
  description?: string;
  version: number;
  hasUnpublishedChanges?: boolean;
  updatedAt: number;
}

interface InProgressRunDoc {
  _id: Id<"applianceCheckRuns">;
  templateId: Id<"applianceTemplates">;
  templateName: string;
  templateVersion: number;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: number;
  startedByName?: string;
  answeredCount: number;
  itemCount: number;
}

interface LastCompletedRunDoc {
  templateId: string;
  lastCompletedAt?: number;
  lastCompletedRun: {
    _id: Id<"applianceCheckRuns">;
    templateId: Id<"applianceTemplates">;
    completedAt?: number;
  };
}

export function InventoryTemplateSelector() {
  // No status arg: listTemplates defaults to active-only, so an appliance
  // that is out of service or archived simply isn't offered to members.
  const templates = useQuery(api.inventoryTemplates.listTemplates, {}) as ApplianceTemplateDoc[] | undefined;
  const startRun = useMutation(api.inventoryCheckRuns.startRun);
  const navigate = useNavigate();
  // Duty Crew links here with ?template=<id> when a member taps a locked row.
  // Highlight that card rather than starting anything: creating a run by
  // accident is worse than an extra tap.
  const [searchParams] = useSearchParams();
  const highlightedTemplateId = searchParams.get("template");
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!highlightedTemplateId) return;
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedTemplateId, templates]);
  const inProgressRuns = useQuery(api.inventoryCheckRuns.getInProgressRuns) as InProgressRunDoc[] | undefined;
  const lastCompletedRuns = useQuery(api.inventoryCheckRuns.getLastCompletedRunsByTemplate) as LastCompletedRunDoc[] | undefined;
  const [confirmTemplate, setConfirmTemplate] = useState<ApplianceTemplateDoc | null>(null);

  const formatRelativeTime = (timestamp: number | undefined) => {
    if (!timestamp) return "Never";
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks === 1) return "1 week ago";
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    if (diffMonths === 1) return "1 month ago";
    if (diffMonths < 12) return `${diffMonths} months ago`;
    const diffYears = Math.floor(diffMonths / 12);
    if (diffYears === 1) return "1 year ago";
    return `${diffYears} years ago`;
  };

  // The duty week (Tue-Mon), so a check done on the Monday night still counts
  // for the crew whose week it is - and matches the Duty Crew checklist.
  const isCompletedThisWeek = (lastCompletedTimestamp: number | undefined) => {
    if (!lastCompletedTimestamp) return false;
    const { start, end } = weekBoundaries(0);
    return (
      lastCompletedTimestamp >= start.getTime() &&
      lastCompletedTimestamp <= end.getTime()
    );
  };

  const doStartCheck = async (tpl: ApplianceTemplateDoc) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const runId = await startRun({ templateId: tpl._id, scheduledDate: today.getTime() });
      navigate(`/inventory/run/${runId}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to start check");
    }
  };

  // Templates with unpublished changes can't be started - the button is
  // disabled and the card says why. `startRun` rejects them server-side too,
  // and that error surfaces through doStartCheck's toast.
  const handleStartCheck = async (tpl: ApplianceTemplateDoc) => {
    const lastCompleted = lastCompletedRuns?.find((lc) => lc.templateId === tpl._id);
    if (isCompletedThisWeek(lastCompleted?.lastCompletedAt)) {
      setConfirmTemplate(tpl);
      return;
    }

    await doStartCheck(tpl);
  };

  // Empty state
  if (!templates || templates.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-10 w-10 text-red-500 dark:text-red-400" />}
        title="No checklists available"
        description="Contact an admin to create inventory check templates."
      />
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((tpl) => {
        const run = inProgressRuns?.find((r) => r.templateId === tpl._id);
        const lastCompleted = lastCompletedRuns?.find((lc) => lc.templateId === tpl._id);
        const completedThisWeek = isCompletedThisWeek(lastCompleted?.lastCompletedAt);
        const hasUnpublished = !!tpl.hasUnpublishedChanges;

        // Status config
        let statusBadge: React.ReactNode;
        let borderAccent = "";
        if (run) {
          statusBadge = (
            <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-0">
              In Progress
            </Badge>
          );
          borderAccent = "border-l-4 border-l-blue-500";
        } else if (hasUnpublished) {
          // Not an alarm - it's an admin housekeeping state that simply makes
          // the template inert, so it reads as neutral rather than red.
          statusBadge = (
            <Badge variant="secondary" className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-0">
              <Lock className="w-3 h-3 mr-1" />
              Unavailable
            </Badge>
          );
          borderAccent = "border-l-4 border-l-gray-400 dark:border-l-gray-600";
        } else if (completedThisWeek) {
          statusBadge = (
            <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-white border-0">
              <CircleCheckBig className="w-3 h-3 mr-1" />
              Done
            </Badge>
          );
          borderAccent = "border-l-4 border-l-green-500";
        } else {
          statusBadge = (
            <Badge variant="default" className="bg-amber-500 hover:bg-amber-500 text-white border-0">
              <Clock className="w-3 h-3 mr-1" />
              Due
            </Badge>
          );
          borderAccent = "border-l-4 border-l-amber-500";
        }

        return (
          <div
            key={tpl._id}
            ref={tpl._id === highlightedTemplateId ? highlightRef : undefined}
            className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 ${borderAccent} transition-all ${
              tpl._id === highlightedTemplateId
                ? "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-900"
                : ""
            }`}
          >
            {/* Stacks on phones: a long template name plus a wide action button
                can't share one line on a 390px screen without the name losing
                to the button */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              {/* Left: Template info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white break-words min-w-0">
                    {tpl.name}
                  </h3>
                  <span className="flex-shrink-0 mt-0.5">{statusBadge}</span>
                </div>

                {tpl.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-1.5">
                    {tpl.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <CircleCheckBig className="w-3 h-3" />
                    {lastCompleted?.lastCompletedAt
                      ? formatRelativeTime(lastCompleted.lastCompletedAt)
                      : "Never checked"}
                  </span>
                </div>

                {/* Only one check per appliance can be open, so say whose it
                    is and how far it got - otherwise an abandoned one blocks
                    the next crew with no clue who to ask. */}
                {run && (
                  <p className="mt-1.5 text-xs text-blue-700 dark:text-blue-400">
                    Started {formatRelativeTime(run.startedAt).toLowerCase()}
                    {run.startedByName ? ` by ${run.startedByName}` : ""} ·{" "}
                    {run.answeredCount}/{run.itemCount} done
                  </p>
                )}
                {run && run.startedAt < weekBoundaries(0).start.getTime() && (
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                    Started before this duty week, so some answers may be out
                    of date. Finish it, or cancel it from inside the check and
                    start again.
                  </p>
                )}

                {/* Say why the button is dead. Without this the card is inert
                    with no explanation, and most members can't publish. */}
                {hasUnpublished && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    An admin needs to publish recent changes before this
                    checklist can be used.
                  </p>
                )}
              </div>

              {/* Right: Action button - large for tablet touch, full width on
                  phones where it sits on its own line */}
              <div className="flex-shrink-0">
                {run ? (
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => navigate(`/inventory/run/${run._id}`)}
                    className="w-full sm:w-auto h-14 px-6 text-base font-semibold"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => handleStartCheck(tpl)}
                    disabled={hasUnpublished}
                    className={`w-full sm:w-auto h-14 px-6 text-base font-semibold ${completedThisWeek
                      ? "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      : hasUnpublished
                        ? ""
                        : "bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                      }`}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {completedThisWeek && !hasUnpublished ? "Redo" : "Start"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Confirmation dialog for re-doing a completed check */}
      <ConfirmDialog
        open={!!confirmTemplate}
        onOpenChange={(open) => { if (!open) setConfirmTemplate(null); }}
        title="Already completed this week"
        description={<>The {confirmTemplate?.name} inventory has already been completed this week. Are you sure you want to start another check?</>}
        confirmLabel="Start Anyway"
        onConfirm={() => {
          if (confirmTemplate) doStartCheck(confirmTemplate);
          setConfirmTemplate(null);
        }}
      />
    </div>
  );
}

export default InventoryTemplateSelector;
