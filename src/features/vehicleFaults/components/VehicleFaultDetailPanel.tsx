import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { VehicleFaultComments } from "./VehicleFaultComments";
import { VehicleFaultHistory } from "./VehicleFaultHistory";
import { VehicleFaultAttachments } from "./VehicleFaultAttachments";
import { statusConfig, priorityConfig } from "../types";

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
import { Badge } from "@/components/ui/badge";
import {
  Pencil,
  Trash2,
  Truck,
  FileText,
  User,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
  Paperclip,
} from "lucide-react";

interface VehicleFaultDetailPanelProps {
  faultId: Id<"vehicleFaults">;
  onClose: () => void;
  onEdit: () => void;
}

export function VehicleFaultDetailPanel({
  faultId,
  onClose,
  onEdit,
}: VehicleFaultDetailPanelProps) {
  const isMobile = useIsMobile();
  const fault = useQuery(api.vehicleFaults.getVehicleFault, { faultId });
  const currentUser = useQuery(api.auth.loggedInUser);
  const deleteFault = useMutation(api.vehicleFaults.deleteVehicleFault);

  const [showHistory, setShowHistory] = useState(false);
  const [showComments, setShowComments] = useState(false);

  if (!fault) return null;

  const isAdmin = currentUser?.isAdmin;
  const status = statusConfig[fault.status];
  const priority = priorityConfig[fault.priority];
  const StatusIcon = status.icon;

  const handleDelete = async () => {
    try {
      await deleteFault({ faultId: fault._id });
      toast.success("Fault deleted");
      onClose();
    } catch {
      toast.error("Failed to delete fault");
    }
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded">
              <Truck className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {fault.vehicle}
              </h2>
              <p className="text-sm text-muted-foreground">{fault.shortDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${status.color} border text-xs px-2 py-0.5 hover:bg-transparent pointer-events-none`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
            <div className={`w-2 h-2 rounded-full ${priority.dotColor}`} title={`${priority.label} priority`} />
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-5 pb-24">
        {/* Status banner */}
        <div className={`p-3 border-l-4 rounded-r-md ${status.bgColor} ${status.borderColor}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className={`${status.color} border text-xs px-2 py-0.5 hover:bg-transparent pointer-events-none`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
              <Badge className={`${priority.color} border text-xs px-2 py-0.5 hover:bg-transparent pointer-events-none`}>
                {priority.label} Priority
              </Badge>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Reported{" "}
              {new Date(fault.dateReported).toLocaleDateString("en-AU", {
                month: "short",
                day: "numeric",
                year: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* Report details */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Report Details
            </p>
          </div>
          <div className="pl-5 space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              <span className="font-medium">Reported by:</span>
              <span className="text-muted-foreground">
                {fault.reportedByUser?.firstName} {fault.reportedByUser?.lastName}
              </span>
            </div>
            {fault.dateLogged && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="font-medium">Logged:</span>
                <span className="text-muted-foreground">
                  {new Date(fault.dateLogged).toLocaleDateString("en-AU", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })}
                </span>
              </div>
            )}
            {fault.updatedAt !== fault.createdAt && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                <span className="font-medium">Updated:</span>
                <span className="text-muted-foreground">
                  {new Date(fault.updatedAt).toLocaleDateString("en-AU", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })}
                </span>
              </div>
            )}
            {fault.eamRequestNumber && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">EAM:</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {fault.eamRequestNumber}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Detailed description */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-gray-400" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Description
            </p>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-5 leading-relaxed">
            {fault.longDescription}
          </p>
        </div>

        {/* Notes */}
        {fault.notes && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Notes
              </p>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap pl-5">
              {fault.notes}
            </p>
          </div>
        )}

        {/* Attachments */}
        <VehicleFaultAttachments faultId={faultId} mode="view" />

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
              <VehicleFaultComments faultId={faultId} />
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
            <div className="pl-5">
              <VehicleFaultHistory faultId={faultId} />
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 pt-3 pb-8 md:pb-3 bg-background -mx-6 px-6 -mb-6 mt-auto">
        <div className="flex gap-2">
          <Button
            onClick={onEdit}
            className="flex-1 h-11 bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit Fault
          </Button>
          {isAdmin && (
            <DeleteConfirmDialog
              title="Delete fault?"
              description="This action cannot be undone. This will permanently delete this vehicle fault and all its attachments."
              trigger={
                <Button variant="destructive" size="icon" className="h-11 w-11">
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
              onConfirm={handleDelete}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="h-[92vh] flex flex-col border-gray-700">
          <DrawerHeader className="flex-shrink-0 px-0 pt-0">
            <DrawerTitle className="sr-only">Vehicle Fault Details</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-6 flex flex-col">
        <SheetHeader className="sr-only">
          <SheetTitle>Vehicle Fault Details</SheetTitle>
          <SheetDescription>Details for {fault.vehicle} fault</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}
