import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Check,
  Plus,
  MessageSquare,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { StationCheckItem } from "./StationCheckItem";
import type { CheckItemData } from "../types";

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
    notes: string
  ) => void;
  onGeneralNotesChange: (notes: string) => void;
  onSubmit: () => void;
  onAddAdHocItem: (name: string) => void;
  onRemoveAdHocItem: (name: string) => void;
  isSubmitting: boolean;
  submissionStatus: "draft" | "completed" | "not_started";
  isLeader: boolean;
  isAdmin: boolean;
}

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
}: StationChecksListProps) {
  const isMobile = useIsMobile();
  const [editingNotes, setEditingNotes] = useState<{
    type: "item" | "general";
    checkId?: Id<"stationChecks">;
    adHocName?: string;
    currentValue: string;
  } | null>(null);
  const [showAddAdHoc, setShowAddAdHoc] = useState(false);
  const [newAdHocName, setNewAdHocName] = useState("");

  const templateItems = checkItems.filter((item) => !item.isAdHoc);
  const adHocItems = checkItems.filter((item) => item.isAdHoc);
  const remainingCount = checkItems.filter((item) => !item.isCompleted).length;
  const canSubmit = remainingCount === 0 && checkItems.length > 0;

  const handleSaveNotes = () => {
    if (!editingNotes) return;
    if (editingNotes.type === "general") {
      onGeneralNotesChange(editingNotes.currentValue);
    } else {
      onNotesChange(
        editingNotes.checkId,
        editingNotes.adHocName,
        editingNotes.currentValue
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

  // Empty state
  if (checkItems.length === 0 && !isLeader && !isAdmin) {
    return (
      <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No station checks configured yet — ask an admin to add some.
        </p>
      </div>
    );
  }

  // Notes editing content (shared between Sheet and Drawer)
  const notesContent = editingNotes && (
    <div className="space-y-4 p-4">
      <Textarea
        value={editingNotes.currentValue}
        onChange={(e) =>
          setEditingNotes({ ...editingNotes, currentValue: e.target.value })
        }
        placeholder={
          editingNotes.type === "general"
            ? "Add general notes about this week's station checks..."
            : "Add notes about this specific check..."
        }
        className="min-h-[120px] resize-none"
        autoFocus
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {editingNotes.currentValue.length} characters
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => setEditingNotes(null)}>
          Cancel
        </Button>
        <Button onClick={handleSaveNotes}>
          <Check className="h-4 w-4 mr-1" />
          Save Notes
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Template check items */}
      {templateItems.map((item, index) => (
        <StationCheckItem
          key={item.checkId || `template-${index}`}
          item={item}
          index={index}
          onToggle={() =>
            onCheckToggle(item.checkId, undefined, !item.isCompleted)
          }
          onOpenNotes={() =>
            setEditingNotes({
              type: "item",
              checkId: item.checkId,
              currentValue: item.notes || "",
            })
          }
        />
      ))}

      {/* Ad-hoc items section */}
      {(adHocItems.length > 0 || isLeader || isAdmin) && (
        <div className="mt-4">
          {adHocItems.length > 0 && (
            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Additional Items
              </span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>
          )}

          {adHocItems.map((item, index) => (
            <div key={`adhoc-${item.name}-${index}`} className="mb-3">
              <StationCheckItem
                item={item}
                index={templateItems.length + index}
                onToggle={() =>
                  onCheckToggle(undefined, item.name, !item.isCompleted)
                }
                onOpenNotes={() =>
                  setEditingNotes({
                    type: "item",
                    adHocName: item.name,
                    currentValue: item.notes || "",
                  })
                }
                onDelete={() => onRemoveAdHocItem(item.name)}
              />
            </div>
          ))}

          {/* Add ad-hoc button */}
          {(isLeader || isAdmin) && (
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
                    <Button
                      size="sm"
                      onClick={handleAddAdHoc}
                      disabled={!newAdHocName.trim()}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddAdHoc(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-600 dark:hover:text-purple-400 transition-colors active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4 inline mr-1" />
                  Add ad-hoc item
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* General notes */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
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
            })
          }
        >
          {generalNotes ? (
            <>
              <MessageSquare className="h-4 w-4" />
              Edit General Notes
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
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

      {/* Submit button */}
      <div className="pt-4 pb-2">
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || !canSubmit}
          size="lg"
          className={cn(
            "w-full text-base font-medium",
            canSubmit && !isSubmitting && "animate-pulse"
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              {canSubmit
                ? "Complete Checks"
                : `${remainingCount} item${remainingCount !== 1 ? "s" : ""} remaining`}
            </span>
          )}
        </Button>
      </div>

      {/* Notes Sheet/Drawer */}
      {isMobile ? (
        <Drawer
          open={!!editingNotes}
          onOpenChange={(open) => !open && setEditingNotes(null)}
        >
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                {editingNotes?.type === "general"
                  ? "General Notes"
                  : "Check Notes"}
              </DrawerTitle>
            </DrawerHeader>
            {notesContent}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet
          open={!!editingNotes}
          onOpenChange={(open) => !open && setEditingNotes(null)}
        >
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                {editingNotes?.type === "general"
                  ? "General Notes"
                  : "Check Notes"}
              </SheetTitle>
            </SheetHeader>
            {notesContent}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
