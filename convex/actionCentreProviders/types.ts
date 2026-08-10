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
  /**
   * Opt in to a per-user "wave it away" control. Only for actions a user can
   * reasonably choose to stop seeing - a derived action whose condition still
   * holds (unset availability) must stay put, or the Action Centre stops being
   * a reliable account of what's outstanding.
   */
  dismissible?: boolean;
};

export type ProviderCtx = {
  user: Doc<"users">;
  userId: Id<"users">;
  hasModuleAccess: (moduleId: string) => boolean;
};

export type ActionProvider = (ctx: QueryCtx, p: ProviderCtx) => Promise<ActionItem[]>;
