import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { DutyCrewHero } from "./DutyCrewHero";
import { StationChecksList } from "./StationChecksList";
import {
  allocationTargetKey,
  getUserFullName,
  isItemResolved,
  toUtcMidnight,
  weekBoundaries,
  type AllocationTarget,
  type CheckItemData,
  type ItemUser,
  type LinkedInventoryInfo,
} from "../types";

interface ThisWeekTabProps {
  isAdmin: boolean;
}

export function ThisWeekTab({ isAdmin }: ThisWeekTabProps) {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);

  const { sunday: currentSunday } = weekBoundaries(weekOffset);

  // Queries
  const stationChecks = useQuery(api.stationChecks.getAllStationChecks, {});
  const currentWeekStatus = useQuery(
    api.stationChecks.getCurrentWeekCheckStatus,
    { date: currentSunday.getTime() }
  );
  // Resolved per-date rather than from the upcoming list, which starts at
  // today and so leaves every past week looking unassigned.
  //
  // Convex runs in UTC, so the Sunday has to be sent as UTC midnight of its
  // calendar date. A local midnight (AEST = UTC+10) reads as the Saturday on
  // the server, which makes the rotation rule bail out and the schedule
  // lookup miss - dutyCrewSchedule rows are keyed to UTC midnight because
  // getUpcomingDutyCrewAssignments builds their timestamps server-side.
  // Checks satisfied by the Inventory module rather than by ticking. Derived
  // server-side from this week's completed runs.
  const linkedInventory = useQuery(api.stationChecks.getLinkedInventoryStatus, {
    date: currentSunday.getTime(),
  });
  // Whether to offer the "go to Inventory" button: Duty Crew and Inventory are
  // independent grants, and a shared account on a truck tablet may not have an
  // /inventory route at all. Sending someone to Access Denied is worse than
  // showing no button.
  const moduleAccess = useQuery(api.modules.getAllModuleAccess);
  const canOpenInventory = moduleAccess?.inventory ?? false;

  const sundayMidnight = toUtcMidnight(currentSunday);
  const weekCrew = useQuery(api.dutyCrew.getDutyCrewForDate, {
    date: sundayMidnight,
  });

  const currentAssignment = useMemo(
    () =>
      weekCrew
        ? {
            date: sundayMidnight,
            dutyCrew: {
              _id: weekCrew._id,
              name: weekCrew.name,
              number: weekCrew.number,
            },
            isSpecial: weekCrew.isSpecial,
            notes: weekCrew.notes,
          }
        : null,
    [weekCrew, sundayMidnight]
  );

  const dutyCrewIdForWeek =
    currentAssignment?.dutyCrew._id ??
    currentWeekStatus?.submission.dutyCrewId ??
    null;

  // Leader check
  const isLeader = useQuery(
    api.dutyCrew.isCurrentUserDutyCrewLeader,
    dutyCrewIdForWeek
      ? { dutyCrewId: dutyCrewIdForWeek }
      : "skip"
  );
  const crewMembers = useQuery(
    api.dutyCrewMembers.getDutyCrewMembers,
    dutyCrewIdForWeek ? { dutyCrewId: dutyCrewIdForWeek } : "skip"
  );
  const allocations = useQuery(
    api.stationCheckAllocations.getWeekAllocations,
    dutyCrewIdForWeek
      ? { date: currentSunday.getTime(), dutyCrewId: dutyCrewIdForWeek }
      : "skip"
  );

  // Who to name in the hero. The snapshot on the submission is the roster as
  // the week was actually worked; the live crew is only right for weeks that
  // predate snapshots, or that have no submission yet.
  const crewSnapshot = currentWeekStatus?.submission.crewSnapshot;
  const displayMembers = crewSnapshot
    ? crewSnapshot.members.map((member) => ({
        _id: member.userId,
        name: member.name,
        firstName: member.firstName,
        lastName: member.lastName,
        isLeader: member.isLeader,
      }))
    : crewMembers;

  // Mutations
  const saveDraftStationCheck = useMutation(
    api.stationChecks.saveDraftStationCheck
  );
  const setCheckAllocation = useMutation(
    api.stationCheckAllocations.setAllocation
  );

  // Local state
  const [checkItems, setCheckItems] = useState<CheckItemData[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");

  const loggedInUser = useQuery(api.auth.loggedInUser);
  const allocationByTarget = useMemo(() => {
    const result: Record<string, Id<"users">> = {};
    for (const allocation of allocations ?? []) {
      result[allocationTargetKey(allocation.target)] = allocation.assignedTo;
    }
    return result;
  }, [allocations]);

  // Map of user id -> user info for per-item "checked by" attribution
  const itemUsersById: Record<string, ItemUser> = {};
  for (const user of currentWeekStatus?.itemUsers ?? []) {
    itemUsersById[user._id] = user;
  }

  // Initialize check items from query data
  useEffect(() => {
    if (stationChecks) {
      if (currentWeekStatus) {
        setCheckItems(currentWeekStatus.submission.checkItems);
        setGeneralNotes(currentWeekStatus.submission.notes || "");
      } else {
        setCheckItems(
          stationChecks.flatMap((check) => [
            {
              checkId: check._id,
              name: check.name,
              area: check.area,
              isPriority: check.isPriority,
              isCompleted: false,
            },
            ...check.subItems.map((subItem) => ({
              subItemId: subItem._id,
              parentCheckId: check._id,
              name: subItem.name,
              area: check.area,
              isCompleted: false,
            })),
          ])
        );
        setGeneralNotes("");
      }
    }
  }, [stationChecks, currentWeekStatus]);

  // check id -> derived inventory state, for every active check that carries a
  // link. Built from the checks themselves so a link added mid-week appears
  // without a reload.
  const linkedByCheckId = useMemo(() => {
    const byTemplate = new Map<string, LinkedInventoryInfo>();
    for (const entry of linkedInventory ?? []) {
      byTemplate.set(entry.templateId, entry as LinkedInventoryInfo);
    }

    const result: Record<string, LinkedInventoryInfo> = {};
    for (const check of stationChecks ?? []) {
      if (!check.linkedApplianceTemplateId) continue;
      const info = byTemplate.get(check.linkedApplianceTemplateId);
      if (info) result[check._id] = info;
    }
    return result;
  }, [stationChecks, linkedInventory]);

  // What the checklist actually renders. The stored items stay untouched -
  // the server is what writes derived values - but a linked row must show the
  // live truth immediately when a run is completed in the other module, and
  // must disappear while its appliance is off the run.
  //
  // A submitted week is left exactly as recorded: derivation resumes only if
  // it is reopened.
  const displayItems: CheckItemData[] = useMemo(() => {
    const isFrozen = currentWeekStatus?.submission?.status === "completed";
    if (isFrozen) return checkItems;

    return checkItems.flatMap((item) => {
      const link = item.checkId ? linkedByCheckId[item.checkId] : undefined;
      if (!link) return [item];
      if (link.templateStatus !== "active") return [];

      const isCompleted = link.completedRunId !== undefined;
      return [
        {
          ...item,
          isCompleted,
          isNotApplicable: undefined,
          completedBy: isCompleted ? link.completedBy : undefined,
          completedAt: isCompleted ? link.completedAt : undefined,
        },
      ];
    });
  }, [checkItems, linkedByCheckId, currentWeekStatus]);

  const getDutyCrewId = useCallback((): Id<"dutyCrew"> | null => {
    if (currentAssignment) return currentAssignment.dutyCrew._id;
    if (currentWeekStatus) return currentWeekStatus.submission.dutyCrewId;
    return null;
  }, [currentAssignment, currentWeekStatus]);

  const saveDraft = useCallback(
    async (items: CheckItemData[], notes: string) => {
      const dutyCrewId = getDutyCrewId();
      if (!dutyCrewId) {
        toast.error("Could not determine the duty crew for this week.");
        return;
      }

      // A closed week is edited in place - a tick that lands Tuesday morning
      // for a Monday-night job just updates the record. Its summary email has
      // already gone and is not re-sent.
      const submissionId = currentWeekStatus?.submission?._id;
      await saveDraftStationCheck({
        date: currentSunday.getTime(),
        dutyCrewId,
        checkItems: items,
        notes,
        existingSubmissionId: submissionId,
      });
    },
    [
      getDutyCrewId,
      currentWeekStatus,
      currentSunday,
      saveDraftStationCheck,
    ]
  );

  const handleCheckToggle = async (
    checkId: Id<"stationChecks"> | undefined,
    subItemId: Id<"stationCheckSubitems"> | undefined,
    adHocName: string | undefined,
    isCompleted: boolean
  ) => {
    // Linked rows are ticked off by the Inventory module. Explain that rather
    // than silently swallowing the tap.
    const link = checkId ? linkedByCheckId[checkId] : undefined;
    if (link) {
      toast.info(`${link.templateName} is ticked off by the Inventory module`, {
        description: link.completedRunId
          ? "This week's inventory check is already done."
          : "Complete this week's inventory check and it will tick itself.",
        action: canOpenInventory
          ? {
              label: "Go to Inventory",
              onClick: () => navigate(`/inventory?template=${link.templateId}`),
            }
          : undefined,
      });
      return;
    }

    const prevItems = checkItems;
    const target = checkItems.find((item) =>
      subItemId
        ? item.subItemId === subItemId
        : checkId
          ? item.checkId === checkId
          : item.isAdHoc && item.name === adHocName
    );
    // Toggling an item someone else resolved rewrites their attribution -
    // offer an undo instead of doing it silently
    const overwritesOther =
      target &&
      isItemResolved(target) &&
      target.completedBy &&
      loggedInUser &&
      target.completedBy !== loggedInUser._id;

    const newItems = checkItems.map((item) => {
      if (subItemId && item.subItemId === subItemId) {
        return { ...item, isCompleted, isNotApplicable: undefined };
      }
      if (checkId && item.checkId === checkId) {
        // Completing an item clears any N/A marking
        return { ...item, isCompleted, isNotApplicable: undefined };
      }
      if (adHocName && item.isAdHoc && item.name === adHocName) {
        return { ...item, isCompleted, isNotApplicable: undefined };
      }
      return item;
    });
    setCheckItems(newItems);
    await saveDraft(newItems, generalNotes);

    if (overwritesOther && target) {
      const previousUser = itemUsersById[target.completedBy!];
      const wasLabel = target.isCompleted ? "completed" : "marked N/A";
      toast(
        `"${target.name}" was ${wasLabel} by ${
          previousUser ? getUserFullName(previousUser) : "another member"
        }`,
        {
          action: {
            label: "Undo",
            onClick: () => {
              setCheckItems(prevItems);
              void saveDraft(prevItems, generalNotes);
            },
          },
        }
      );
    }
  };

  const handleNotesChange = async (
    checkId: Id<"stationChecks"> | undefined,
    subItemId: Id<"stationCheckSubitems"> | undefined,
    adHocName: string | undefined,
    notes: string,
    isNotApplicable?: boolean
  ) => {
    const newItems = checkItems.map((item) => {
      if (
        (subItemId && item.subItemId === subItemId) ||
        (checkId && item.checkId === checkId) ||
        (adHocName && item.isAdHoc && item.name === adHocName)
      ) {
        if (isNotApplicable === undefined) {
          return { ...item, notes };
        }
        // Marking N/A clears completion; the reverse happens in handleCheckToggle
        return {
          ...item,
          notes,
          isNotApplicable: isNotApplicable || undefined,
          isCompleted: isNotApplicable ? false : item.isCompleted,
        };
      }
      return item;
    });
    setCheckItems(newItems);
    await saveDraft(newItems, generalNotes);
  };

  const handleGeneralNotesChange = async (notes: string) => {
    setGeneralNotes(notes);
    await saveDraft(checkItems, notes);
  };

  const handleAddAdHocItem = async (name: string) => {
    const newItem: CheckItemData = {
      name,
      isCompleted: false,
      isAdHoc: true,
    };
    const newItems = [...checkItems, newItem];
    setCheckItems(newItems);
    await saveDraft(newItems, generalNotes);
  };

  const handleRemoveAdHocItem = async (name: string) => {
    const newItems = checkItems.filter(
      (item) => !(item.isAdHoc && item.name === name)
    );
    setCheckItems(newItems);
    await saveDraft(newItems, generalNotes);
  };

  const handleAllocationChange = async (
    target: AllocationTarget,
    assignedTo: Id<"users"> | undefined
  ) => {
    if (!dutyCrewIdForWeek) return;
    try {
      await setCheckAllocation({
        date: currentSunday.getTime(),
        dutyCrewId: dutyCrewIdForWeek,
        target,
        assignedTo,
      });
      toast.success(assignedTo ? "Task allocated" : "Allocation cleared");
    } catch (error) {
      console.error("Error updating check allocation:", error);
      toast.error("Failed to update task allocation");
    }
  };

  const handleClearAllAllocations = async () => {
    if (!dutyCrewIdForWeek) return;
    const current = allocations ?? [];
    if (current.length === 0) return;
    try {
      await Promise.all(
        current.map((allocation) =>
          setCheckAllocation({
            date: currentSunday.getTime(),
            dutyCrewId: dutyCrewIdForWeek,
            target: allocation.target,
            assignedTo: undefined,
          })
        )
      );
      toast.success("All allocations cleared");
    } catch (error) {
      console.error("Error clearing check allocations:", error);
      toast.error("Failed to clear allocations");
    }
  };

  const submissionStatus: "draft" | "completed" | "not_started" =
    currentWeekStatus?.submission?.status ?? "not_started";

  // Loading state
  if (!stationChecks) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DutyCrewHero
        weekOffset={weekOffset}
        onWeekChange={setWeekOffset}
        currentSunday={currentSunday}
        assignment={currentAssignment}
        members={displayMembers}
        isHistoricalRoster={crewSnapshot !== undefined}
        submissionStatus={submissionStatus}
      />

      <StationChecksList
        checkItems={displayItems}
        linkedByCheckId={linkedByCheckId}
        canOpenInventory={canOpenInventory}
        generalNotes={generalNotes}
        onCheckToggle={handleCheckToggle}
        onNotesChange={handleNotesChange}
        onGeneralNotesChange={handleGeneralNotesChange}
        onAddAdHocItem={handleAddAdHocItem}
        onRemoveAdHocItem={handleRemoveAdHocItem}
        submissionStatus={submissionStatus}
        closedAt={currentWeekStatus?.submission?.closedAt}
        isLeader={isLeader === true}
        isAdmin={isAdmin}
        itemUsersById={itemUsersById}
        currentUserId={loggedInUser?._id}
        crewMembers={crewMembers ?? []}
        allocationByTarget={allocationByTarget}
        canAssign={
          isLeader === true && submissionStatus !== "completed"
        }
        onAllocationChange={handleAllocationChange}
        onClearAllAllocations={() => void handleClearAllAllocations()}
      />
    </div>
  );
}
