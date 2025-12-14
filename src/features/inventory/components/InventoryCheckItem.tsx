import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { XCircle, MessageSquarePlus } from "lucide-react";
import { InventoryItemInfoButton } from "./InventoryItemInfoButton";
import type { RunItemDoc } from "../types/inventory.types";

interface InventoryCheckItemProps {
  item: RunItemDoc;
  isReadOnly: boolean;
}

export function InventoryCheckItem({ item, isReadOnly }: InventoryCheckItemProps) {
  const updateItem = useMutation(api.inventoryCheckRuns.updateRunItem);
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  const hasNotes = item.notes && item.notes.trim().length > 0;

  const handleSetValue = async (value: "yes" | "no") => {
    if (isReadOnly) return;
    if (item.expectedQuantity !== undefined) {
      const actualQuantity = value === "yes" ? item.expectedQuantity : 0;
      await updateItem({ runItemId: item._id, actualQuantity });
      return;
    }
    await updateItem({ runItemId: item._id, value });
  };

  const handleSaveNotes = async (notes: string) => {
    if (isReadOnly) return;
    await updateItem({ runItemId: item._id, notes });
  };

  const handleSaveQuantity = async (inputValue: string) => {
    if (inputValue === "") {
      await updateItem({ runItemId: item._id, actualQuantity: null, value: null });
    } else {
      const value = parseInt(inputValue, 10);
      if (!isNaN(value) && value >= 0 && Number.isInteger(value)) {
        await updateItem({ runItemId: item._id, actualQuantity: value, value: null });
      }
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Item Name */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-medium text-sm sm:text-base">
            {item.expectedQuantity
              ? `${item.actualQuantity !== undefined ? item.actualQuantity : item.expectedQuantity}x ${item.itemName}`
              : item.itemName}
          </div>
          <InventoryItemInfoButton item={item} />
          {/* Show badge if quantity mismatch */}
          {item.expectedQuantity && item.actualQuantity !== undefined && item.actualQuantity !== item.expectedQuantity && (
            <Badge
              variant="outline"
              className={`text-xs font-semibold ${item.actualQuantity > item.expectedQuantity
                ? "border-green-500 text-green-600 dark:text-green-500"
                : "border-red-500 text-red-600 dark:text-red-500"
                }`}
            >
              {item.actualQuantity > item.expectedQuantity ? "+" : ""}{item.actualQuantity - item.expectedQuantity}
            </Badge>
          )}
        </div>

        {/* Yes/No Response Buttons */}
        {item.expectedQuantity ? (
          <>
            {/* Quantity Check - Yes/No Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={
                  item.actualQuantity !== undefined && item.actualQuantity > 0
                    ? "default"
                    : "outline"
                }
                size="lg"
                onClick={() => handleSetValue("yes")}
                disabled={isReadOnly}
                className={`flex-1 min-h-[44px] ${item.actualQuantity !== undefined && item.actualQuantity > 0
                  ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                  : "hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-700 dark:hover:text-green-400"
                  }`}
              >
                <span className="font-medium">Yes</span>
              </Button>
              <Button
                variant={item.actualQuantity === 0 ? "destructive" : "outline"}
                size="lg"
                onClick={() => handleSetValue("no")}
                disabled={isReadOnly}
                className={`flex-1 min-h-[44px] ${item.actualQuantity === 0
                  ? ""
                  : "hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 dark:hover:text-red-400"
                  }`}
              >
                <span className="font-medium">No</span>
              </Button>
            </div>

            {/* Action Buttons Row - Aligned Right */}
            {!isReadOnly && (
              <div className="flex gap-2 justify-end">
                <Dialog open={showQuantityInput} onOpenChange={setShowQuantityInput}>
                  <DialogTrigger asChild>
                    <Button
                      variant={
                        item.actualQuantity !== undefined &&
                          item.actualQuantity !== item.expectedQuantity &&
                          item.actualQuantity !== 0
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className={`gap-1.5 ${item.actualQuantity !== undefined &&
                        item.actualQuantity !== item.expectedQuantity &&
                        item.actualQuantity !== 0
                        ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800"
                        : "hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:text-amber-700 dark:hover:text-amber-400"
                        }`}
                      title="Adjust quantity"
                    >
                      <span className="text-lg leading-none">±</span>
                      <span className="text-sm">Adjust</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Adjust Quantity: {item.itemName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Expected:</span>
                        <span className="font-semibold text-base">{item.expectedQuantity}</span>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Actual Count:</label>
                        <Input
                          id={`quantity-${item._id}`}
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          step="1"
                          defaultValue={item.actualQuantity ?? ""}
                          onKeyDown={(e) => {
                            if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                              e.preventDefault();
                            }
                          }}
                          placeholder="Enter count..."
                          className="text-lg"
                        />
                      </div>
                      {item.actualQuantity !== undefined && item.actualQuantity !== item.expectedQuantity && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                          <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-500">
                            Current Difference: {item.actualQuantity > item.expectedQuantity ? "+" : ""}{item.actualQuantity - item.expectedQuantity}
                          </span>
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setShowQuantityInput(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            const input = document.getElementById(`quantity-${item._id}`) as HTMLInputElement;
                            if (input) {
                              handleSaveQuantity(input.value);
                            }
                            setShowQuantityInput(false);
                          }}
                        >
                          Save Quantity
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-400"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      <span className="text-sm">Note</span>
                    </Button>
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
                        className="min-h-[120px]"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setShowNotesModal(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            const textarea = document.getElementById(`notes-${item._id}`) as HTMLTextAreaElement;
                            if (textarea) {
                              handleSaveNotes(textarea.value);
                            }
                            setShowNotesModal(false);
                          }}
                        >
                          Save Notes
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Boolean Check - Yes/No Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant={item.value === "yes" ? "default" : "outline"}
                size="lg"
                onClick={() => handleSetValue("yes")}
                disabled={isReadOnly}
                className={`flex-1 min-h-[44px] ${item.value === "yes"
                  ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                  : "hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 hover:text-green-700 dark:hover:text-green-400"
                  }`}
              >
                <span className="font-medium">Yes</span>
              </Button>
              <Button
                variant={item.value === "no" ? "destructive" : "outline"}
                size="lg"
                onClick={() => handleSetValue("no")}
                disabled={isReadOnly}
                className={`flex-1 min-h-[44px] ${item.value === "no"
                  ? ""
                  : "hover:border-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 dark:hover:text-red-400"
                  }`}
              >
                <span className="font-medium">No</span>
              </Button>
            </div>

            {/* Action Buttons Row - Aligned Right */}
            {!isReadOnly && (
              <div className="flex gap-2 justify-end">
                <Dialog open={showNotesModal} onOpenChange={setShowNotesModal}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-400"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      <span className="text-sm">Note</span>
                    </Button>
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
                        className="min-h-[120px]"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setShowNotesModal(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            const textarea = document.getElementById(`notes-${item._id}`) as HTMLTextAreaElement;
                            if (textarea) {
                              handleSaveNotes(textarea.value);
                            }
                            setShowNotesModal(false);
                          }}
                        >
                          Save Notes
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </>
        )}

        {/* Show note content below buttons if exists */}
        {hasNotes && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded">
            <MessageSquarePlus className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-wrap">{item.notes}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InventoryCheckItem;
