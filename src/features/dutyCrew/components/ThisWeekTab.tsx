import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { DutyCrewHero } from "./DutyCrewHero";
import { StationChecksList } from "./StationChecksList";
import type { CheckItemData } from "../types";

interface ThisWeekTabProps {
  isAdmin: boolean;
}

export function ThisWeekTab({ isAdmin }: ThisWeekTabProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate week boundaries
  const calculateWeekBoundaries = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  };

  const { sunday: currentSunday } = calculateWeekBoundaries();

  // Queries
  const stationChecks = useQuery(api.stationChecks.getAllStationChecks, {});
  const currentWeekStatus = useQuery(
    api.stationChecks.getCurrentWeekCheckStatus,
    { date: currentSunday.getTime() }
  );
  const upcomingAssignments = useQuery(
    api.dutyCrew.getUpcomingDutyCrewAssignments,
    { count: 8 }
  );

  // Find the assignment for this specific week's Sunday
  const currentAssignment = upcomingAssignments?.find((a) => {
    const aDate = new Date(a.date);
    const sDate = new Date(currentSunday);
    return (
      aDate.getFullYear() === sDate.getFullYear() &&
      aDate.getMonth() === sDate.getMonth() &&
      aDate.getDate() === sDate.getDate()
    );
  }) ?? null;

  // Leader check
  const isLeader = useQuery(
    api.dutyCrew.isCurrentUserDutyCrewLeader,
    currentAssignment
      ? { dutyCrewId: currentAssignment.dutyCrew._id }
      : "skip"
  );

  // Mutations
  const submitStationCheck = useMutation(api.stationChecks.submitStationCheck);
  const saveDraftStationCheck = useMutation(
    api.stationChecks.saveDraftStationCheck
  );
  const reopenStationCheck = useMutation(api.stationChecks.reopenStationCheck);

  // Local state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkItems, setCheckItems] = useState<CheckItemData[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");

  // Initialize check items from query data
  useEffect(() => {
    if (stationChecks) {
      if (currentWeekStatus) {
        setCheckItems(currentWeekStatus.submission.checkItems);
        setGeneralNotes(currentWeekStatus.submission.notes || "");
      } else {
        setCheckItems(
          stationChecks.map((check) => ({
            checkId: check._id,
            name: check.name,
            isCompleted: false,
          }))
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
    adHocName: string | undefined,
    isCompleted: boolean
  ) => {
    const newItems = checkItems.map((item) => {
      if (checkId && item.checkId === checkId) {
        return { ...item, isCompleted };
      }
      if (adHocName && item.isAdHoc && item.name === adHocName) {
        return { ...item, isCompleted };
      }
      return item;
    });
    setCheckItems(newItems);
    await saveDraft(newItems, generalNotes);
  };

  const handleNotesChange = async (
    checkId: Id<"stationChecks"> | undefined,
    adHocName: string | undefined,
    notes: string
  ) => {
    const newItems = checkItems.map((item) => {
      if (checkId && item.checkId === checkId) {
        return { ...item, notes };
      }
      if (adHocName && item.isAdHoc && item.name === adHocName) {
        return { ...item, notes };
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
        checkItems={checkItems}
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
      />
    </div>
  );
}
