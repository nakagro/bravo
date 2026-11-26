import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { validateApiKey, getCorsHeaders } from "./apiKeyAuth";
import { isMemberAccount } from "./lib/accountType";
import { secretMatches } from "./labsMember";
import { isTruthyFlag } from "./lib/accessControlWrites";
import { kioskHubTokenMatches } from "./lib/kioskHubAuth";
import {
  CLIENT_REQUEST_ID_MAX,
  KIOSK_DEVICE_RE,
  STATION_LOCATION_MAX,
  contactDirectoryEtag,
} from "./kioskApi";

const http = httpRouter();

auth.addHttpRoutes(http);

// CORS preflight for member availability endpoint
http.route({
  path: "/api/member-availability",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(),
    });
  }),
});

// Member availability endpoint for external SPA (API key protected)
// Supports optional client identification via X-Client-Id header or ?client query param
// Example: X-Client-Id: main-station-turnout or ?client=satellite-turnout
http.route({
  path: "/api/member-availability",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Validate API key
    const authResult = validateApiKey(request);

    if (!authResult.isValid) {
      console.log(
        "[INFO] [GET /api/member-availability] Unauthorized request - invalid API key",
      );
      return authResult.errorResponse!;
    }

    // Get optional client identifier from header or query param
    const url = new URL(request.url);
    const clientId =
      request.headers.get("X-Client-Id") ||
      url.searchParams.get("client") ||
      "unknown-client";

    console.log(
      `[INFO] [GET /api/member-availability] [${clientId}] Request received`,
    );

    try {
      // Get all users. `getUsers` deliberately still returns shared accounts (the
      // admin screen needs them), so the external CAD/paging consumer filters here
      // - it must never be told the DO phone is "available".
      const users = (await ctx.runQuery(internal.users.listAllUsers, {})).filter(isMemberAccount);

      // Get all user IDs for batch skills query
      const userIds = users
        .filter((user) => user.firstName && user.lastName)
        .map((user) => user._id);

      // Fetch all skills in ONE batch query (avoids N+1 problem)
      const batchSkills = await ctx.runQuery(internal.skills.getBatchUserSkillsInternal, {
        userIds,
      });

      // Build response array
      const memberAvailability = [];

      for (const user of users) {
        // Skip users without required fields
        if (!user.firstName || !user.lastName) {
          continue;
        }

        // Map internal status to API response format
        const availability = user.currentStatus || "Unavailable";

        // Get user's skills from batch result
        const userSkills = batchSkills[user._id] || [];
        const skillsets = userSkills
          .filter((skill: any) => skill.code && skill.code !== "NONE")
          .map((skill: any) => skill.code);

        memberAvailability.push({
          firstname: user.firstName,
          lastname: user.lastName,
          availability,
          skillsets,
        });
      }

      // Return the data with CORS headers
      return new Response(JSON.stringify(memberAvailability), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    } catch (error) {
      console.error("Error fetching member availability:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch member availability",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders(),
          },
        },
      );
    }
  }),
});

// ============================================================================
// SHORTCUTS ENDPOINT - Apple Shortcuts / Webhooks
// ============================================================================

const VALID_STATUSES = new Set([
  "available - station",
  "available - at station",
  "available - satellite",
  "not available",
  "delayed response",
  "WFH",
  "WFH - at station",
]);
const VALID_NEXT_STATUSES = new Set([...VALID_STATUSES, "reset"]);

// CORS preflight for shortcuts endpoint
http.route({
  path: "/api/shortcuts/availability",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(),
    });
  }),
});

