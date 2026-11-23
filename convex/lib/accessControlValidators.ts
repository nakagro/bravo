import { v } from "convex/values";

export const ACCESS_STALE_AFTER_MS = 2 * 60 * 1000;
export const ACCESS_COMMAND_TTL_MS = 15_000;
export const ACCESS_EXECUTING_TIMEOUT_MS = 45_000;
export const ACCESS_COOLDOWN_MS = 3_000;
export const ACCESS_MAX_EVENTS_PER_SITE = 50;
export const ACCESS_RECENT_COMMANDS_WINDOW_MS = 5 * 60 * 1000;

export const VALID_SITE_IDS = ["main", "satellite"] as const;
export type AccessSiteId = (typeof VALID_SITE_IDS)[number];

export const panelKindValidator = v.union(
  v.literal("inception"),
  v.literal("challenger"),
);

export const areaStatusValidator = v.union(
  v.literal("armed"),
  v.literal("disarmed"),
  v.literal("alarm"),
  v.literal("exitDelay"),
  v.literal("entryDelay"),
);

export const doorStatusValidator = v.union(
  v.literal("secured"),
  v.literal("unlocked"),
  v.literal("open"),
  v.literal("heldOpen"),
  v.literal("forced"),
  v.literal("offline"),
);

export const doorKindValidator = v.union(
  v.literal("door"),
  v.literal("roller"),
);

export const accessAreaValidator = v.object({
  id: v.string(),
  name: v.string(),
  status: areaStatusValidator,
  changedAt: v.number(),
  changedBy: v.optional(v.string()),
  canControl: v.boolean(),
});

export const accessDoorValidator = v.object({
  id: v.string(),
  name: v.string(),
  kind: doorKindValidator,
  status: doorStatusValidator,
  changedAt: v.number(),
  canControl: v.boolean(),
  supportsHold: v.boolean(),
  unlockedUntil: v.optional(v.number()),
});

export const accessSitePayloadValidator = v.object({
  name: v.string(),
  panel: panelKindValidator,
  panelLabel: v.string(),
  writesEnabled: v.boolean(),
  bridgeVersion: v.optional(v.string()),
  areas: v.array(accessAreaValidator),
  doors: v.array(accessDoorValidator),
});

export const accessEventSourceValidator = v.union(
  v.literal("panel"),
  v.literal("bravo"),
);

export const accessEventInputValidator = v.object({
  externalId: v.string(),
  at: v.number(),
  text: v.string(),
  who: v.optional(v.string()),
});

export const commandTargetKindValidator = v.union(
  v.literal("area"),
  v.literal("door"),
  v.literal("roller"),
);

export const commandActionValidator = v.union(
  v.literal("arm"),
  v.literal("arm_stay"),
  v.literal("disarm"),
  v.literal("pulse"),
  v.literal("unlock"),
  v.literal("lock"),
  v.literal("open_roller"),
  v.literal("disarm_and_open_roller"),
);

export const commandStatusValidator = v.union(
  v.literal("pending"),
  v.literal("executing"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("expired"),
);

export const commandCompletionStatusValidator = v.union(
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("expired"),
);
