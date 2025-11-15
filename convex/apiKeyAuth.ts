/**
 * API Key Authentication Middleware for Convex HTTP Actions
 * 
 * Usage:
 * 1. Set CONVEX_API_KEY environment variable in Convex dashboard
 * 2. Clients pass API key via X-API-Key header
 * 3. Use validateApiKey() in your HTTP action handlers
 */

/**
 * Validates the API key from the request headers
 * @param request - The incoming HTTP request
 * @returns Object with isValid boolean and optional error response
 */
export function validateApiKey(request: Request): {
  isValid: boolean;
  errorResponse?: Response;
} {
  // Get the API key from environment variable
  const validApiKey = process.env.CONVEX_API_KEY;

  // If no API key is configured, reject all requests
  if (!validApiKey) {
    console.error("CONVEX_API_KEY environment variable is not configured");
    return {
      isValid: false,
      errorResponse: new Response(
        JSON.stringify({ 
          error: "API authentication is not configured on the server" 
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      ),
    };
  }

  // Get the API key from the request header
  const providedApiKey = request.headers.get("X-API-Key");

  // Check if API key was provided
  if (!providedApiKey) {
    return {
      isValid: false,
      errorResponse: new Response(
        JSON.stringify({ 
          error: "Missing API key",
          message: "Please provide an API key in the X-API-Key header"
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      ),
    };
  }

  // Validate the API key
  if (providedApiKey !== validApiKey) {
    return {
      isValid: false,
      errorResponse: new Response(
        JSON.stringify({ 
          error: "Invalid API key",
          message: "The provided API key is not valid"
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      ),
    };
  }

  // API key is valid
  return {
    isValid: true,
  };
}

/**
 * Helper function to add CORS headers for API key protected endpoints
 * Includes X-API-Key in allowed headers
 */
export function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}
