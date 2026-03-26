import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { HoseComments } from "./HoseComments";
import { useIsMobile } from "@/hooks/use-mobile";
import { statusColors } from "../types";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MapPin,
  Ruler,
  Copy,
  Pencil,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  CircleDot,
  Layers,
  TriangleAlert,
} from "lucide-react";

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} copied`);
  });
}

export function HoseDetailPanel({
  hoseId,
  onClose,
  onEdit,
}: {
  hoseId: Id<"hoses">;
  onClose: () => void;
  onEdit: () => void;
}) {
  const isMobile = useIsMobile();
  const hose = useQuery(api.hoses.get, { id: hoseId });
  const history = useQuery(api.hoses.getHistory, { hoseId });

  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);

  if (!hose) {
    return null;
  }

  // Calculate test expiry
  const testExpiryDate = hose.testDate
    ? new Date(hose.testDate + 365 * 24 * 60 * 60 * 1000)
    : null;
  const isOverdue =
    hose.status === "Due for testing" ||
    (testExpiryDate && testExpiryDate.getTime() < Date.now());

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-red-700 dark:text-red-400">
              {hose.hoseId}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(hose.hoseId, "Hose ID")}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Copy Hose ID"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <span
          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mt-2 ${statusColors[hose.status]}`}
        >
          {hose.status}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-5 pb-24">
        {/* Replaced warning */}
        {hose.replacedAt && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>
              This hose was marked as replaced on{" "}
              {new Date(hose.replacedAt).toLocaleDateString()}.
            </AlertDescription>
          </Alert>
        )}

        {/* Key specs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Size
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {hose.size}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">
                mm
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Length
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {hose.length}
              <span className="text-sm font-normal text-muted-foreground ml-0.5">
                m
              </span>
            </p>
          </div>
        </div>

        {/* Details rows */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500 dark:text-gray-400 w-20">Type</span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {hose.type}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500 dark:text-gray-400 w-20">
              Location
            </span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {hose.location || "Unknown"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-500 dark:text-gray-400 w-20">
              Tested
            </span>
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {hose.testDate
                ? new Date(hose.testDate).toLocaleDateString()
                : "Not recorded"}
            </span>
          </div>

          {testExpiryDate && (
            <div className="flex items-center gap-2 text-sm">
              <Clock
                className={`h-4 w-4 flex-shrink-0 ${isOverdue ? "text-red-500" : "text-gray-400"}`}
              />
              <span className="text-gray-500 dark:text-gray-400 w-20">
                Expiry
              </span>
              <span
                className={`font-medium ${isOverdue ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}
              >
                {testExpiryDate.toLocaleDateString()}
                {isOverdue && " (overdue)"}
              </span>
            </div>
          )}
        </div>

        {/* Comments - collapsible */}
        <div className="space-y-2">
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 w-full group"
          >
            <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide group-hover:text-gray-700 dark:group-hover:text-gray-300">
              Comments
            </p>
            {showComments ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            )}
          </button>

          {showComments && (
            <div className="pl-5">
              <HoseComments hoseId={hoseId} />
            </div>
          )}
        </div>

        {/* History - collapsible */}
        <div className="space-y-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 w-full group"
          >
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide group-hover:text-gray-700 dark:group-hover:text-gray-300">
              Change History
            </p>
            {showHistory ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 ml-auto" />
            )}
          </button>

          {showHistory && (
            <div className="pl-5 space-y-2">
              {history === undefined ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-700 dark:border-red-500"></div>
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                  No changes recorded
                </p>
              ) : (
                history.slice(0, 10).map((entry) => (
                  <HistoryEntry key={entry._id} entry={entry} />
                ))
              )}
              {history && history.length > 10 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Showing 10 of {history.length} changes
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 pt-3 pb-8 md:pb-3 bg-background -mx-6 px-6 -mb-6 mt-auto">
        <Button
          onClick={onEdit}
          className="w-full h-11 bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Edit Hose
        </Button>
      </div>
    </div>
  );

  // Mobile: full-screen drawer from bottom
  if (isMobile) {
    return (
      <Drawer
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DrawerContent className="h-[92vh] flex flex-col border-gray-700">
          <DrawerHeader className="flex-shrink-0 px-0 pt-0">
            <DrawerTitle className="sr-only">Hose Details</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: side sheet
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg p-6 flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Hose Details</SheetTitle>
          <SheetDescription>Details for hose {hose.hoseId}</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}

// History entry component
function HistoryEntry({ entry }: { entry: any }) {
  const fieldNameMap: Record<string, string> = {
    hoseId: "Hose ID",
    length: "Length",
    size: "Size",
    type: "Type",
    location: "Location",
    testDate: "Test Date",
    status: "Status",
  };

  const timeAgo = formatDistanceToNow(new Date(entry.timestamp), {
    addSuffix: true,
  });

  if (entry.changeType === "hose_replacement") {
    return (
      <div className="text-xs py-1.5 px-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30">
        <span className="text-blue-700 dark:text-blue-400 font-medium">
          Replaced
        </span>
        <span className="text-gray-500 dark:text-gray-400 ml-2">
          {timeAgo} by {entry.user.name}
        </span>
        {entry.notes && entry.notes !== "Hose was replaced" && (
          <p className="text-gray-500 dark:text-gray-400 mt-0.5">
            {entry.notes}
          </p>
        )}
      </div>
    );
  }

  if (entry.changeType === "hose_deletion") {
    return (
      <div className="text-xs py-1.5 px-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30">
        <span className="text-red-700 dark:text-red-400 font-medium">
          Deleted
        </span>
        <span className="text-gray-500 dark:text-gray-400 ml-2">
          {timeAgo} by {entry.user.name}
        </span>
      </div>
    );
  }

  if (entry.changeType === "status_override") {
    return (
      <div className="text-xs py-1.5 px-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30">
        <span className="text-amber-700 dark:text-amber-400 font-medium">
          Status Override
        </span>
        <span className="text-gray-500 dark:text-gray-400 ml-2">
          {timeAgo} by {entry.user.name}
        </span>
        <div className="mt-0.5 flex items-center gap-1">
          <span className="text-red-600 dark:text-red-400 line-through">
            {entry.oldValue}
          </span>
          <span className="text-gray-400">&rarr;</span>
          <span className="text-green-600 dark:text-green-400">
            {entry.newValue}
          </span>
        </div>
      </div>
    );
  }

  const fieldName = fieldNameMap[entry.field] || entry.field;

  // Format testDate values as dates
  let oldDisplay = entry.oldValue;
  let newDisplay = entry.newValue;
  if (entry.field === "testDate") {
    oldDisplay = entry.oldValue
      ? new Date(entry.oldValue).toLocaleDateString()
      : "(empty)";
    newDisplay = entry.newValue
      ? new Date(entry.newValue).toLocaleDateString()
      : "(empty)";
  }

  return (
    <div className="text-xs py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
      <div className="flex items-baseline gap-1 flex-wrap">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {fieldName}
        </span>
        <span className="text-gray-400">changed</span>
        <span className="text-gray-500 dark:text-gray-400">{timeAgo}</span>
        <span className="text-gray-400">by {entry.user.name}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-red-600 dark:text-red-400 line-through">
          {oldDisplay || "(empty)"}
        </span>
        <span className="text-gray-400">&rarr;</span>
        <span className="text-green-600 dark:text-green-400">
          {newDisplay || "(empty)"}
        </span>
      </div>
    </div>
  );
}
