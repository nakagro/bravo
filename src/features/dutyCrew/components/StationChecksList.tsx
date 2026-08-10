import { useMemo, useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Accordion } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import {
  ChecklistActionBar,
  ChecklistNotesModal,
  ChecklistProgressHeader,
  ChecklistSection,
  summariseChecklist,
  useChecklistNavigation,
} from "@/components/shared/checklist";
import { StationCheckItem } from "./StationCheckItem";
import {
  checkItemStatus,
  isItemResolved,
  type CheckItemData,
  type ItemUser,
} from "../types";

interface StationChecksListProps {
  checkItems: CheckItemData[];
  generalNotes: string;
  onCheckToggle: (
    checkId: Id<"stationChecks"> | undefined,
    adHocName: string | undefined,
    isCompleted: boolean
  ) => void;
  onNotesChange: (
    checkId: Id<"stationChecks"> | undefined,
    adHocName: string | undefined,
    notes: string,
    isNotApplicable?: boolean
  ) => void;
  onGeneralNotesChange: (notes: string) => void;
  onSubmit: () => void;
  onAddAdHocItem: (name: string) => void;
  onRemoveAdHocItem: (name: string) => void;
  isSubmitting: boolean;
  submissionStatus: "draft" | "completed" | "not_started";
  isLeader: boolean;
  isAdmin: boolean;
  itemUsersById: Record<string, ItemUser>;
}

// Stable key for an item, used for scroll targets and highlight state
const itemKey = (item: CheckItemData) => item.checkId ?? `adhoc-${item.name}`;

const AD_HOC_SECTION = "section-adhoc";

