import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentCheckIcon,
  PencilIcon,
  PlusIcon,
  CheckIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ChatBubbleLeftIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";

export function StationChecksTab() {
  // State for week navigation
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, 1 = next week, etc.

  // Calculate the week's boundaries (Monday to Sunday) based on weekOffset
  const calculateWeekBoundaries = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Calculate the date of the current week's Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setHours(0, 0, 0, 0);

    // Apply week offset
    monday.setDate(monday.getDate() + weekOffset * 7);

    // Calculate the date of the week's Sunday
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const { sunday: currentSunday, monday: currentWeekMonday } =
    calculateWeekBoundaries();

  // Queries and mutations
  const stationChecks = useQuery(api.stationChecks.getAllStationChecks, {});
  const currentWeekStatus = useQuery(
    api.stationChecks.getCurrentWeekCheckStatus,
    {
      date: currentSunday.getTime(), // Pass the Sunday date of the selected week
    }
  );
  const submitStationCheck = useMutation(api.stationChecks.submitStationCheck);
  const saveDraftStationCheck = useMutation(
    api.stationChecks.saveDraftStationCheck
  );
  const reopenStationCheck = useMutation(api.stationChecks.reopenStationCheck);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkItems, setCheckItems] = useState<
    Array<{
      checkId: Id<"stationChecks">;
      name: string;
      isCompleted: boolean;
      notes?: string;
      completedBy?: Id<"users">;
      completedAt?: number;
    }>
  >([]);
  const [generalNotes, setGeneralNotes] = useState("");

  const [editingNotes, setEditingNotes] = useState<{
    type: 'item' | 'general';
    checkId?: Id<"stationChecks">;
    currentValue: string;
  } | null>(null);

  // Reset form state when week changes
  useEffect(() => {
    // Clear any success messages
    // setSuccessMessage(null);
  }, [weekOffset]);

  // Initialize checkItems based on whether we have existing checks or need to create new ones
  useEffect(() => {
    if (stationChecks) {
      // If we have a current week status, use its data
      if (currentWeekStatus) {
        setCheckItems(currentWeekStatus.submission.checkItems);
        setGeneralNotes(currentWeekStatus.submission.notes || "");
      } else {
        // Otherwise, initialize with empty check items
        setCheckItems(
          stationChecks.map((check) => ({
            checkId: check._id,
            name: check.name,
            isCompleted: false,
          }))
        );
      }
    }
  }, [stationChecks, currentWeekStatus]);

  // Handle checkbox change
  const handleCheckboxChange = async (
    checkId: Id<"stationChecks">,
    isCompleted: boolean
  ) => {
    if (!stationChecks || !currentWeekStatus) return;
    if (!currentWeekStatus.submission) return;
    if (!currentWeekStatus.submission.dutyCrewId) return;
    if (!upcomingAssignments || upcomingAssignments.length === 0) {
      alert("Could not determine the duty crew for this week.");
      return;
    }
    const submissionId = currentWeekStatus.submission._id;
    if (currentWeekStatus.submission.status === "completed") {
      await reopenStationCheck({ submissionId });
    }
    const newItems = checkItems.map((item) =>
      item.checkId === checkId ? { ...item, isCompleted } : item
    );
    setCheckItems(newItems);
    await saveDraftStationCheck({
      date: currentSunday.getTime(),
      dutyCrewId: upcomingAssignments[0].dutyCrew._id,
      checkItems: newItems,
      notes: generalNotes,
      existingSubmissionId: submissionId,
    });
  };

  // Handle notes change
  const handleNotesChange = async (
    checkId: Id<"stationChecks">,
    notes: string
  ) => {
    if (!stationChecks || !currentWeekStatus) return;
    if (!currentWeekStatus.submission) return;
    if (!currentWeekStatus.submission.dutyCrewId) return;
    if (!upcomingAssignments || upcomingAssignments.length === 0) {
      alert("Could not determine the duty crew for this week.");
      return;
    }
    const submissionId = currentWeekStatus.submission._id;
    if (currentWeekStatus.submission.status === "completed") {
      await reopenStationCheck({ submissionId });
    }
    const newItems = checkItems.map((item) =>
      item.checkId === checkId ? { ...item, notes } : item
    );
    setCheckItems(newItems);
    await saveDraftStationCheck({
      date: currentSunday.getTime(),
      dutyCrewId: upcomingAssignments[0].dutyCrew._id,
      checkItems: newItems,
      notes: generalNotes,
      existingSubmissionId: submissionId,
    });
  };

  const handleGeneralNotesChange = async (notes: string) => {
    if (!upcomingAssignments || upcomingAssignments.length === 0) {
      alert("Could not determine the duty crew for this week.");
      return;
    }
    const submissionId = currentWeekStatus?.submission?._id;
    if (
      currentWeekStatus?.submission?.status === "completed" &&
      submissionId
    ) {
      await reopenStationCheck({ submissionId });
    }
    setGeneralNotes(notes);
    await saveDraftStationCheck({
      date: currentSunday.getTime(),
      dutyCrewId: upcomingAssignments[0].dutyCrew._id,
      checkItems,
      notes,
      existingSubmissionId: submissionId,
    });
  };

  // Use the query hook to get upcoming duty crew assignments
  const upcomingAssignments = useQuery(
    api.dutyCrew.getUpcomingDutyCrewAssignments,
    {
      count: 1,
    }
  );

  // Handle submit
  const handleSubmit = async () => {
    if (!stationChecks || checkItems.length === 0) return;
    if (!upcomingAssignments || upcomingAssignments.length === 0) {
      alert(
        "Could not determine the duty crew for this week. Please try again or contact an administrator."
      );
      return;
    }

    try {
      setIsSubmitting(true);

      // Get the current duty crew assignment
      const assignment = upcomingAssignments[0];

      console.log("Submitting station check:", {
        date: currentSunday.getTime(),
        dutyCrewId: assignment.dutyCrew._id,
        checkItems: checkItems.length,
        hasNotes: !!generalNotes,
      });

      // Use the existing submission ID if we're editing or if there's a draft
      const existingSubmissionId = currentWeekStatus?.submission?._id;

      // Submit the station check
      await submitStationCheck({
        date: currentSunday.getTime(),
        dutyCrewId: assignment.dutyCrew._id,
        checkItems,
        notes: generalNotes,
        existingSubmissionId,
      });

      // Reset UI state after successful submission

      // Clear form data
      setCheckItems([]);
      setGeneralNotes("");

      // Show success message
      // setSuccessMessage('Station checks submitted successfully!');

      // Clear the success message after 5 seconds
      // setTimeout(() => {
      //   setSuccessMessage(null);
      // }, 5000);
    } catch (error) {
      console.error("Error submitting station checks:", error);
      alert(
        "An error occurred while submitting the station checks. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format date to display in a readable format
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format time to display in a readable format
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get user's full name
  const getUserFullName = (user: {
    firstName?: string;
    lastName?: string;
    name: string;
  }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name;
  };

  if (!stationChecks) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-10 w-10"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If there are no station checks, show a message
  if (stationChecks.length === 0) {
    return (
      <Alert className="mb-4">
        <ExclamationCircleIcon className="h-5 w-5" />
        <AlertTitle>No station checks found</AlertTitle>
        <AlertDescription>
          No station checks have been set up yet. Please contact an
          administrator to set up station checks.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="w-full">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 mr-2" />
                  <span>Station Checks</span>
                </div>

                {/* Integrated week navigation */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setWeekOffset(weekOffset - 1)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Previous Week"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>

                  <div className="flex flex-col items-center">
                    <span className="text-base font-semibold">
                      {formatDate(currentSunday.getTime())}
                    </span>
                    {weekOffset !== 0 && (
                      <button
                        onClick={() => setWeekOffset(0)}
                        className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Return to Current Week"
                      >
                        Return to Current Week
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setWeekOffset(weekOffset + 1)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Next Week"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m8.25 4.5 7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </button>
                </div>
              </CardTitle>

              <CardDescription className="mt-2">
                {currentWeekStatus
                  ? "View or edit this week's station checks"
                  : "Start a new station check for this week's duty crew"}
              </CardDescription>
            </div>

            {/* Status badge */}
            {currentWeekStatus && (
              <Badge
                variant="outline"
                className={`${
                  currentWeekStatus.submission.status === "completed"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800"
                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                }`}
              >
                {currentWeekStatus.submission.status === "completed"
                  ? "Completed"
                  : "In Progress"}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Status information banner */}
          {currentWeekStatus && (
            <div
              className={`mb-4 p-3 rounded-md flex items-start ${
                currentWeekStatus.submission.status === "completed"
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-yellow-50 dark:bg-yellow-900/20"
              }`}
            >
              {currentWeekStatus.submission.status === "completed" ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
              ) : (
                <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
              )}
              <div>
                {currentWeekStatus.submission.status === "completed" ? (
                  <>
                    <p className="text-sm font-medium text-green-800 dark:text-white">
                      Checks completed
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      Submitted by {getUserFullName(currentWeekStatus.completedBy)} on{" "}
                      {formatDate(currentWeekStatus.submission.completedAt)} at{" "}
                      {formatTime(currentWeekStatus.submission.completedAt)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                      In Progress
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      Last updated by{" "}
                      {currentWeekStatus.lastUpdatedBy
                        ? getUserFullName(currentWeekStatus.lastUpdatedBy)
                        : getUserFullName(currentWeekStatus.completedBy)}{" "}
                      {currentWeekStatus.submission.lastUpdatedAt
                        ? `on ${formatDate(
                            currentWeekStatus.submission.lastUpdatedAt
                          )} at ${formatTime(
                            currentWeekStatus.submission.lastUpdatedAt
                          )}`
                        : `on ${formatDate(
                            currentWeekStatus.submission.completedAt
                          )} at ${formatTime(
                            currentWeekStatus.submission.completedAt
                          )}`}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Modern list-style checklist */}
          <div className="space-y-2">
            {checkItems.map((item, index) => (
              <div
                key={item.checkId}
                className={`group relative overflow-hidden rounded-lg border transition-all duration-200 ${
                  item.isCompleted
                    ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 shadow-sm"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                }`}
              >
                {/* Main check item area */}
                <div
                  className="flex items-center p-3 cursor-pointer select-none active:scale-95 transition-transform duration-100"
                  onClick={() => {
                    handleCheckboxChange(item.checkId, !item.isCompleted);
                  }}
                >
                  {/* Large, animated check indicator */}
                  <div className="flex-shrink-0 mr-4">
                    <div
                      className={`relative w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                        item.isCompleted
                          ? "bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600 scale-110"
                          : "border-gray-300 dark:border-gray-600 group-hover:border-green-400 dark:group-hover:border-green-500"
                      }`}
                    >
                      {item.isCompleted && (
                        <CheckIcon className="absolute inset-0 w-5 h-5 text-white m-auto animate-in zoom-in-50 duration-200" />
                      )}
                      {!item.isCompleted && (
                        <div className="absolute inset-2 rounded-full bg-gray-100 dark:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      )}
                    </div>
                  </div>

                  {/* Item content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3
                        className={`text-base font-medium transition-colors duration-200 ${
                          item.isCompleted
                            ? "text-green-800 dark:text-green-200"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        {item.name}
                      </h3>
                      
                      {/* Check number badge */}
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors duration-200 ${
                          item.isCompleted
                            ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {index + 1}
                      </div>
                    </div>

                    {/* Notes preview */}
                    {item.notes && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Notes section */}
                <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3 flex justify-end">
                  <button
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 active:scale-95"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNotes({
                        type: 'item',
                        checkId: item.checkId,
                        currentValue: item.notes || ''
                      });
                    }}
                  >
                    {item.notes ? (
                      <>
                        <ChatBubbleLeftIcon className="h-4 w-4" />
                        Edit Notes
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Add Notes
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* General notes section */}
          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <ChatBubbleLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                General Notes
              </h3>
            </div>
            
                 <button
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 active:scale-[0.98]"
                  onClick={() => {
                    setEditingNotes({
                      type: 'general',
                      currentValue: generalNotes || ''
                    });
                  }}
                >
              {generalNotes ? (
                <>
                  <PencilIcon className="h-4 w-4" />
                  Edit General Notes
                </>
              ) : (
                <>
                  <PlusIcon className="h-4 w-4" />
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
        </CardContent>

        {/* Footer with action buttons */}
        <CardFooter className="flex justify-end bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || checkItems.some((item) => !item.isCompleted)
            }
            className="flex items-center gap-2 px-6 py-3 text-base font-medium"
            size="lg"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-current"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Submitting...
              </span>
            ) : (
              <>
                <CheckIcon className="h-5 w-5" />
                {currentWeekStatus ? "Complete Checks" : "Submit Checks"}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      {editingNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingNotes.type === 'general' ? 'General Notes' : 'Check Notes'}
                </h3>
                <button
                  onClick={() => setEditingNotes(null)}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <XCircleIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              {editingNotes.type === 'item' && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Add notes for this specific check item
                </p>
              )}
            </div>
            
            {/* Modal Content */}
            <div className="p-4">
              <Textarea
                value={editingNotes.currentValue}
                onChange={(e) => setEditingNotes({
                  ...editingNotes, 
                  currentValue: e.target.value
                })}
                placeholder={editingNotes.type === 'general' 
                  ? "Add general notes about this week's station checks..." 
                  : "Add notes about this specific check..."
                }
                className="min-h-[120px] resize-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {editingNotes.currentValue.length} characters
              </p>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end bg-gray-50 dark:bg-gray-800/50">
              <Button 
                variant="outline" 
                onClick={() => setEditingNotes(null)}
                className="px-4"
              >
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  try {
                    if (editingNotes.type === 'general') {
                      await handleGeneralNotesChange(editingNotes.currentValue);
                    } else if (editingNotes.checkId) {
                      await handleNotesChange(editingNotes.checkId, editingNotes.currentValue);
                    }
                    setEditingNotes(null);
                  } catch (error) {
                    console.error('Error saving notes:', error);
                    // You could add error handling here
                  }
                }}
                className="px-4"
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}