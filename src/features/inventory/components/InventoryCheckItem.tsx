import { forwardRef, useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "../../../components/ui/badge";
import { StepperInput } from "../../../components/common/StepperInput";
import {
  ChecklistNotesModal,
  ChecklistRow,
} from "@/components/shared/checklist";
import { InventoryItemInfoButton } from "./InventoryItemInfoButton";
import {
  hasQuantityMismatch,
  inventoryItemStatus,
  isAnsweredNo,
  isAnsweredYes,
} from "../utils/inventoryStatus";
import type { RunItemDoc } from "../types/inventory.types";

interface InventoryCheckItemProps {
  item: RunItemDoc;
  isReadOnly: boolean;
}

export const InventoryCheckItem = forwardRef<HTMLDivElement, InventoryCheckItemProps>(
  function InventoryCheckItem({ item, isReadOnly }, ref) {
    const updateItem = useMutation(api.inventoryCheckRuns.updateRunItem);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [noteDraft, setNoteDraft] = useState("");
    const [tapFlash, setTapFlash] = useState<"resolved" | "attention" | null>(null);

    const isQuantityItem = item.expectedQuantity !== undefined;
    const status = inventoryItemStatus(item);
    const mismatch = hasQuantityMismatch(item);

    // Visual flash feedback on tap
    const flashTap = useCallback((type: "resolved" | "attention") => {
      setTapFlash(type);
      setTimeout(() => setTapFlash(null), 300);
    }, []);

    const handleSetValue = async (value: "yes" | "no") => {
      if (isReadOnly) return;
      flashTap(value === "yes" ? "resolved" : "attention");
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

    const openNotes = () => {
      setNoteDraft(item.notes ?? "");
      setShowNotesModal(true);
    };

    const handleSaveNotes = async () => {
      setShowNotesModal(false);
      if (isReadOnly) return;
      await updateItem({ runItemId: item._id, notes: noteDraft });
    };

    const answerButtonClasses = (active: boolean, tone: "green" | "red") =>
      [
        "h-12 w-16 sm:w-20 rounded-lg font-semibold text-sm transition-all active:scale-95",
        active
          ? tone === "green"
            ? "bg-green-600 text-white shadow-sm dark:bg-green-700"
            : "bg-red-600 text-white shadow-sm dark:bg-red-700"
          : tone === "green"
            ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-700 dark:hover:text-green-400"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-400",
        isReadOnly ? "opacity-80 cursor-default" : "",
      ].join(" ");

    return (
      <>
        <ChecklistRow
          ref={ref}
          status={status}
          flash={tapFlash}
          name={
            isQuantityItem
              ? `${item.actualQuantity !== undefined ? item.actualQuantity : item.expectedQuantity}x ${item.itemName}`
              : item.itemName
          }
          notes={item.notes}
          badges={
            <>
              <InventoryItemInfoButton item={item} />
              {mismatch && (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold border-amber-500 text-amber-600 dark:text-amber-400"
                >
                  {item.actualQuantity! > item.expectedQuantity! ? "+" : ""}
                  {item.actualQuantity! - item.expectedQuantity!}
                </Badge>
              )}
            </>
          }
          // Notes stay reachable in read-only mode so historical notes on a
          // completed run can actually be opened.
          onOpenNotes={openNotes}
          notesLabel={
            isReadOnly ? `View notes for ${item.itemName}` : `Notes for ${item.itemName}`
          }
          control={
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void handleSetValue("yes")}
                disabled={isReadOnly}
                aria-pressed={isAnsweredYes(item)}
                className={answerButtonClasses(isAnsweredYes(item), "green")}
              >
                Yes
              </button>
              <button
                onClick={() => void handleSetValue("no")}
                disabled={isReadOnly}
                aria-pressed={isAnsweredNo(item)}
                className={answerButtonClasses(isAnsweredNo(item), "red")}
              >
                No
              </button>
            </div>
          }
          footer={
            isQuantityItem ? (
              isReadOnly ? (
                mismatch ? (
                  <div className="text-xs text-muted-foreground">
                    Expected: {item.expectedQuantity} | Actual: {item.actualQuantity}
                  </div>
                ) : null
              ) : (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Expected:{" "}
                    <span className="font-semibold">{item.expectedQuantity}</span>
                  </span>
                  <StepperInput
                    value={item.actualQuantity}
                    onChange={(qty) => void handleQuantityChange(qty)}
                    min={0}
                    size="sm"
                    disabled={isReadOnly}
                  />
                </div>
              )
            ) : null
          }
        />

        <ChecklistNotesModal
          open={showNotesModal}
          onClose={() => setShowNotesModal(false)}
          title={`Notes: ${item.itemName}`}
          value={noteDraft}
          onChange={setNoteDraft}
          onSave={() => void handleSaveNotes()}
          readOnly={isReadOnly}
        />
      </>
    );
  },
);
