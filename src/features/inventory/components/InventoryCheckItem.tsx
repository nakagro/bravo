import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { MessageSquarePlus } from "lucide-react";
import { StepperInput } from "../../../components/common/StepperInput";
import { InventoryItemInfoButton } from "./InventoryItemInfoButton";
import type { RunItemDoc } from "../types/inventory.types";

interface InventoryCheckItemProps {
  item: RunItemDoc;
  isReadOnly: boolean;
}

export function InventoryCheckItem({ item, isReadOnly }: InventoryCheckItemProps) {
  const updateItem = useMutation(api.inventoryCheckRuns.updateRunItem);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [tapFlash, setTapFlash] = useState<"yes" | "no" | null>(null);

  const hasNotes = item.notes && item.notes.trim().length > 0;
  const isQuantityItem = item.expectedQuantity !== undefined;

  // Visual flash feedback on tap
  const flashTap = useCallback((type: "yes" | "no") => {
    setTapFlash(type);
    setTimeout(() => setTapFlash(null), 300);
  }, []);

  const handleSetValue = async (value: "yes" | "no") => {
    if (isReadOnly) return;
    flashTap(value);
    if (isQuantityItem) {
      const actualQuantity = value === "yes" ? item.expectedQuantity! : 0;
      await updateItem({ runItemId: item._id, actualQuantity });
      return;
    }
    await updateItem({ runItemId: item._id, value });
  };

  const handleQuantityChange = async (qty: number) => {
    if (isReadOnly) return;
    await updateItem({ runItemId: item._id, actualQuantity: qty, value: null });
  };

  const handleSaveNotes = async (notes: string) => {
    if (isReadOnly) return;
    await updateItem({ runItemId: item._id, notes });
  };

  // Determine current answered state for styling
  const isAnsweredYes = isQuantityItem
    ? (item.actualQuantity !== undefined && item.actualQuantity > 0)
    : item.value === "yes";
  const isAnsweredNo = isQuantityItem
    ? item.actualQuantity === 0
    : item.value === "no";
  const hasQuantityMismatch = isQuantityItem &&
    item.actualQuantity !== undefined &&
    item.actualQuantity !== item.expectedQuantity;

  // Flash overlay classes
  const flashClass = tapFlash === "yes"
    ? "ring-2 ring-green-400 bg-green-50/50 dark:bg-green-950/20"
    : tapFlash === "no"
      ? "ring-2 ring-red-400 bg-red-50/50 dark:bg-red-950/20"
      : "";

  return (
    <Card className={`transition-all duration-200 ${flashClass}`}>
      <CardContent className="p-3 sm:p-4">
        {/* Row: Item name + info + actions */}
        <div className="flex items-center gap-3">
          {/* Left: Item name and badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm sm:text-base leading-tight">
                {isQuantityItem
                  ? `${item.actualQuantity !== undefined ? item.actualQuantity : item.expectedQuantity}x ${item.itemName}`
                  : item.itemName}
              </span>
              <InventoryItemInfoButton item={item} />
              {/* Quantity mismatch badge */}
              {hasQuantityMismatch && (
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${item.actualQuantity! > item.expectedQuantity!
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : "border-red-500 text-red-600 dark:text-red-500"
                    }`}
                >
                  {item.actualQuantity! > item.expectedQuantity! ? "+" : ""}{item.actualQuantity! - item.expectedQuantity!}
                </Badge>
              )}
              {hasNotes && (
                <MessageSquarePlus className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              )}
            </div>
          </div>

          {/* Right: Yes/No buttons — large touch targets */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Note button (small, secondary) */}
            {!isReadOnly && (
              <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
                <DialogTrigger asChild>
                  <button
                    className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${hasNotes
                      ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                      : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    title="Add note"
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Notes: {item.itemName}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      id={`notes-${item._id}`}
                      defaultValue={item.notes ?? ""}
                      placeholder="Add notes (optional)..."
                      className="min-h-[120px] text-base"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowNotesModal(false)}>
                        Cancel
                      </Button>
                      <Button onClick={() => {
                        const textarea = document.getElementById(`notes-${item._id}`) as HTMLTextAreaElement;
                        if (textarea) handleSaveNotes(textarea.value);
                        setShowNotesModal(false);
                      }}>
                        Save Notes
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Yes button */}
            <button
              onClick={() => handleSetValue("yes")}
              disabled={isReadOnly}
              className={`h-12 w-16 sm:w-20 rounded-lg font-semibold text-sm transition-all active:scale-95 ${isAnsweredYes
                ? "bg-green-600 text-white shadow-sm dark:bg-green-700"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-700 dark:hover:text-green-400"
                } ${isReadOnly ? "opacity-80 cursor-default" : ""}`}
            >
              Yes
            </button>

            {/* No button */}
            <button
              onClick={() => handleSetValue("no")}
              disabled={isReadOnly}
              className={`h-12 w-16 sm:w-20 rounded-lg font-semibold text-sm transition-all active:scale-95 ${isAnsweredNo
                ? "bg-red-600 text-white shadow-sm dark:bg-red-700"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-400"
                } ${isReadOnly ? "opacity-80 cursor-default" : ""}`}
            >
              No
            </button>
          </div>
        </div>

        {/* Quantity stepper — shown inline below when item is a quantity type */}
        {isQuantityItem && !isReadOnly && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Expected: <span className="font-semibold">{item.expectedQuantity}</span>
            </span>
            <StepperInput
              value={item.actualQuantity}
              onChange={handleQuantityChange}
              min={0}
              size="sm"
              disabled={isReadOnly}
            />
          </div>
        )}

        {/* Quantity display for read-only */}
        {isQuantityItem && isReadOnly && hasQuantityMismatch && (
          <div className="mt-2 text-xs text-muted-foreground">
            Expected: {item.expectedQuantity} | Actual: {item.actualQuantity}
          </div>
        )}

        {/* Notes display */}
        {hasNotes && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
            <MessageSquarePlus className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-wrap">{item.notes}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InventoryCheckItem;
