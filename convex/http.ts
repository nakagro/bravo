import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

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
        "Access-Control-Allow-Headers": "Content-Type, Accept, sentry-trace, baggage, Authorization, X-Requested-With",
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

export default http;
