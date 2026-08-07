import { forwardRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../../components/ui/button";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import {
  ChecklistSection,
  summariseChecklist,
} from "@/components/shared/checklist";
import { InventoryCheckItem } from "./InventoryCheckItem";
import {
  inventoryItemStatus,
  isInventoryItemAnswered,
} from "../utils/inventoryStatus";
import type { GroupedSection } from "../types/inventory.types";

interface InventoryCheckSectionProps {
  section: GroupedSection;
  isReadOnly: boolean;
}

export const InventoryCheckSection = forwardRef<
  HTMLDivElement,
  InventoryCheckSectionProps
>(function InventoryCheckSection({ section, isReadOnly }, ref) {
  const updateItem = useMutation(api.inventoryCheckRuns.updateRunItem);

  const progress = summariseChecklist(section.items.map(inventoryItemStatus));
  const remaining = progress.total - progress.answered;

  const handleAllOk = async () => {
    const unanswered = section.items.filter((i) => !isInventoryItemAnswered(i));

    if (unanswered.length === 0) {
      toast.info("All items already answered");
      return;
    }

    try {
      await Promise.all(
        unanswered.map((i) =>
          i.expectedQuantity !== undefined
            ? updateItem({ runItemId: i._id, actualQuantity: i.expectedQuantity })
            : updateItem({ runItemId: i._id, value: "yes" })
        )
      );
      toast.success(`${unanswered.length} items marked OK`);
    } catch {
      toast.error("Failed to mark items");
    }
  };

  return (
    <ChecklistSection
      ref={ref}
      value={`section-${section.order}`}
      name={section.sectionName}
      progress={progress}
      headerAction={
        !isReadOnly && remaining > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void handleAllOk();
            }}
            className="w-full h-11 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-400 font-medium mb-1"
          >
            <CheckCheck className="w-4 h-4 mr-2" aria-hidden="true" />
            All OK, mark {remaining} remaining as Yes
          </Button>
        ) : undefined
      }
    >
      {section.items.map((item) => (
        <InventoryCheckItem key={item._id} item={item} isReadOnly={isReadOnly} />
      ))}
    </ChecklistSection>
  );
});
