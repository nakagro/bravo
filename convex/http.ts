import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { validateApiKey, getCorsHeaders } from "./apiKeyAuth";
import { isMemberAccount } from "./lib/accountType";
import { secretMatches } from "./labsMember";

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

export default http;
