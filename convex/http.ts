import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { api } from "./_generated/api";
import { validateApiKey, getCorsHeaders } from "./apiKeyAuth";

const http = httpRouter();

auth.addHttpRoutes(http);

// CORS preflight handler for calendar endpoint
http.route({
  path: "/calendar/events",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

// Calendar proxy endpoint to avoid CORS issues
http.route({
  path: "/calendar/events",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      // Extract calendar URL and auth parameters from query parameters
      const url = new URL(request.url);
      const calendarUrl = url.searchParams.get("url");
      const username = url.searchParams.get("username");
      const password = url.searchParams.get("password");
      
      if (!calendarUrl) {
        return new Response(
          JSON.stringify({ error: "Missing calendar URL parameter" }),
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Prepare headers for the CalDAV request
      const headers: Record<string, string> = {
        'Accept': 'text/calendar',
        'User-Agent': 'Brigade-Management-System/1.0'
      };

      // Add Basic Authentication if credentials are provided
      if (username && password) {
        const credentials = btoa(`${username}:${password}`);
        headers['Authorization'] = `Basic ${credentials}`;
      }

      // Fetch the ICS data from the CalDAV server
      const response = await fetch(calendarUrl, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Calendar server responded with ${response.status}: ${response.statusText}`);
      }

      const icsData = await response.text();

      // Return the ICS data with proper CORS headers
      return new Response(icsData, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });

    } catch (error) {
      console.error("Error fetching calendar data:", error);
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch calendar data",
          details: error instanceof Error ? error.message : "Unknown error"
        }),
        { 
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
  }),
});

// CORS preflight for member availability endpoint
http.route({
  path: "/api/member-availability",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
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
      console.log("[INFO] [GET /api/member-availability] Unauthorized request - invalid API key");
      return authResult.errorResponse!;
    }

    // Get optional client identifier from header or query param
    const url = new URL(request.url);
    const clientId = request.headers.get("X-Client-Id") 
      || url.searchParams.get("client") 
      || "unknown-client";
    
    console.log(`[INFO] [GET /api/member-availability] [${clientId}] Request received`);

    try {
      // Get all users
      const users = await ctx.runQuery(api.users.getUsers);
      
      // Get all user IDs for batch skills query
      const userIds = users
        .filter(user => user.firstName && user.lastName)
        .map(user => user._id);
      
      // Fetch all skills in ONE batch query (avoids N+1 problem)
      const batchSkills = await ctx.runQuery(api.skills.getBatchUserSkills, { userIds });
      
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
          details: error instanceof Error ? error.message : "Unknown error"
        }),
        { 
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            ...getCorsHeaders(),
          }
        }
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
  handler: httpAction(async (ctx, request) => {
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
          details: error instanceof Error ? error.message : "Unknown error"
        }),
        { 
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            ...getCorsHeaders(),
          }
        }
      );
    }
  }),
});

export default http;