// Shared handler for both GET and POST requests
const shortcutsHandler = httpAction(async (ctx, request) => {
  try {
    const url = new URL(request.url);

    // Parse parameters: POST supports JSON body + query params, GET uses query params only
    let body: any = {};
    if (request.method === "POST") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          body = await request.json();
        } catch {
          // Ignore malformed JSON, fall back to query params
        }
      }
    }

    const token = body.token || url.searchParams.get("token");
    const status = body.status || url.searchParams.get("status");

    let durationHours =
      body.durationHours !== undefined
        ? body.durationHours
        : url.searchParams.get("durationHours");
    if (typeof durationHours === "string" && durationHours) {
      durationHours = parseFloat(durationHours);
    }
    if (!durationHours || isNaN(durationHours)) {
      durationHours = undefined;
    }

    let nextStatus: string | undefined =
      body.nextStatus || url.searchParams.get("nextStatus") || undefined;

    // --- Input validation ---
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      });
    }

    if (!status) {
      return new Response(
        JSON.stringify({
          error: "Missing status parameter",
          validValues: [...VALID_STATUSES],
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders() },
        },
      );
    }

    if (!VALID_STATUSES.has(status)) {
      return new Response(
        JSON.stringify({
          error: `Invalid status "${status}"`,
          validValues: [...VALID_STATUSES],
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders() },
        },
      );
    }

    if (nextStatus && !VALID_NEXT_STATUSES.has(nextStatus)) {
      return new Response(
        JSON.stringify({
          error: `Invalid nextStatus "${nextStatus}"`,
          validValues: [...VALID_NEXT_STATUSES],
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders() },
        },
      );
    }

    if (nextStatus && !durationHours) {
      return new Response(
        JSON.stringify({
          error: "durationHours is required when nextStatus is specified",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders() },
        },
      );
    }

    // Default nextStatus to "reset" when duration is set but no nextStatus specified
    if (durationHours && !nextStatus) {
      nextStatus = "reset";
    }

    // --- Token verification ---
    const userId = await ctx.runMutation(
      internal.shortcuts.verifyTokenAndGetUser,
      { token },
    );

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...getCorsHeaders() },
        },
      );
    }

    // --- Update status ---
    // Safe to cast: both status and nextStatus have been validated above
    type Status =
      | "available - station"
      | "available - at station"
      | "available - satellite"
      | "not available"
      | "delayed response"
      | "WFH"
      | "WFH - at station";
    type NextStatus = Status | "reset";

    const result = await ctx.runMutation(
      internal.shortcuts.internalUpdateStatus,
      {
        userId,
        status: status as Status,
        durationHours,
        nextStatus: nextStatus as NextStatus | undefined,
      },
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Status updated to "${status}" for ${result.userName}`,
        status,
        durationHours: durationHours ?? null,
        nextStatus: nextStatus ?? null,
        statusExpiresAt: result.statusExpiresAt,
        userName: result.userName,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      },
    );
  } catch (error) {
    console.error("Error in shortcuts endpoint:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...getCorsHeaders() },
      },
    );
  }
});

http.route({
  path: "/api/shortcuts/availability",
  method: "POST",
  handler: shortcutsHandler,
});

http.route({
  path: "/api/shortcuts/availability",
  method: "GET",
  handler: shortcutsHandler,
});

// ============================================================================
// LABS MEMBERSHIP CHECK - server-to-server, for labs.grayhux.io sessions
// ============================================================================

// Labs' server calls this to confirm a session holder is still a Labs member.
// Contract: docs/plans/cross-project-sso-bravo-ghmaps.md, "Labs membership check".
http.route({
  path: "/labs/member",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });

    const header = request.headers.get("Authorization");
    const presented = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!(await secretMatches(presented, process.env.LABS_MEMBER_CHECK_SECRET))) {
      return json(401, { error: "Unauthorized" });
    }

    let userId: unknown;
    try {
      userId = ((await request.json()) as { userId?: unknown } | null)?.userId;
    } catch {
      return json(400, { error: "Malformed body" });
    }
    if (typeof userId !== "string" || userId.length === 0 || userId.length > 64) {
      return json(400, { error: "Malformed userId" });
    }

    const member = await ctx.runQuery(internal.labsMember.isLabsMember, { userId });
    return json(200, { member });
  }),
});


// ============================================================================
// ACCESS CONTROL BRIDGE - outbound LAN site bridges
// ============================================================================

const VALID_SITE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const VALID_AREA_STATUS = new Set(["armed", "disarmed", "alarm", "exitDelay", "entryDelay"]);
const VALID_DOOR_STATUS = new Set(["secured", "unlocked", "open", "heldOpen", "forced", "offline"]);
const VALID_DOOR_KIND = new Set(["door", "roller"]);
const VALID_COMPLETION_STATUS = new Set(["succeeded", "failed", "expired"]);

function bridgeTokenEnvName(siteId: string): string {
  return `ACCESS_BRIDGE_${siteId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_TOKEN`;
}

function accessJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticateAccessBridge(
  request: Request,
): Promise<{ ok: true; siteId: string } | { ok: false; response: Response }> {
  const siteId = request.headers.get("X-Access-Site")?.trim() ?? "";
  if (!VALID_SITE_ID_RE.test(siteId)) {
    return { ok: false, response: accessJson(401, { error: "Unauthorized" }) };
  }
  const envKey = bridgeTokenEnvName(siteId);
  const header = request.headers.get("Authorization");
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!(await secretMatches(presented, process.env[envKey]))) {
    return { ok: false, response: accessJson(401, { error: "Unauthorized" }) };
  }
  return { ok: true, siteId };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseSitePayload(raw: unknown) {
  if (!isRecord(raw)) return null;
  if (typeof raw.name !== "string" || raw.name.length === 0 || raw.name.length > 80) return null;
  if (typeof raw.panel !== "string" || raw.panel.length === 0 || raw.panel.length > 40) return null;
  if (typeof raw.panelLabel !== "string" || raw.panelLabel.length === 0 || raw.panelLabel.length > 80) return null;
  if (typeof raw.writesEnabled !== "boolean") return null;
  if (raw.bridgeVersion !== undefined && (typeof raw.bridgeVersion !== "string" || raw.bridgeVersion.length > 40)) return null;
  if (!Array.isArray(raw.areas) || raw.areas.length > 32) return null;
  if (!Array.isArray(raw.doors) || raw.doors.length > 64) return null;

  const areas = [];
  for (const a of raw.areas) {
    if (!isRecord(a)) return null;
    if (typeof a.id !== "string" || a.id.length === 0 || a.id.length > 64) return null;
    if (typeof a.name !== "string" || a.name.length === 0 || a.name.length > 80) return null;
    if (typeof a.status !== "string" || !VALID_AREA_STATUS.has(a.status)) return null;
    if (typeof a.changedAt !== "number" || !Number.isFinite(a.changedAt)) return null;
    if (a.changedBy !== undefined && typeof a.changedBy !== "string") return null;
    if (typeof a.canControl !== "boolean") return null;
    areas.push({
      id: a.id,
      name: a.name,
      status: a.status as "armed" | "disarmed" | "alarm" | "exitDelay" | "entryDelay",
      changedAt: a.changedAt,
      ...(a.changedBy !== undefined ? { changedBy: a.changedBy } : {}),
      canControl: a.canControl,
    });
  }

  const doors = [];
  for (const d of raw.doors) {
    if (!isRecord(d)) return null;
    if (typeof d.id !== "string" || d.id.length === 0 || d.id.length > 64) return null;
    if (typeof d.name !== "string" || d.name.length === 0 || d.name.length > 80) return null;
    if (typeof d.kind !== "string" || !VALID_DOOR_KIND.has(d.kind)) return null;
    if (typeof d.status !== "string" || !VALID_DOOR_STATUS.has(d.status)) return null;
    if (typeof d.changedAt !== "number" || !Number.isFinite(d.changedAt)) return null;
    if (typeof d.canControl !== "boolean") return null;
    if (typeof d.supportsHold !== "boolean") return null;
    if (d.unlockedUntil !== undefined && (typeof d.unlockedUntil !== "number" || !Number.isFinite(d.unlockedUntil))) return null;
    doors.push({
      id: d.id,
      name: d.name,
      kind: d.kind as "door" | "roller",
      status: d.status as "secured" | "unlocked" | "open" | "heldOpen" | "forced" | "offline",
      changedAt: d.changedAt,
      canControl: d.canControl,
      supportsHold: d.supportsHold,
      ...(d.unlockedUntil !== undefined ? { unlockedUntil: d.unlockedUntil } : {}),
    });
  }

  return {
    name: raw.name,
    panel: raw.panel,
    panelLabel: raw.panelLabel,
    writesEnabled: raw.writesEnabled,
    ...(raw.bridgeVersion !== undefined ? { bridgeVersion: raw.bridgeVersion } : {}),
    areas,
    doors,
  };
}

function parseEventsInput(raw: unknown) {
  if (raw === undefined) return { ok: true as const, events: undefined };
  if (!Array.isArray(raw) || raw.length > 100) return { ok: false as const };
  const events = [];
  for (const ev of raw) {
    if (!isRecord(ev)) return { ok: false as const };
    if (typeof ev.externalId !== "string" || ev.externalId.length === 0 || ev.externalId.length > 80) return { ok: false as const };
    if (typeof ev.at !== "number" || !Number.isFinite(ev.at)) return { ok: false as const };
    if (typeof ev.text !== "string" || ev.text.length === 0 || ev.text.length > 200) return { ok: false as const };
    if (ev.who !== undefined && typeof ev.who !== "string") return { ok: false as const };
    events.push({
      externalId: ev.externalId,
      at: ev.at,
      text: ev.text,
      ...(ev.who !== undefined ? { who: ev.who } : {}),
    });
  }
  return { ok: true as const, events };
}

http.route({
  path: "/api/access/state",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authRes = await authenticateAccessBridge(request);
    if (!authRes.ok) return authRes.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return accessJson(400, { error: "Malformed JSON" });
    }
    if (!isRecord(body)) return accessJson(400, { error: "Body must be a JSON object" });

    const site = parseSitePayload(body.site);
    if (!site) return accessJson(400, { error: "Invalid site payload" });
    const parsedEvents = parseEventsInput(body.events);
    if (!parsedEvents.ok) return accessJson(400, { error: "Invalid events payload" });

    const res = await ctx.runMutation(internal.accessControl.ingestSiteState, {
      siteId: authRes.siteId,
      site,
      ...(parsedEvents.events ? { events: parsedEvents.events } : {}),
    });
    return accessJson(200, res);
  }),
});

http.route({
  path: "/api/access/claim",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authRes = await authenticateAccessBridge(request);
    if (!authRes.ok) return authRes.response;

    const res = await ctx.runMutation(internal.accessControl.claimNextCommand, {
      siteId: authRes.siteId,
    });
    return accessJson(200, res);
  }),
});

http.route({
  path: "/api/access/result",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authRes = await authenticateAccessBridge(request);
    if (!authRes.ok) return authRes.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return accessJson(400, { error: "Malformed JSON" });
    }
    if (!isRecord(body)) return accessJson(400, { error: "Body must be a JSON object" });

    if (typeof body.commandId !== "string" || body.commandId.length === 0 || body.commandId.length > 64) {
      return accessJson(400, { error: "Invalid commandId" });
    }
    if (typeof body.status !== "string" || !VALID_COMPLETION_STATUS.has(body.status)) {
      return accessJson(400, { error: "Invalid status" });
    }
    if (body.message !== undefined && (typeof body.message !== "string" || body.message.length > 300)) {
      return accessJson(400, { error: "Invalid message" });
    }

    let site = undefined;
    if (body.site !== undefined) {
      site = parseSitePayload(body.site);
      if (!site) return accessJson(400, { error: "Invalid site payload" });
    }
    const parsedEvents = parseEventsInput(body.events);
    if (!parsedEvents.ok) return accessJson(400, { error: "Invalid events payload" });

    const res = await ctx.runMutation(internal.accessControl.completeCommand, {
      siteId: authRes.siteId,
      commandId: body.commandId,
      status: body.status as "succeeded" | "failed" | "expired",
      ...(body.message !== undefined ? { message: body.message } : {}),
      ...(site ? { site } : {}),
      ...(parsedEvents.events ? { events: parsedEvents.events } : {}),
    });
    if (!res.ok) return accessJson(409, res);
    return accessJson(200, res);
  }),
});

// ============================================================================
// STATION KIOSK HUB API - /api/kiosk/v1/*, server-to-server from kiosk-hub
// ============================================================================
// Contract: docs/plans/kiosk-local-hub-architecture.md, section 3. The hub on
// node01 calls out over HTTPS with `X-Kiosk-Site` and a per-site bearer
// token. KIOSK_HUB_<SITE>_TOKEN_NEXT is accepted alongside _TOKEN so a token
// can be rotated without downtime. KIOSK_HUB_WRITES_DISABLED switches off the
// POST routes; reads keep serving. No CORS: browsers never call these.

const KIOSK_API_VERSION = 1;
const KIOSK_WRITES_DISABLED_ENV = "KIOSK_HUB_WRITES_DISABLED";
const KIOSK_BUILD_ID_RE = /^[A-Za-z0-9._:+-]{1,64}$/;
const KIOSK_MAX_QUEUE_LAG_MS = 7 * 24 * 60 * 60 * 1000;
const APPLIANCE_NAMES = new Set(["Pumper", "Tanker", "FCV"]);
const BA_USAGE_TYPES = new Set(["firecall", "drill"]);
const STATION_NOTICE_SEVERITIES = new Set(["info", "warning"]);

function kioskJson(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

async function authenticateKioskHub(
  request: Request,
): Promise<{ ok: true; siteId: string } | { ok: false; response: Response }> {
  const unauthorized = { ok: false as const, response: kioskJson(401, { error: "Unauthorized" }) };
  const siteId = request.headers.get("X-Kiosk-Site")?.trim() ?? "";
  const header = request.headers.get("Authorization");
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return (await kioskHubTokenMatches(siteId, presented)) ? { ok: true, siteId } : unauthorized;
}

function kioskWritesDisabled(): Response | null {
  return isTruthyFlag(process.env[KIOSK_WRITES_DISABLED_ENV])
    ? kioskJson(503, { error: "Kiosk writes are switched off in BRAVO" }, { "Retry-After": "300" })
    : null;
}

/**
 * Whether an If-None-Match header names this ETag (weak or strong, or `*`).
 * Convex Cloud's edge compresses larger responses and rewrites the tag to
 * `W/"<tag>-gzip"` (verified on UAT 2026-11-25), so the hub echoes that back;
 * the encoding suffix is dropped before comparing.
 */
function etagMatches(request: Request, etag: string): boolean {
  const header = request.headers.get("If-None-Match");
  if (!header) return false;
  return header
    .split(",")
    .map((tag) =>
      tag
        .trim()
        .replace(/^W\//, "")
        .replace(/-(?:gzip|br|zstd|deflate)"$/, '"'),
    )
    .some((tag) => tag === "*" || tag === etag);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function optionalKioskDevice(raw: unknown): { ok: true; value?: string } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true };
  if (typeof raw !== "string") return { ok: false };
  const value = raw.trim();
  return KIOSK_DEVICE_RE.test(value) ? { ok: true, value } : { ok: false };
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

http.route({
  path: "/api/kiosk/v1/sync",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authRes = await authenticateKioskHub(request);
    if (!authRes.ok) return authRes.response;

    const scopeParam = new URL(request.url).searchParams.get("scope");
    if (scopeParam !== null && scopeParam !== "full" && scopeParam !== "appliances") {
      return kioskJson(400, { error: "scope must be full or appliances" });
    }
    const scope = scopeParam === "appliances" ? "appliances" : "full";

    const snapshot = await ctx.runQuery(internal.kioskApi.getSyncSnapshot, { scope });
    if (scope === "full") {
      // A full sync is the hub's heartbeat, 304 or not.
      const build = request.headers.get("X-Kiosk-Hub-Build")?.trim();
      await ctx.runMutation(internal.kioskApi.recordHubSync, {
        siteId: authRes.siteId,
        ...(build && KIOSK_BUILD_ID_RE.test(build) ? { buildId: build } : {}),
      });
    }

    const etag = `"${scope === "full" ? "f" : "a"}-${(await sha256Hex(JSON.stringify(snapshot))).slice(0, 32)}"`;
    if (etagMatches(request, etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } });
    }
    return kioskJson(
      200,
      { apiVersion: KIOSK_API_VERSION, syncedAt: Date.now(), siteId: authRes.siteId, ...snapshot },
      { ETag: etag },
    );
  }),
});

http.route({
  path: "/api/kiosk/v1/contact-directory",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authRes = await authenticateKioskHub(request);
    if (!authRes.ok) return authRes.response;

    const file = await ctx.runQuery(internal.kioskApi.getContactDirectoryFile, {});
    if (!file) return kioskJson(404, { error: "No contact book uploaded" });
    const etag = contactDirectoryEtag(file);
    if (etagMatches(request, etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } });
    }
    const blob = await ctx.storage.get(file.storageId);
    if (!blob) return kioskJson(404, { error: "No contact book uploaded" });
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": file.contentType ?? "application/json",
        "Cache-Control": "no-store",
        ETag: etag,
      },
    });
  }),
});

http.route({
  path: "/api/kiosk/v1/appliance-location",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authRes = await authenticateKioskHub(request);
    if (!authRes.ok) return authRes.response;
    const disabled = kioskWritesDisabled();
    if (disabled) return disabled;

    const body = await readJsonObject(request);
    if (!body) return kioskJson(400, { error: "Body must be a JSON object" });

    const { applianceName, occurredAt, sentAt, clientRequestId } = body;
    if (typeof applianceName !== "string" || !APPLIANCE_NAMES.has(applianceName)) {
      return kioskJson(400, { error: "applianceName must be Pumper, Tanker or FCV" });
    }
    const stationLocation = typeof body.stationLocation === "string" ? body.stationLocation.trim() : "";
    if (stationLocation.length === 0 || stationLocation.length > STATION_LOCATION_MAX) {
      return kioskJson(400, { error: `stationLocation must be 1-${STATION_LOCATION_MAX} characters` });
    }
    const device = optionalKioskDevice(body.kioskDevice);
    if (!device.ok) return kioskJson(400, { error: "Invalid kioskDevice" });
    if (
      clientRequestId !== undefined &&
      (typeof clientRequestId !== "string" || clientRequestId.length > CLIENT_REQUEST_ID_MAX)
    ) {
      return kioskJson(400, { error: "Invalid clientRequestId" });
    }
    const isTime = (t: unknown): t is number => typeof t === "number" && Number.isFinite(t) && t > 0;
    if ((occurredAt === undefined) !== (sentAt === undefined)) {
      return kioskJson(400, { error: "occurredAt and sentAt must be sent together" });
    }
    if (occurredAt !== undefined) {
      if (!isTime(occurredAt) || !isTime(sentAt)) {
        return kioskJson(400, { error: "occurredAt and sentAt must be epoch milliseconds" });
      }
      if (occurredAt > sentAt || sentAt - occurredAt > KIOSK_MAX_QUEUE_LAG_MS) {
        return kioskJson(400, { error: "occurredAt must be no later than sentAt and at most 7 days before it" });
      }
    }

    const res = await ctx.runMutation(internal.kioskApi.setApplianceLocation, {
      siteId: authRes.siteId,
      applianceName: applianceName as "Pumper" | "Tanker" | "FCV",
      stationLocation,
      ...(device.value ? { kioskDevice: device.value } : {}),
      ...(occurredAt !== undefined ? { occurredAt: occurredAt as number, sentAt: sentAt as number } : {}),
    });
    return kioskJson(200, { ok: true, ...res });
  }),
});

http.route({
  path: "/api/kiosk/v1/ba-record",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authRes = await authenticateKioskHub(request);
    if (!authRes.ok) return authRes.response;
    const disabled = kioskWritesDisabled();
    if (disabled) return disabled;

    const body = await readJsonObject(request);
    if (!body) return kioskJson(400, { error: "Body must be a JSON object" });

    const { clientRequestId, memberId, verifiedBy, dateUsed, durationMinutes, usageType, notes } = body;
    const isId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;
    if (typeof clientRequestId !== "string") return kioskJson(400, { error: "clientRequestId is required" });
    if (!isId(memberId)) return kioskJson(400, { error: "memberId is required" });
    if (!isId(verifiedBy)) return kioskJson(400, { error: "verifiedBy is required" });
    if (typeof dateUsed !== "string") return kioskJson(400, { error: "dateUsed is required" });
    if (typeof durationMinutes !== "number") return kioskJson(400, { error: "durationMinutes is required" });
    if (typeof usageType !== "string" || !BA_USAGE_TYPES.has(usageType)) {
      return kioskJson(400, { error: "usageType must be firecall or drill" });
    }
    if (typeof notes !== "string") return kioskJson(400, { error: "notes are required" });
    const device = optionalKioskDevice(body.kioskDevice);
    if (!device.ok) return kioskJson(400, { error: "Invalid kioskDevice" });

    const res = await ctx.runMutation(internal.kioskApi.submitBaRecord, {
      siteId: authRes.siteId,
      clientRequestId,
      memberId,
      verifiedBy,
      dateUsed,
      durationMinutes,
      usageType: usageType as "firecall" | "drill",
      notes,
      ...(device.value ? { kioskDevice: device.value } : {}),
    });
    switch (res.status) {
      case "created":
      case "deduped":
        return kioskJson(200, { ok: true, deduped: res.status === "deduped", recordId: res.recordId });
      case "conflict":
        return kioskJson(409, { error: res.error });
      case "invalid":
        return kioskJson(400, { error: res.error });
    }
  }),
});

http.route({
  path: "/api/kiosk/v1/station-notice",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authRes = await authenticateKioskHub(request);
    if (!authRes.ok) return authRes.response;
    const disabled = kioskWritesDisabled();
    if (disabled) return disabled;

    const body = await readJsonObject(request);
    if (!body) return kioskJson(400, { error: "Body must be a JSON object" });

    const { key, active, title, detail, severity, count, expiresAt, occurredAt, sentAt } = body;
    if (typeof key !== "string" || key.length === 0) {
      return kioskJson(400, { error: "key is required" });
    }
    if (typeof active !== "boolean") {
      return kioskJson(400, { error: "active must be a boolean" });
    }
    if (title !== undefined && title !== null && typeof title !== "string") {
      return kioskJson(400, { error: "title must be a string" });
    }
    if (detail !== undefined && detail !== null && typeof detail !== "string") {
      return kioskJson(400, { error: "detail must be a string" });
    }
    if (
      severity !== undefined &&
      severity !== null &&
      (typeof severity !== "string" || !STATION_NOTICE_SEVERITIES.has(severity))
    ) {
      return kioskJson(400, { error: "severity must be info or warning" });
    }
    if (count !== undefined && count !== null && typeof count !== "number") {
      return kioskJson(400, { error: "count must be a number" });
    }
    if (expiresAt !== undefined && expiresAt !== null && typeof expiresAt !== "number") {
      return kioskJson(400, { error: "expiresAt must be epoch milliseconds" });
    }
    const device = optionalKioskDevice(body.kioskDevice);
    if (!device.ok) return kioskJson(400, { error: "Invalid kioskDevice" });

    const isTime = (t: unknown): t is number => typeof t === "number" && Number.isFinite(t) && t > 0;
    if ((occurredAt === undefined) !== (sentAt === undefined)) {
      return kioskJson(400, { error: "occurredAt and sentAt must be sent together" });
    }
    if (occurredAt !== undefined) {
      if (!isTime(occurredAt) || !isTime(sentAt)) {
        return kioskJson(400, { error: "occurredAt and sentAt must be epoch milliseconds" });
      }
      if (occurredAt > sentAt || sentAt - occurredAt > KIOSK_MAX_QUEUE_LAG_MS) {
        return kioskJson(400, { error: "occurredAt must be no later than sentAt and at most 7 days before it" });
      }
    }

    const res = await ctx.runMutation(internal.kioskApi.syncStationNotice, {
      siteId: authRes.siteId,
      key,
      active,
      ...(typeof title === "string" ? { title } : {}),
      ...(typeof detail === "string" ? { detail } : {}),
      ...(typeof severity === "string" ? { severity: severity as "info" | "warning" } : {}),
      ...(typeof count === "number" ? { count } : {}),
      ...(typeof expiresAt === "number" ? { expiresAt } : {}),
      ...(device.value ? { kioskDevice: device.value } : {}),
      ...(occurredAt !== undefined ? { occurredAt: occurredAt as number, sentAt: sentAt as number } : {}),
    });
    if (res.status === "invalid") {
      return kioskJson(400, { error: res.error });
    }
    return kioskJson(200, { ok: true, applied: res.applied, notice: res.notice });
  }),
});

export default http;
