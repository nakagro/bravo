import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { api, internal } from "./_generated/api";
import { validateApiKey, getCorsHeaders } from "./apiKeyAuth";

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
      // Get all users
      const users = await ctx.runQuery(api.users.getUsers);

      // Get all user IDs for batch skills query
      const userIds = users
        .filter((user) => user.firstName && user.lastName)
        .map((user) => user._id);

      // Fetch all skills in ONE batch query (avoids N+1 problem)
      const batchSkills = await ctx.runQuery(api.skills.getBatchUserSkills, {
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
          details: error instanceof Error ? error.message : "Unknown error",
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
// TEST ENDPOINT - API Key Authentication Demo
// ============================================================================

// CORS preflight for test endpoint
http.route({
  path: "/api/test-auth",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(),
    });
  }),
});

// Test endpoint demonstrating API key authentication
http.route({
  path: "/api/test-auth",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Validate API key
    const authResult = validateApiKey(request);

    // If validation failed, return the error response
    if (!authResult.isValid) {
      return authResult.errorResponse!;
    }

    // API key is valid - proceed with the request
    try {
      const testData = {
        message: "API key authentication successful!",
        timestamp: new Date().toISOString(),
        endpoint: "/api/test-auth",
        authenticated: true,
      };

      return new Response(JSON.stringify(testData), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(),
        },
      });
    } catch (error) {
      console.error("Error in test endpoint:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error",
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
        details: error instanceof Error ? error.message : "Unknown error",
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

export default http;
