import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import {
  ChecklistActionBar,
  ChecklistProgressHeader,
  ChecklistRow,
  ChecklistSection,
  type ChecklistItemStatus,
  type ChecklistProgress,
} from "@/components/shared/checklist";
import { cn } from "@/lib/utils";
import { ArrowLeft, Download, Search, Ban, RotateCcw } from "lucide-react";
import {
  MARK_LABELS,
  downloadCsv,
  formatNightDateLong,
  nightLabel,
  personName,
  rankLabel,
  type MarkStatus,
} from "../types";

type NightData = NonNullable<FunctionReturnType<typeof api.training.getNight>>;
type RollRow = NightData["members"][number];

// The roll on the shared checklist kit: Present is a resolved row, an Apology
// is the amber attention row, and a member not yet called is unanswered.
function checklistStatus(mark: MarkStatus | null): ChecklistItemStatus {
  if (mark === "present") return "resolved";
  if (mark === "apology") return "attention";
  return "unanswered";
}

// `attentionStatus` is what the amber count means: apologies for the night as a
// whole, absences within "To call" - so a closed roll with absences never
// shows the kit's green "All OK"
function progressOf(rows: RollRow[], attentionStatus: MarkStatus = "apology"): ChecklistProgress {
  let resolved = 0;
  let attention = 0;
  let answered = 0;
  for (const { mark } of rows) {
    if (!mark) continue;
    answered++;
    if (mark.status === "present") resolved++;
    if (mark.status === attentionStatus) attention++;
  }
  const total = rows.length;
  return {
    resolved,
    attention,
    answered,
    total,
    percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
}

const apologiesLabel = (n: number) => `${n} ${n === 1 ? "apology" : "apologies"}`;
const absentLabel = (n: number) => `${n} absent`;

const whoOf = (row: RollRow) =>
  row.member.rollMemberId
    ? { rollMemberId: row.member.rollMemberId }
    : { userId: row.member.userId! };

/**
 * One night's roll. The Secretary works down "To call" tapping who's here;
 * anyone who sent an apology is already moved out into Apologies, so their
 * names don't get read out. The Duty Officer sees the same screen but can only
 * record apologies.
 */
export function NightRoll({ date }: { date: string }) {
  const navigate = useNavigate();
  const data = useQuery(api.training.getNight, { date });
  const setMark = useMutation(api.training.setMark);
  const closeRoll = useMutation(api.training.closeRoll);
  const setNightCancelled = useMutation(api.training.setNightCancelled);

  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState(["call", "apologies"]);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);

  const rows = useMemo(() => data?.members ?? [], [data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => personName(row.member).toLowerCase().includes(term));
  }, [rows, search]);

  if (data === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (data === null) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          There&apos;s no roll for this date.
        </CardContent>
      </Card>
    );
  }

  const { night, canManage } = data;
  const isOpen = night.status === "open";
  const isCancelled = night.status === "cancelled";
  const toCall = filtered.filter((row) => row.mark?.status !== "apology");
  const apologies = filtered.filter((row) => row.mark?.status === "apology");
  const unmarked = rows.filter((row) => !row.mark).length;

  const mark = async (row: RollRow, status: MarkStatus | null) => {
    try {
      await setMark({ date, who: whoOf(row), status });
    } catch (error) {
      toast.error("Couldn't update the roll", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  // Tapping a name: here, or not. On a closed roll "not" means Absent.
  const togglePresent = (row: RollRow) =>
    mark(row, row.mark?.status === "present" ? null : "present");

  const canToggleApology = (row: RollRow) =>
    !isCancelled &&
    (canManage || (isOpen && (!row.mark || row.mark.status === "apology")));

  const handleClose = async () => {
    setClosing(true);
    try {
      const absent = await closeRoll({ date });
      toast.success("Roll closed", {
        description: absent > 0 ? `${absent} marked absent.` : undefined,
      });
    } catch (error) {
      toast.error("Couldn't close the roll", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setClosing(false);
      setConfirmClose(false);
    }
  };

  const handleCancelToggle = async () => {
    try {
      await setNightCancelled({ date, cancelled: !isCancelled });
      toast.success(isCancelled ? "Night restored" : "Night cancelled");
    } catch (error) {
      toast.error("Couldn't change the night", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const exportCsv = () => {
    downloadCsv(`roll-${date}.csv`, [
      ["Name", "Rank", "CFA ID", "Status", "Recorded by"],
      ...rows.map((row) => [
        personName(row.member),
        rankLabel(row.member),
        row.member.memberNumber ?? "",
        row.mark ? MARK_LABELS[row.mark.status] : "Not marked",
        row.mark?.recordedBy ? personName(row.mark.recordedBy) : "",
      ]),
    ]);
  };

  const renderRow = (row: RollRow) => {
    const status = row.mark?.status ?? null;
    const rank = rankLabel(row.member);
    return (
      <ChecklistRow
        key={row.member.key}
        status={checklistStatus(status)}
        name={personName(row.member)}
        badges={
          <>
            {rank && <span className="text-xs text-muted-foreground">{rank}</span>}
            {!row.member.hasAccount && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                No BRAVO account
              </span>
            )}
          </>
        }
        meta={
          status === "apology" && row.mark?.recordedBy ? (
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Apology taken by {personName(row.mark.recordedBy)}
            </span>
          ) : status === "absent" ? (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">Absent</span>
          ) : undefined
        }
        onActivate={canManage && !isCancelled ? () => void togglePresent(row) : undefined}
        control={
          canToggleApology(row) ? (
            <button
              type="button"
              onClick={() => void mark(row, status === "apology" ? null : "apology")}
              className={cn(
                "min-h-[44px] rounded-full px-3 text-xs font-medium transition-colors",
                status === "apology"
                  ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
                  : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10"
              )}
              aria-pressed={status === "apology"}
            >
              Apology
            </button>
          ) : undefined
        }
      />
    );
  };

  return (
    <div className="space-y-3 pb-4">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/training")}
              className="h-11 w-11 flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-foreground">{nightLabel(night)}</h1>
              <p className="text-sm text-muted-foreground">{formatNightDateLong(night.date)}</p>
            </div>
            {canManage && (
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  onClick={exportCsv}
                  aria-label="Export CSV"
                  title="Export CSV"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                </Button>
                {night.status !== "closed" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => void handleCancelToggle()}
                    aria-label={isCancelled ? "Restore night" : "Cancel night"}
                    title={isCancelled ? "Restore night" : "Cancel night"}
                  >
                    {isCancelled ? (
                      <RotateCcw className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Ban className="h-5 w-5" aria-hidden="true" />
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
          {!canManage && (
            <p className="mt-2 text-sm text-muted-foreground">
              As Duty Officer you can record apologies. Tap Apology next to a name.
            </p>
          )}
        </CardContent>
      </Card>

      {isCancelled ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            This night was cancelled.
          </CardContent>
        </Card>
      ) : (
        <>
          <ChecklistProgressHeader
            progress={progressOf(rows)}
            answeredLabel="marked"
            attentionLabel={apologiesLabel}
          />

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a member"
              aria-label="Find a member"
              className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-9 pr-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <Accordion
            type="multiple"
            value={openSections}
            onValueChange={setOpenSections}
            className="space-y-3"
          >
            <ChecklistSection
              value="call"
              name="To call"
              progress={progressOf(toCall, "absent")}
              attentionLabel={absentLabel}
            >
              {toCall.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody matches.</p>
              ) : (
                toCall.map(renderRow)
              )}
            </ChecklistSection>
            {apologies.length > 0 && (
              <ChecklistSection
                value="apologies"
                name="Apologies"
                progress={progressOf(apologies)}
                attentionLabel={apologiesLabel}
              >
                {apologies.map(renderRow)}
              </ChecklistSection>
            )}
          </Accordion>

          {canManage && (
            <ChecklistActionBar
              state={isOpen ? "editable" : "completed"}
              primaryLabel="Close roll"
              onPrimary={() => setConfirmClose(true)}
              isSubmitting={closing}
              completedLabel={
                night.closedBy
                  ? `Roll closed by ${personName(night.closedBy)}. Tap a name to amend.`
                  : "Roll closed"
              }
            />
          )}
        </>
      )}

      <DeleteConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close the roll?"
        description={
          unmarked > 0
            ? `${unmarked} ${unmarked === 1 ? "member hasn't" : "members haven't"} been marked and will be recorded as Absent. You can still change any mark afterwards.`
            : "Everyone has been marked. You can still change any mark afterwards."
        }
        confirmLabel="Close roll"
        destructive={false}
        onConfirm={() => void handleClose()}
      />
    </div>
  );
}
