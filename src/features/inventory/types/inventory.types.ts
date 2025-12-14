import type { Id } from "../../../../convex/_generated/dataModel";

export interface RunItemDoc {
  _id: Id<"applianceCheckRunItems">;
  runId: Id<"applianceCheckRuns">;
  templateId: Id<"applianceTemplates">;
  sectionId?: Id<"applianceSections">;
  itemId?: Id<"applianceItems">;
  sectionName: string;
  sectionOrder: number;
  itemName: string;
  itemOrder: number;
  itemType: "boolean_with_notes" | "boolean" | "text";
  value?: "yes" | "no";
  notes?: string;
  description?: string;
  imageStorageId?: Id<"_storage">;
  expectedQuantity?: number;
  actualQuantity?: number;
}

export interface DeviationItem {
  item: RunItemDoc;
  deviationType: "no" | "quantity_mismatch" | "notes_only";
  quantityDiff?: number;
}

export interface GroupedSection {
  order: number;
  sectionName: string;
  items: RunItemDoc[];
}

export interface ProgressInfo {
  answered: number;
  total: number;
  percentage: number;
}
