import { forwardRef } from "react";
import {
  ChecklistSection,
  summariseChecklist,
} from "@/components/shared/checklist";
import { InventoryCheckItem } from "./InventoryCheckItem";
import { inventoryItemStatus } from "../utils/inventoryStatus";
import type { GroupedSection } from "../types/inventory.types";

interface InventoryCheckSectionProps {
  section: GroupedSection;
  isReadOnly: boolean;
  /** user id -> display name, for who answered each item */
  userNames: Record<string, string>;
}

// No bulk "All OK" action: every item must be checked and answered on its own.
export const InventoryCheckSection = forwardRef<
  HTMLDivElement,
  InventoryCheckSectionProps
>(function InventoryCheckSection({ section, isReadOnly, userNames }, ref) {
  const progress = summariseChecklist(section.items.map(inventoryItemStatus));

  return (
    <ChecklistSection
      ref={ref}
      value={`section-${section.order}`}
      name={section.sectionName}
      progress={progress}
    >
      {section.items.map((item) => (
        <InventoryCheckItem
          key={item._id}
          item={item}
          isReadOnly={isReadOnly}
          answeredByName={item.updatedBy ? userNames[item.updatedBy] : undefined}
        />
      ))}
    </ChecklistSection>
  );
});
