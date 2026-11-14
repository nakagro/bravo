import { useMemo, useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  MessageSquare,
  AlertCircle,
  Info,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  ChecklistNotesModal,
  ChecklistProgressHeader,
  ChecklistSection,
  summariseChecklist,
  useChecklistNavigation,
} from "@/components/shared/checklist";
import { StationCheckItem } from "./StationCheckItem";
import {
  AssignmentChip,
  MemberPickerSheet,
} from "./CheckAssignmentControls";
import {
  allocationTargetKey,
  checkItemStatus,
  formatDateShort,
  getUserFullName,
  type AllocationTarget,
  type CheckItemData,
  type CrewAssignmentMember,
  type ItemUser,
  type LinkedInventoryInfo,
} from "../types";

interface StationChecksListProps {
  checkItems: CheckItemData[];
  /** Derived inventory state, keyed by check id, for rows the Inventory module ticks. */
  linkedByCheckId?: Record<string, LinkedInventoryInfo>;
  /** Whether the viewer can reach /inventory - gates the nav button, not the row. */
  canOpenInventory?: boolean;
  generalNotes: string;
  onCheckToggle: (
    checkId: Id<"stationChecks"> | undefined,
    subItemId: Id<"stationCheckSubitems"> | undefined,
    adHocName: string | undefined,
    isCompleted: boolean
  ) => void;
  onNotesChange: (
    checkId: Id<"stationChecks"> | undefined,
    subItemId: Id<"stationCheckSubitems"> | undefined,
    adHocName: string | undefined,
    notes: string,
    isNotApplicable?: boolean
  ) => void;
  onGeneralNotesChange: (notes: string) => void;
  onAddAdHocItem: (name: string) => void;
  onRemoveAdHocItem: (name: string) => void;
  submissionStatus: "draft" | "completed" | "not_started";
  /** When the week closed itself; absent on weeks closed by the old button. */
  closedAt?: number;
  isLeader: boolean;
  isAdmin: boolean;
  itemUsersById: Record<string, ItemUser>;
  crewMembers: CrewAssignmentMember[];
  allocationByTarget: Record<string, Id<"users">>;
  canAssign: boolean;
  onAllocationChange: (
    target: AllocationTarget,
    assignedTo: Id<"users"> | undefined
  ) => void;
  /** Drops every allocation for the week in one go. */
  onClearAllAllocations: () => void;
  /** The viewer, for the "Mine" filter over their allocated checks. */
  currentUserId?: Id<"users">;
}

// Stable key for an item, used for scroll targets and highlight state
const itemKey = (item: CheckItemData) =>
  item.subItemId ?? item.checkId ?? `adhoc-${item.name}`;

const AD_HOC_SECTION = "section-adhoc";

// Who an item is allocated to: its own allocation, else its area's. A subitem
// doesn't inherit its parent check's. Mirrors effectiveAssignee in
// convex/lib/stationCheckAllocations.ts.
const assigneeOf = (
  item: CheckItemData,
  allocationByTarget: Record<string, Id<"users">>,
) => {
  const target: AllocationTarget | null = item.subItemId
    ? { kind: "subitem", subItemId: item.subItemId }
    : item.checkId
      ? { kind: "check", checkId: item.checkId }
      : null;
  const direct = target ? allocationByTarget[allocationTargetKey(target)] : undefined;
  const area = item.area
    ? allocationByTarget[allocationTargetKey({ kind: "area", area: item.area })]
    : undefined;
  return direct ?? area;
};

