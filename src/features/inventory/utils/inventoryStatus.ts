import type { ChecklistItemStatus } from "@/components/shared/checklist";
import type { RunItemDoc } from "../types/inventory.types";

/**
 * Inventory's adapter onto the shared checklist vocabulary.
 *
 * A quantity item is answered once an actual quantity has been recorded, and
 * needs attention when that quantity differs from what's expected. A plain
 * item is answered by a yes/no, and "no" needs attention.
 *
 * Note the asymmetry with the control: the **No button** stays red because it
 * is a destructive-ish action, but the resulting row state is amber - what
 * Inventory's own executive summary already calls a "deviation". Red is
 * reserved for Duty Crew's unresolved Priority edge.
 */
export function inventoryItemStatus(item: RunItemDoc): ChecklistItemStatus {
  if (item.expectedQuantity !== undefined) {
    if (item.actualQuantity === undefined) return "unanswered";
    return item.actualQuantity === item.expectedQuantity ? "resolved" : "attention";
  }
  if (typeof item.value === "undefined") return "unanswered";
  return item.value === "yes" ? "resolved" : "attention";
}

export const isInventoryItemAnswered = (item: RunItemDoc) =>
  inventoryItemStatus(item) !== "unanswered";

/** The Yes control's pressed state - distinct from "resolved". */
export const isAnsweredYes = (item: RunItemDoc) =>
  item.expectedQuantity !== undefined
    ? item.actualQuantity !== undefined && item.actualQuantity > 0
    : item.value === "yes";

/** The No control's pressed state. */
export const isAnsweredNo = (item: RunItemDoc) =>
  item.expectedQuantity !== undefined
    ? item.actualQuantity === 0
    : item.value === "no";

export const hasQuantityMismatch = (item: RunItemDoc) =>
  item.expectedQuantity !== undefined &&
  item.actualQuantity !== undefined &&
  item.actualQuantity !== item.expectedQuantity;
