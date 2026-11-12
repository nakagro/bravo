import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import {
  ChecklistActionBar,
  ChecklistNotesModal,
  ChecklistProgressHeader,
  ChecklistRow,
  type ChecklistItemStatus,
  type ChecklistProgress,
} from "@/components/shared/checklist";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  Download,
  MoreVertical,
  RotateCcw,
  Search,
} from "lucide-react";
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

// The roll on the shared checklist kit: Present is a resolved (green) row, an
// Apology the amber attention row. Absent and not-yet-marked both sit on the
// plain row; the status control underneath says which.
function checklistStatus(mark: MarkStatus | null): ChecklistItemStatus {
  if (mark === "present") return "resolved";
  if (mark === "apology") return "attention";
  return "unanswered";
}

// The ring tracks how much of the roll has been marked, whatever the marks are
function progressOf(rows: RollRow[]): ChecklistProgress {
  const answered = rows.filter((row) => row.mark).length;
  const total = rows.length;
  return {
    resolved: answered,
    attention: 0,
    answered,
    total,
    percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
}

const ROLL_KIND_NAMES = { training: "Training", meeting: "Brigade Meeting" } as const;

const whoOf = (row: RollRow) =>
  row.member.rollMemberId
    ? { rollMemberId: row.member.rollMemberId }
    : { userId: row.member.userId! };

// Order of the three choices, and how each looks when chosen
const STATUS_OPTIONS: { status: MarkStatus; selected: string }[] = [
  { status: "present", selected: "bg-green-600 text-white border-green-600" },
  { status: "absent", selected: "bg-red-600 text-white border-red-600" },
  { status: "apology", selected: "bg-amber-500 text-white border-amber-500" },
];

/**
 * One night's roll, in roll order. Every member is marked one of three ways -
 * Present, Absent, or Apology (absent, but sent apologies) - and the difference
 * between the last two is a recorded stat. Apologies the Duty Officer took
 * before the night are already marked, so the Secretary can skip those names.
 * The DO sees the same screen but can only record apologies.
 */
export function NightRoll({ date }: { date: string }) {
  const navigate = useNavigate();
  // The list that opened this night says where Back returns; a direct link
  // lands on the Roll tab
  const backTo = (useLocation().state as { backTo?: string } | null)?.backTo ?? "/training";
  const data = useQuery(api.training.getNight, { date });
  const setMark = useMutation(api.training.setMark);
  const setMarkNote = useMutation(api.training.setMarkNote);
  const closeRoll = useMutation(api.training.closeRoll);
  const setNightCancelled = useMutation(api.training.setNightCancelled);
  const setNightKind = useMutation(api.training.setNightKind);

  const [search, setSearch] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  // Menu actions that change the night itself ask first
  const [confirmAction, setConfirmAction] = useState<"cancel" | "kind" | null>(null);
  // The row whose note is being edited, and the draft in the sheet
  const [noteRow, setNoteRow] = useState<RollRow | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
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

  const counts = { present: 0, absent: 0, apology: 0, unmarked: 0 };
  for (const row of rows) counts[row.mark?.status ?? "unmarked"]++;

  const mark = async (row: RollRow, status: MarkStatus | null) => {
    try {
      await setMark({ date, who: whoOf(row), status });
    } catch (error) {
      toast.error("Couldn't update the roll", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const saveNote = async (row: RollRow, note: string) => {
    try {
      await setMarkNote({ date, who: whoOf(row), note });
    } catch (error) {
      toast.error("Couldn't save the note", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  // Notes go with a mark; the Duty Officer may only note an apology they can still edit
  const canNote = (row: RollRow) =>
    !isCancelled &&
    row.mark !== null &&
    (canManage || (isOpen && row.mark.status === "apology"));

  // What this viewer may pick for a row. The Duty Officer only handles
  // apologies, and only before the roll is closed.
  const canChoose = (row: RollRow, status: MarkStatus) => {
    if (isCancelled) return false;
    if (canManage) return true;
    return (
      isOpen && status === "apology" && (!row.mark || row.mark.status === "apology")
    );
  };

  const choose = (row: RollRow, status: MarkStatus) => {
    const current = row.mark?.status ?? null;
    if (current === status) {
      // Tapping the chosen option again un-marks - but a closed roll has no
      // unmarked state, so there it stays as it is
      if (isOpen) void mark(row, null);
      return;
    }
    void mark(row, status);
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const absent = await closeRoll({ date });
      toast.success("Roll closed", {
        description: absent > 0 ? `${absent} unmarked recorded as Absent.` : undefined,
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
      toast.success(isCancelled ? "Roll restored" : "Roll cancelled");
    } catch (error) {
      toast.error("Couldn't change the roll", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const otherKind = night.kind === "meeting" ? "training" : "meeting";
  const kindLabel = night.kind === "other" ? "this roll" : ROLL_KIND_NAMES[night.kind];
  const otherKindLabel = ROLL_KIND_NAMES[otherKind];
  const handleKindSwitch = async () => {
    try {
      await setNightKind({ date, kind: otherKind });
      toast.success(otherKind === "meeting" ? "Now a Brigade Meeting" : "Now a Training night");
    } catch (error) {
      toast.error("Couldn't change the night", {
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  const exportCsv = () => {
    downloadCsv(`roll-${date}.csv`, [
      ["Name", "Rank", "CFA ID", "Status", "Recorded by", "Note"],
      ...rows.map((row) => [
        personName(row.member),
        rankLabel(row.member),
        row.member.memberNumber ?? "",
        row.mark ? MARK_LABELS[row.mark.status] : "Not marked",
        row.mark?.recordedBy ? personName(row.mark.recordedBy) : "",
        row.mark?.note ?? "",
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
          ) : undefined
        }
        notes={row.mark?.note ?? undefined}
        // Only offered once there's a mark to hang it on; the icon stays grey
        // until a note exists, so the roll still reads as a list of names
        onOpenNotes={
          canNote(row)
            ? () => {
                setNoteDraft(row.mark?.note ?? "");
                setNoteRow(row);
              }
            : undefined
        }
        footer={
          <div
            role="radiogroup"
            aria-label={`Mark ${personName(row.member)}`}
            className="grid grid-cols-3 gap-1.5"
          >
            {STATUS_OPTIONS.map((option) => {
              const selected = status === option.status;
              const enabled = canChoose(row, option.status);
              return (
                <button
                  key={option.status}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!enabled}
                  onClick={() => choose(row, option.status)}
                  className={cn(
                    "min-h-[44px] rounded-md border text-sm font-medium transition-colors",
                    selected
                      ? option.selected
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800",
                    !enabled && !selected && "opacity-40",
                    !enabled && "cursor-not-allowed"
                  )}
                >
                  {MARK_LABELS[option.status]}
                </button>
              );
            })}
          </div>
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
              onClick={() => navigate(backTo)}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 flex-shrink-0"
                    aria-label="Roll options"
                  >
                    <MoreVertical className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {night.kind !== "other" && !isCancelled && (
                    <DropdownMenuItem
                      className="min-h-[44px]"
                      onClick={() => setConfirmAction("kind")}
                    >
                      <ArrowLeftRight aria-hidden="true" />
                      Change to {otherKindLabel}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="min-h-[44px]" onClick={exportCsv}>
                    <Download aria-hidden="true" />
                    Export CSV
                  </DropdownMenuItem>
                  {night.status !== "closed" && (
                    <DropdownMenuItem
                      className="min-h-[44px]"
                      onClick={() =>
                        isCancelled ? void handleCancelToggle() : setConfirmAction("cancel")
                      }
                    >
                      {isCancelled ? (
                        <RotateCcw aria-hidden="true" />
                      ) : (
                        <Ban aria-hidden="true" />
                      )}
                      {isCancelled ? "Restore roll" : "Cancel roll"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {!canManage && (
            <p className="mt-2 text-sm text-muted-foreground">
              As Duty Officer you can record apologies. Tap Apology under a name.
            </p>
          )}
        </CardContent>
      </Card>

      {isCancelled ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            This roll was cancelled.
          </CardContent>
        </Card>
      ) : (
        <>
          <ChecklistProgressHeader
            progress={progressOf(rows)}
            answeredLabel="marked"
            title={
              <p className="text-xs text-muted-foreground">
                <span className="text-green-700 dark:text-green-400">{counts.present} present</span>
                {" · "}
                <span className="text-red-700 dark:text-red-400">{counts.absent} absent</span>
                {" · "}
                <span className="text-amber-700 dark:text-amber-400">
                  {counts.apology} {counts.apology === 1 ? "apology" : "apologies"}
                </span>
                {counts.unmarked > 0 && ` · ${counts.unmarked} to mark`}
              </p>
            }
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

          {search.trim() && (
            // Close roll acts on everyone, so say when the list is a slice of it
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span aria-live="polite">
                Showing {filtered.length} of {rows.length}
              </span>
              <Button variant="ghost" className="min-h-[44px]" onClick={() => setSearch("")}>
                Show everyone
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody matches.</p>
            ) : (
              filtered.map(renderRow)
            )}
          </div>

          {canManage && (
            <ChecklistActionBar
              state={isOpen ? "editable" : "completed"}
              primaryLabel="Close roll"
              onPrimary={() => setConfirmClose(true)}
              isSubmitting={closing}
              completedLabel={
                night.closedBy
                  ? `Roll closed by ${personName(night.closedBy)}. Marks can still be changed.`
                  : "Roll closed"
              }
            />
          )}
        </>
      )}

      <ChecklistNotesModal
        open={noteRow !== null}
        onClose={() => setNoteRow(null)}
        title={noteRow ? `Note for ${personName(noteRow.member)}` : "Note"}
        value={noteDraft}
        onChange={(value) => setNoteDraft(value.slice(0, 200))}
        onSave={() => {
          if (noteRow && noteDraft.trim() !== (noteRow.mark?.note ?? "")) {
            void saveNote(noteRow, noteDraft);
          }
          setNoteRow(null);
        }}
        placeholder="e.g. Arrived 20:30"
      />

      <DeleteConfirmDialog
        open={confirmAction === "kind"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={`Change to ${otherKindLabel}?`}
        description={`This night is currently ${kindLabel}. It will be recorded and reported as ${otherKindLabel} instead. Marks are kept, and you can change it back.`}
        confirmLabel={`Change to ${otherKindLabel}`}
        destructive={false}
        onConfirm={() => {
          setConfirmAction(null);
          void handleKindSwitch();
        }}
      />

      <DeleteConfirmDialog
        open={confirmAction === "cancel"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Cancel this roll?"
        description={`Use this when ${kindLabel} isn't going ahead. The night won't count towards anyone's attendance. You can restore it afterwards.`}
        confirmLabel="Cancel roll"
        cancelLabel="Keep roll"
        onConfirm={() => {
          setConfirmAction(null);
          void handleCancelToggle();
        }}
      />

      <DeleteConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close the roll?"
        description={
          counts.unmarked > 0
            ? `${counts.unmarked} ${counts.unmarked === 1 ? "member hasn't" : "members haven't"} been marked and will be recorded as Absent (no apology). You can still change any mark afterwards.`
            : "Everyone has been marked. You can still change any mark afterwards."
        }
        confirmLabel="Close roll"
        destructive={false}
        onConfirm={() => void handleClose()}
      />
    </div>
  );
}
