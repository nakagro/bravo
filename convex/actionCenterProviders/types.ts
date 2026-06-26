import { QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

export type ActionItem = {
  id: string;
  moduleId: string;
  kind: string;
  title: string;
  description?: string;
  url: string;
  actionLabel?: string;
  priority: "low" | "medium" | "high";
  count?: number;
  createdAt: number;
  meta?: unknown;
};

export type ProviderCtx = {
  user: Doc<"users">;
  userId: Id<"users">;
  hasModuleAccess: (moduleId: string) => boolean;
};

export type ActionProvider = (ctx: QueryCtx, p: ProviderCtx) => Promise<ActionItem[]>;