export function StationChecksList({
  checkItems,
  linkedByCheckId,
  canOpenInventory = false,
  generalNotes,
  onCheckToggle,
  onNotesChange,
  onGeneralNotesChange,
  onAddAdHocItem,
  onRemoveAdHocItem,
  submissionStatus,
  closedAt,
  isLeader,
  isAdmin,
  itemUsersById,
  crewMembers,
  allocationByTarget,
  canAssign,
  onAllocationChange,
  onClearAllAllocations,
  currentUserId,
}: StationChecksListProps) {
  const [editingNotes, setEditingNotes] = useState<{
    type: "item" | "general";
    checkId?: Id<"stationChecks">;
    subItemId?: Id<"stationCheckSubitems">;
    adHocName?: string;
    currentValue: string;
    isNotApplicable: boolean;
  } | null>(null);
  const [showAddAdHoc, setShowAddAdHoc] = useState(false);
  const [newAdHocName, setNewAdHocName] = useState("");
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  // Allocating is an optional side-activity for the leader, so it lives behind
  // a mode rather than putting an "Assign" control on every single row.
  const [allocateMode, setAllocateMode] = useState(false);
  const [picker, setPicker] = useState<{
    target: AllocationTarget;
    title: string;
    selectedId?: Id<"users">;
    canClear: boolean;
    clearLabel?: string;
  } | null>(null);

  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const allocationCount = Object.keys(allocationByTarget).length;

  const memberById = useMemo(() => {
    const map: Record<string, CrewAssignmentMember> = {};
    for (const member of crewMembers) map[member._id] = member;
    return map;
  }, [crewMembers]);

  const templateItems = useMemo(
    () => checkItems.filter((item) => !item.isAdHoc),
    [checkItems],
  );
  const adHocItems = useMemo(
    () => checkItems.filter((item) => item.isAdHoc),
    [checkItems],
  );
  const progress = summariseChecklist(checkItems.map(checkItemStatus));
  const showAdHocSection = adHocItems.length > 0 || isLeader || isAdmin;

  // Group template items by area (first-seen order, following template order),
  // with a trailing "General" bucket for items without an area.
  const groupedTemplateItems = useMemo(() => {
    const named: {
      key: string;
      name: string;
      area?: string;
      items: CheckItemData[];
    }[] = [];
    const general: CheckItemData[] = [];
    const parentItems = templateItems.filter((item) => !item.parentCheckId);
    const childrenByParent = new Map<string, CheckItemData[]>();
    for (const item of templateItems) {
      if (!item.parentCheckId) continue;
      const children = childrenByParent.get(item.parentCheckId) ?? [];
      children.push(item);
      childrenByParent.set(item.parentCheckId, children);
    }

    for (const item of parentItems) {
      if (item.area) {
        const group = named.find((g) => g.name === item.area);
        if (group) {
          group.items.push(item);
        } else {
          named.push({
            key: `section-${item.area}`,
            name: item.area,
            area: item.area,
            items: [item],
          });
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
      const sortedParents = [
        ...group.items.filter((i) => i.isPriority),
        ...group.items.filter((i) => !i.isPriority),
      ];
      group.items = sortedParents.flatMap((item) => [
        item,
        ...(item.checkId ? childrenByParent.get(item.checkId) ?? [] : []),
      ]);
    }
    return named;
  }, [templateItems]);

  const sections = useMemo(
    () =>
      [
        ...groupedTemplateItems.map((g) => ({
          key: g.key,
          name: g.name,
          area: g.area,
          items: g.items,
        })),
        ...(showAdHocSection
          ? [
              {
                key: AD_HOC_SECTION,
                name: "Additional Items",
                area: undefined,
                items: adHocItems,
              },
            ]
          : []),
      ].map((s) => ({
        ...s,
        progress: summariseChecklist(s.items.map(checkItemStatus)),
      })),
    [groupedTemplateItems, adHocItems, showAdHocSection],
  );

  const myItems = useMemo(
    () =>
      currentUserId
        ? checkItems.filter(
            (item) => assigneeOf(item, allocationByTarget) === currentUserId
          )
        : [],
    [checkItems, allocationByTarget, currentUserId],
  );
  const myProgress = summariseChecklist(myItems.map(checkItemStatus));
  // Falls back to everything if the viewer's allocations are cleared mid-view
  const showingMine = onlyMine && myItems.length > 0;

  const visibleSections = useMemo(() => {
    if (!showingMine) return sections;
    const mine = new Set(myItems.map(itemKey));
    // A subitem on its own reads as nonsense ("Tyres"), so keep its parent row
    // as context even when the parent itself isn't the viewer's.
    const parentsOfMine = new Set(
      myItems.map((item) => item.parentCheckId).filter(Boolean)
    );
    return sections
      .map((s) => {
        const items = s.items.filter(
          (item) =>
            mine.has(itemKey(item)) ||
            (!item.parentCheckId && item.checkId && parentsOfMine.has(item.checkId))
        );
        return { ...s, items, progress: summariseChecklist(items.map(checkItemStatus)) };
      })
      .filter((s) => s.items.length > 0);
  }, [showingMine, sections, myItems]);

  // Who's on the hook for each section, shown on the collapsed header so a
  // member can spot their own name without opening every area.
  const allocationSummaryBySection = useMemo(() => {
    const summary: Record<string, { areaName?: string; itemNames: string[] }> = {};
    for (const section of sections) {
      const areaAssignedTo = section.area
        ? allocationByTarget[
            allocationTargetKey({ kind: "area", area: section.area })
          ]
        : undefined;
      const itemNames: string[] = [];
      for (const item of section.items) {
        const target: AllocationTarget | null = item.subItemId
          ? { kind: "subitem", subItemId: item.subItemId }
          : item.checkId
            ? { kind: "check", checkId: item.checkId }
            : null;
        if (!target) continue;
        const assignedTo = allocationByTarget[allocationTargetKey(target)];
        if (!assignedTo || assignedTo === areaAssignedTo) continue;
        const member = memberById[assignedTo];
        const label = member ? getUserFullName(member) : undefined;
        if (label && !itemNames.includes(label)) itemNames.push(label);
      }
      const areaMember = areaAssignedTo ? memberById[areaAssignedTo] : undefined;
      summary[section.key] = {
        areaName: areaMember ? getUserFullName(areaMember) : undefined,
        itemNames,
      };
    }
    return summary;
  }, [sections, allocationByTarget, memberById]);

  const navSections = useMemo(
    () =>
      visibleSections.map((s) => ({
        key: s.key,
        answered: s.progress.answered,
        total: s.progress.total,
      })),
    [visibleSections],
  );

  const { registerSectionRef, openSections, setOpenSections } =
    useChecklistNavigation({ sections: navSections });

  const getCompletedByUser = (item: CheckItemData) =>
    item.completedBy ? itemUsersById[item.completedBy] ?? null : null;

  const handleSaveNotes = () => {
    if (!editingNotes) return;
    if (editingNotes.type === "general") {
      onGeneralNotesChange(editingNotes.currentValue);
    } else {
      onNotesChange(
        editingNotes.checkId,
        editingNotes.subItemId,
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
      subItemId: item.subItemId,
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
      <ChecklistProgressHeader
        progress={progress}
        trailing={
          canAssign ? (
            <Button
              variant={allocateMode ? "secondary" : "ghost"}
              size="sm"
              className="h-9 text-muted-foreground data-[active=true]:text-blue-700 dark:data-[active=true]:text-blue-300"
              data-active={allocateMode}
              aria-pressed={allocateMode}
              onClick={() => setAllocateMode((prev) => !prev)}
            >
              {allocateMode ? (
                <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              ) : (
                <UsersRound className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              )}
              {allocateMode ? "Done" : "Allocate tasks"}
            </Button>
          ) : undefined
        }
      />

      {myItems.length > 0 && !allocateMode && (
        <div
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
          role="group"
          aria-label="Show checks"
        >
          <Button
            variant={showingMine ? "ghost" : "secondary"}
            size="sm"
            className="h-10"
            aria-pressed={!showingMine}
            onClick={() => setOnlyMine(false)}
          >
            All checks
          </Button>
          <Button
            variant={showingMine ? "secondary" : "ghost"}
            size="sm"
            className="h-10"
            aria-pressed={showingMine}
            onClick={() => setOnlyMine(true)}
          >
            <UserRound className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Mine
            <span className="ml-1.5 tabular-nums text-muted-foreground">
              {myProgress.answered}/{myProgress.total}
            </span>
          </Button>
        </div>
      )}

      {canAssign && allocateMode && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/40">
          <div className="flex items-start gap-2">
            <UsersRound
              className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <p className="text-xs text-blue-800 dark:text-blue-200">
              Tap a task or an area to hand it to someone, or tap the{" "}
              <X className="inline size-3" aria-hidden="true" /> beside a name to
              unassign. Allocating is optional - anyone on the crew can still tick
              anything off.
            </p>
          </div>
          {allocationCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-8 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              onClick={() => setShowClearAllConfirm(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Clear all {allocationCount} allocation
              {allocationCount === 1 ? "" : "s"}
            </Button>
          )}
        </div>
      )}

      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="space-y-3"
      >
        {visibleSections.map((section) => (
          <ChecklistSection
            key={section.key}
            ref={registerSectionRef(section.key)}
            value={section.key}
            name={section.name}
            progress={section.progress}
            headerMeta={(() => {
              const summary = allocationSummaryBySection[section.key];
              if (!summary || (!summary.areaName && summary.itemNames.length === 0))
                return undefined;
              return (
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-blue-700 dark:text-blue-300">
                  <UserRound className="size-3 shrink-0" aria-hidden="true" />
                  {summary.areaName ? (
                    <span>
                      {summary.areaName}
                      <span className="text-muted-foreground"> (whole area)</span>
                    </span>
                  ) : null}
                  {summary.areaName && summary.itemNames.length > 0 ? (
                    <span className="text-muted-foreground">-</span>
                  ) : null}
                  {summary.itemNames.length > 0 ? (
                    <span>{summary.itemNames.join(", ")}</span>
                  ) : null}
                </p>
              );
            })()}
            headerAction={
              <>
                {section.area
                  ? (() => {
                      const target: AllocationTarget = {
                        kind: "area",
                        area: section.area,
                      };
                      const assignedTo =
                        allocationByTarget[allocationTargetKey(target)];
                      const member = assignedTo
                        ? memberById[assignedTo]
                        : undefined;
                      if (!member && !allocateMode) return null;
                      return (
                        <div className="flex items-center gap-2 pb-1">
                          <span className="text-xs text-muted-foreground">
                            Whole area:
                          </span>
                          <AssignmentChip
                            member={member}
                            label={`Assign ${section.name} area`}
                            onPress={
                              allocateMode
                                ? () =>
                                    setPicker({
                                      target,
                                      title: `Assign ${section.name}`,
                                      selectedId: assignedTo,
                                      canClear: !!assignedTo,
                                    })
                                : undefined
                            }
                            onClear={
                              allocateMode
                                ? () => onAllocationChange(target, undefined)
                                : undefined
                            }
                          />
                        </div>
                      );
                    })()
                  : null}
                {section.key === AD_HOC_SECTION ? addAdHocControls : null}
              </>
            }
          >
            {section.items.map((item) => {
              const target: AllocationTarget | null = item.subItemId
                ? { kind: "subitem", subItemId: item.subItemId }
                : item.checkId
                  ? { kind: "check", checkId: item.checkId }
                  : null;
              const directAssignedTo = target
                ? allocationByTarget[allocationTargetKey(target)]
                : undefined;
              const areaAssignedTo = item.area
                ? allocationByTarget[
                    allocationTargetKey({ kind: "area", area: item.area })
                  ]
                : undefined;
              const effectiveAssignedTo = directAssignedTo ?? areaAssignedTo;

              return (
                <div
                  key={itemKey(item)}
                  className={
                    item.parentCheckId
                      ? "ml-5 border-l-2 border-muted pl-3 sm:ml-8"
                      : undefined
                  }
                >
                  <StationCheckItem
                    item={item}
                    linked={item.checkId ? linkedByCheckId?.[item.checkId] : undefined}
                    canOpenInventory={canOpenInventory}
                    completedByUser={getCompletedByUser(item)}
                    onToggle={() =>
                      onCheckToggle(
                        item.isAdHoc ? undefined : item.checkId,
                        item.subItemId,
                        item.isAdHoc ? item.name : undefined,
                        !item.isCompleted
                      )
                    }
                    onOpenNotes={() => openItemNotes(item)}
                    onDelete={
                      item.isAdHoc
                        ? () => setConfirmDeleteName(item.name)
                        : undefined
                    }
                    assignment={
                      target ? (
                        <AssignmentChip
                          member={
                            effectiveAssignedTo
                              ? memberById[effectiveAssignedTo]
                              : undefined
                          }
                          inherited={!directAssignedTo && !!areaAssignedTo}
                          label={`Assign ${item.name}`}
                          onPress={
                            allocateMode
                              ? () =>
                                  setPicker({
                                    target,
                                    title: `Assign "${item.name}"`,
                                    selectedId: directAssignedTo,
                                    canClear: !!directAssignedTo,
                                    clearLabel: areaAssignedTo
                                      ? "Use area allocation"
                                      : "Clear allocation",
                                  })
                              : undefined
                          }
                          onClear={
                            allocateMode && directAssignedTo
                              ? () => onAllocationChange(target, undefined)
                              : undefined
                          }
                        />
                      ) : undefined
                    }
                  />
                </div>
              );
            })}
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

      {/* Nothing to submit. The week closes itself early Tuesday and the
          summary names what was and wasn't done - coming back to press a
          button told the officer nothing a closed week doesn't. */}
      <p
        className="flex items-start gap-2 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs text-gray-500 dark:text-gray-400"
        data-component="WeekCloseNote"
      >
        <Info className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden="true" />
        {submissionStatus === "completed"
          ? `This week closed${closedAt ? ` on ${formatDateShort(closedAt)}` : ""} and its summary has gone to the duty crew officer. Late ticks still save to the record.`
          : "No need to submit. The week closes on its own early Tuesday morning, and the duty crew officer gets a summary of what was and wasn't done."}
      </p>

      <ConfirmDialog
        tone="destructive"
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

      <ConfirmDialog
        tone="destructive"
        open={showClearAllConfirm}
        onOpenChange={setShowClearAllConfirm}
        title="Clear all allocations?"
        description={`All ${allocationCount} task allocation${
          allocationCount === 1 ? "" : "s"
        } for this week will be removed. The checks themselves and anything already ticked off are untouched.`}
        confirmLabel="Clear all"
        onConfirm={() => {
          onClearAllAllocations();
          setShowClearAllConfirm(false);
        }}
      />

      <MemberPickerSheet
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker?.title ?? "Assign task"}
        members={crewMembers}
        selectedId={picker?.selectedId}
        canClear={picker?.canClear ?? false}
        clearLabel={picker?.clearLabel}
        onSelect={(userId) => {
          if (picker) onAllocationChange(picker.target, userId);
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