export function StationChecksList({
  checkItems,
  generalNotes,
  onCheckToggle,
  onNotesChange,
  onGeneralNotesChange,
  onSubmit,
  onAddAdHocItem,
  onRemoveAdHocItem,
  isSubmitting,
  submissionStatus,
  isLeader,
  isAdmin,
  itemUsersById,
}: StationChecksListProps) {
  const [editingNotes, setEditingNotes] = useState<{
    type: "item" | "general";
    checkId?: Id<"stationChecks">;
    adHocName?: string;
    currentValue: string;
    isNotApplicable: boolean;
  } | null>(null);
  const [showAddAdHoc, setShowAddAdHoc] = useState(false);
  const [newAdHocName, setNewAdHocName] = useState("");
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const templateItems = useMemo(
    () => checkItems.filter((item) => !item.isAdHoc),
    [checkItems],
  );
  const adHocItems = useMemo(
    () => checkItems.filter((item) => item.isAdHoc),
    [checkItems],
  );
  const unresolvedItems = checkItems.filter((item) => !isItemResolved(item));
  const remainingCount = unresolvedItems.length;
  const progress = summariseChecklist(checkItems.map(checkItemStatus));
  const showAdHocSection = adHocItems.length > 0 || isLeader || isAdmin;

  // Group template items by area (first-seen order, following template order),
  // with a trailing "General" bucket for items without an area.
  const groupedTemplateItems = useMemo(() => {
    const named: { key: string; name: string; items: CheckItemData[] }[] = [];
    const general: CheckItemData[] = [];
    for (const item of templateItems) {
      if (item.area) {
        const group = named.find((g) => g.name === item.area);
        if (group) {
          group.items.push(item);
        } else {
          named.push({ key: `section-${item.area}`, name: item.area, items: [item] });
        }
      } else {
        general.push(item);
      }
    }
    if (general.length > 0) {
      named.push({ key: "section-general", name: "General", items: general });
    }
    // Priority checks surface at the top of their area (stable within each tier)
    for (const group of named) {
      group.items = [
        ...group.items.filter((i) => i.isPriority),
        ...group.items.filter((i) => !i.isPriority),
      ];
    }
    return named;
  }, [templateItems]);

  const sections = useMemo(
    () =>
      [
        ...groupedTemplateItems.map((g) => ({
          key: g.key,
          name: g.name,
          items: g.items,
        })),
        ...(showAdHocSection
          ? [{ key: AD_HOC_SECTION, name: "Additional Items", items: adHocItems }]
          : []),
      ].map((s) => ({
        ...s,
        progress: summariseChecklist(s.items.map(checkItemStatus)),
      })),
    [groupedTemplateItems, adHocItems, showAdHocSection],
  );

  const navSections = useMemo(
    () =>
      sections.map((s) => ({
        key: s.key,
        answered: s.progress.answered,
        total: s.progress.total,
      })),
    [sections],
  );

  const { registerSectionRef, openSections, setOpenSections } =
    useChecklistNavigation({ sections: navSections });

  const getCompletedByUser = (item: CheckItemData) =>
    item.completedBy ? itemUsersById[item.completedBy] ?? null : null;

  // No submit gate. A week that can't be finished still gets submitted, and the
  // notification names the outstanding items so the officer can follow up -
  // gating it just left weeks sitting in draft, telling nobody anything.
  const handleSubmit = () => {
    if (remainingCount > 0) {
      setShowSubmitConfirm(true);
      return;
    }
    onSubmit();
  };

  const handleSaveNotes = () => {
    if (!editingNotes) return;
    if (editingNotes.type === "general") {
      onGeneralNotesChange(editingNotes.currentValue);
    } else {
      onNotesChange(
        editingNotes.checkId,
        editingNotes.adHocName,
        editingNotes.currentValue,
        editingNotes.isNotApplicable
      );
    }
    setEditingNotes(null);
  };

  const handleAddAdHoc = () => {
    if (!newAdHocName.trim()) return;
    onAddAdHocItem(newAdHocName.trim());
    setNewAdHocName("");
    setShowAddAdHoc(false);
    toast.success("Ad-hoc item added");
  };

  const openItemNotes = (item: CheckItemData) =>
    setEditingNotes({
      type: "item",
      checkId: item.isAdHoc ? undefined : item.checkId,
      adHocName: item.isAdHoc ? item.name : undefined,
      currentValue: item.notes || "",
      isNotApplicable: !item.isCompleted && item.isNotApplicable === true,
    });

  // Empty state
  if (checkItems.length === 0 && !isLeader && !isAdmin) {
    return (
      <EmptyState
        icon={<AlertCircle className="h-10 w-10 text-red-500 dark:text-red-400" />}
        title="No station checks configured"
        description="Ask an admin to add station checks for the brigade."
      />
    );
  }

  const addAdHocControls = (isLeader || isAdmin) && (
    <>
      {showAddAdHoc ? (
        <div className="p-3 border-2 border-dashed border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
          <Label
            htmlFor="adhoc-name"
            className="text-xs font-medium text-purple-700 dark:text-purple-300"
          >
            New check item
          </Label>
          <Input
            id="adhoc-name"
            value={newAdHocName}
            onChange={(e) => setNewAdHocName(e.target.value)}
            placeholder="e.g., Check roof gutters"
            className="mt-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddAdHoc();
              if (e.key === "Escape") setShowAddAdHoc(false);
            }}
          />
          <div className="flex gap-2 mt-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddAdHoc(false);
                setNewAdHocName("");
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddAdHoc} disabled={!newAdHocName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Add
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddAdHoc(true)}
          className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 inline mr-1" aria-hidden="true" />
          Add ad-hoc item
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-3">
      <ChecklistProgressHeader progress={progress} />

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-3"
      >
        {sections.map((section) => (
          <ChecklistSection
            key={section.key}
            ref={registerSectionRef(section.key)}
            value={section.key}
            name={section.name}
            progress={section.progress}
            headerAction={
              section.key === AD_HOC_SECTION ? addAdHocControls : undefined
            }
          >
            {section.items.map((item) => (
              <StationCheckItem
                key={itemKey(item)}
                item={item}
                completedByUser={getCompletedByUser(item)}
                onToggle={() =>
                  onCheckToggle(
                    item.isAdHoc ? undefined : item.checkId,
                    item.isAdHoc ? item.name : undefined,
                    !item.isCompleted
                  )
                }
                onOpenNotes={() => openItemNotes(item)}
                onDelete={
                  item.isAdHoc ? () => setConfirmDeleteName(item.name) : undefined
                }
              />
            ))}
          </ChecklistSection>
        ))}
      </Accordion>

      {/* General notes */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            General Notes
          </h3>
        </div>

        <button
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-[0.98]"
          onClick={() =>
            setEditingNotes({
              type: "general",
              currentValue: generalNotes || "",
              isNotApplicable: false,
            })
          }
        >
          {generalNotes ? (
            <>
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Edit General Notes
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add General Notes
            </>
          )}
        </button>

        {generalNotes && (
          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {generalNotes}
            </p>
          </div>
        )}
      </div>

      <ChecklistActionBar
        state={submissionStatus === "completed" ? "completed" : "editable"}
        primaryLabel="Complete Checks"
        onPrimary={handleSubmit}
        primaryDisabled={checkItems.length === 0}
        isSubmitting={isSubmitting}
      />

      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Submit with {remainingCount} item{remainingCount !== 1 ? "s" : ""}{" "}
              outstanding?
            </AlertDialogTitle>
            <AlertDialogDescription>
              These weren't ticked off or marked N/A:{" "}
              {unresolvedItems
                .slice(0, 8)
                .map((item) => item.name)
                .join(", ")}
              {unresolvedItems.length > 8
                ? ` and ${unresolvedItems.length - 8} more`
                : ""}
              . They'll be named in the notification sent to the duty crew
              officer, so add a note or mark an item N/A now if you can explain
              why.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">
              Keep checking
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto"
              onClick={() => {
                setShowSubmitConfirm(false);
                onSubmit();
              }}
            >
              Submit anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteConfirmDialog
        open={confirmDeleteName !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteName(null);
        }}
        title="Remove ad-hoc item?"
        description={`"${confirmDeleteName ?? ""}" and any notes on it will be removed from this week's checklist.`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmDeleteName) onRemoveAdHocItem(confirmDeleteName);
          setConfirmDeleteName(null);
        }}
      />

      <ChecklistNotesModal
        open={!!editingNotes}
        onClose={() => setEditingNotes(null)}
        title={editingNotes?.type === "general" ? "General Notes" : "Check Notes"}
        value={editingNotes?.currentValue ?? ""}
        onChange={(value) =>
          setEditingNotes((prev) => (prev ? { ...prev, currentValue: value } : prev))
        }
        onSave={handleSaveNotes}
        placeholder={
          editingNotes?.type === "general"
            ? "Add general notes about this week's station checks..."
            : "Add notes about this specific check..."
        }
        unableToComplete={
          editingNotes?.type === "item"
            ? {
                label: "Couldn't be completed",
                description:
                  "Marks this item N/A so the week can still be submitted",
                value: editingNotes.isNotApplicable,
                onChange: (checked) =>
                  setEditingNotes((prev) =>
                    prev ? { ...prev, isNotApplicable: checked } : prev
                  ),
              }
            : undefined
        }
      />
    </div>
  );
}
