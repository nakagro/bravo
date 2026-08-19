import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
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
} from "../types";

interface ThisWeekTabProps {
  isAdmin: boolean;
}

export function ThisWeekTab({ isAdmin }: ThisWeekTabProps) {
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
  const submitStationCheck = useMutation(api.stationChecks.submitStationCheck);
  const saveDraftStationCheck = useMutation(
    api.stationChecks.saveDraftStationCheck
  );
  const reopenStationCheck = useMutation(api.stationChecks.reopenStationCheck);
  const setCheckAllocation = useMutation(
    api.stationCheckAllocations.setAllocation
  );

  // Local state
  const [isSubmitting, setIsSubmitting] = useState(false);
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

      const submissionId = currentWeekStatus?.submission?._id;
      if (currentWeekStatus?.submission?.status === "completed" && submissionId) {
        await reopenStationCheck({ submissionId });
        toast.info(
          "Week reopened - tap Complete Checks again when you're finished."
        );
      }

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
      reopenStationCheck,
      saveDraftStationCheck,
    ]
  );

  const handleCheckToggle = async (
    checkId: Id<"stationChecks"> | undefined,
    subItemId: Id<"stationCheckSubitems"> | undefined,
    adHocName: string | undefined,
    isCompleted: boolean
  ) => {
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

  const handleSubmit = async () => {
    const dutyCrewId = getDutyCrewId();
    if (!dutyCrewId) {
      toast.error("Could not determine the duty crew for this week.");
      return;
    }

    try {
      setIsSubmitting(true);
      await submitStationCheck({
        date: currentSunday.getTime(),
        dutyCrewId,
        checkItems,
        notes: generalNotes,
        existingSubmissionId: currentWeekStatus?.submission?._id,
      });
      toast.success("Station checks completed!");
    } catch (error) {
      console.error("Error submitting station checks:", error);
      toast.error("Failed to submit station checks. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    const submissionId = currentWeekStatus?.submission?._id;
    if (!submissionId) return;
    try {
      await reopenStationCheck({ submissionId });
      toast.info("Station checks reopened for editing.");
    } catch (error) {
      console.error("Error reopening station check:", error);
      toast.error("Failed to reopen station checks.");
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
        onReopen={handleReopen}
        canReopen={isAdmin || isLeader === true}
      />

      <StationChecksList
        checkItems={checkItems}
        generalNotes={generalNotes}
        onCheckToggle={handleCheckToggle}
        onNotesChange={handleNotesChange}
        onGeneralNotesChange={handleGeneralNotesChange}
        onSubmit={handleSubmit}
        onAddAdHocItem={handleAddAdHocItem}
        onRemoveAdHocItem={handleRemoveAdHocItem}
        isSubmitting={isSubmitting}
        submissionStatus={submissionStatus}
        isLeader={isLeader === true}
        isAdmin={isAdmin}
        itemUsersById={itemUsersById}
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
