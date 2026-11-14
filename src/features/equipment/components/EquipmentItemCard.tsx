import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { ResponsiveModal } from "@/components/shared/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EquipmentItemCardProps {
  item: {
    _id: Id<"equipmentItems">;
    name: string;
    description?: string;
    size?: string;
    currentStock: number;
    minimumStock?: number;
    unit?: string;
    isLowStock: boolean;
  };
  canManage?: boolean;
}

export function EquipmentItemCard({ item, canManage = false }: EquipmentItemCardProps) {
  const [showTakeDialog, setShowTakeDialog] = useState(false);
  const [showReplenishDialog, setShowReplenishDialog] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const takeItem = useMutation(api.equipment.takeItem);
  const replenishItem = useMutation(api.equipment.replenishItem);

  const handleTake = async () => {
    if (quantity <= 0 || quantity > item.currentStock) return;
    setIsSubmitting(true);
    try {
      await takeItem({
        itemId: item._id,
        quantity,
        notes: notes || undefined,
      });
      setShowTakeDialog(false);
      setQuantity(1);
      setNotes("");
    } catch (error) {
      console.error("Failed to take item:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplenish = async () => {
    if (quantity <= 0) return;
    setIsSubmitting(true);
    try {
      await replenishItem({
        itemId: item._id,
        quantity,
        notes: notes || undefined,
      });
      setShowReplenishDialog(false);
      setQuantity(1);
      setNotes("");
    } catch (error) {
      console.error("Failed to replenish item:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const unitLabel = item.unit || "units";

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:border-border/80 transition-colors">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground truncate">
              {item.name}
              {item.size && (
                <span className="ml-1 text-muted-foreground">({item.size})</span>
              )}
            </h3>
            {item.isLowStock && (
              <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                <TriangleAlert className="h-3 w-3" />
                Low
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{item.currentStock}</span>{" "}
            {unitLabel} in stock
            {item.minimumStock !== undefined && (
              <span className="text-xs ml-1">(min: {item.minimumStock})</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => {
              setQuantity(1);
              setNotes("");
              setShowTakeDialog(true);
            }}
            disabled={item.currentStock === 0}
          >
            <Minus className="h-4 w-4" />
          </Button>

          {canManage && (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => {
                setQuantity(1);
                setNotes("");
                setShowReplenishDialog(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Take Item Dialog */}
      <ResponsiveModal
        open={showTakeDialog}
        onClose={() => setShowTakeDialog(false)}
        drawerHeight="max-h-[85vh]"
        title={`Take ${item.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowTakeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTake}
              disabled={isSubmitting || quantity <= 0 || quantity > item.currentStock}
            >
              {isSubmitting ? "Taking..." : `Take ${quantity}`}
            </Button>
          </>
        }
      >
          <div className="space-y-4 pb-4">
            <p className="text-sm text-muted-foreground">
              How many {unitLabel} are you taking?
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(item.currentStock, parseInt(e.target.value) || 1)))}
                className="w-20 text-center text-lg font-semibold"
                min={1}
                max={item.currentStock}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.min(item.currentStock, quantity + 1))}
                disabled={quantity >= item.currentStock}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {item.currentStock} available
            </p>

            <Textarea
              placeholder="Optional: Add a note (e.g., reason for taking)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
      </ResponsiveModal>

      {/* Replenish Item Dialog */}
      <ResponsiveModal
        open={showReplenishDialog}
        onClose={() => setShowReplenishDialog(false)}
        drawerHeight="max-h-[85vh]"
        title={`Replenish ${item.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowReplenishDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReplenish}
              disabled={isSubmitting || quantity <= 0}
            >
              {isSubmitting ? "Adding..." : `Add ${quantity}`}
            </Button>
          </>
        }
      >
          <div className="space-y-4 pb-4">
            <p className="text-sm text-muted-foreground">
              How many {unitLabel} are you adding to stock?
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center text-lg font-semibold"
                min={1}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Current stock: {item.currentStock}
            </p>

            <Textarea
              placeholder="Optional: Add a note (e.g., supplier, date received)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
      </ResponsiveModal>
    </>
  );
}
