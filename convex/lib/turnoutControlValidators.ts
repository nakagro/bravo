import { v } from "convex/values";

export const TURNOUT_DEFAULT_SITE_ID = "main";
export const TURNOUT_SITE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export const TURNOUT_HEADER_HEIGHT_MIN = 10;
export const TURNOUT_HEADER_HEIGHT_MAX = 60;
export const TURNOUT_DEFAULT_HEADER_HEIGHT_SINGLE = 35;
export const TURNOUT_DEFAULT_HEADER_HEIGHT_DOUBLE = 35;
export const TURNOUT_DEFAULT_HEADER_HEIGHT_TRIPLE = 40;

export const TURNOUT_SIM_MESSAGE_MAX = 500;
export const TURNOUT_SIM_ADDRESS_MAX = 200;
export const TURNOUT_SIM_DEFAULT_TTL_MINUTES = 10;
export const TURNOUT_SIM_MIN_TTL_MINUTES = 1;
export const TURNOUT_SIM_MAX_TTL_MINUTES = 99;
export const TURNOUT_AUDIT_PAGE_LIMIT = 25;

export const forceMultiJobCountValidator = v.union(
  v.literal(0),
  v.literal(2),
  v.literal(3),
);

export const turnoutOverridesValidator = v.object({
  isIdleScreenDisabled: v.optional(v.boolean()),
  forceMultiJobCount: v.optional(forceMultiJobCountValidator),
  headerHeightSingle: v.optional(v.number()),
  headerHeightDouble: v.optional(v.number()),
  headerHeightTriple: v.optional(v.number()),
});

export const turnoutCoordinatesValidator = v.object({
  latitude: v.number(),
  longitude: v.number(),
});

export const turnoutSimulationStoredValidator = v.object({
  id: v.string(),
  messageText: v.string(),
  address: v.string(),
  coordinates: v.optional(turnoutCoordinatesValidator),
  playAudio: v.boolean(),
  startedAt: v.number(),
  expiresAt: v.number(),
  startedBy: v.id("users"),
  startedByName: v.string(),
});

/** Wire representation pushed to kiosk-hub -> turnoutsrv01 (omits internal Convex user ID). */
export const turnoutSimulationWireValidator = turnoutSimulationStoredValidator.omit("startedBy");

export const turnoutControlWireValidator = v.object({
  revision: v.number(),
  overrides: turnoutOverridesValidator,
  activeSimulation: v.union(v.null(), turnoutSimulationWireValidator),
  updatedAt: v.number(),
});

export const turnoutSimTtlValidator = v.number();

export const turnoutAuditActionValidator = v.union(
  v.literal("updateOverrides"),
  v.literal("resetOverrides"),
  v.literal("startSimulation"),
  v.literal("stopSimulation"),
  v.literal("expireSimulation"),
);
