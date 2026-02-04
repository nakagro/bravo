import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

/**
 * Get user context from the auth identity and user record for logging
 * Fetches the user's first/last name from the database for better log readability
 */
export async function getLogContext(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<LogContext> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {};
    }
    
    // Try to get the user record from the database for first/last name
    // This only works for QueryCtx and MutationCtx (not ActionCtx)
    let userName = identity.name;
    
    if ("db" in ctx) {
      try {
        const userId = await getAuthUserId(ctx as QueryCtx | MutationCtx);
        if (userId) {
          const user = await (ctx as QueryCtx | MutationCtx).db.get(userId);
          if (user) {
            // Prefer firstName + lastName, fall back to name field
            if (user.firstName && user.lastName) {
              userName = `${user.firstName} ${user.lastName}`;
            } else if (user.firstName) {
              userName = user.firstName;
            } else if (user.name) {
              userName = user.name;
            }
          }
        }
      } catch {
        // If we can't get the user record, fall back to identity name
      }
    }
    
    return {
      userId: identity.subject,
      userEmail: identity.email,
      userName,
    };
  } catch {
    return {};
  }
}

/**
 * Format a log message with consistent structure
 */
function formatLogMessage(
  level: LogLevel,
  functionName: string,
  message: string,
  context?: LogContext,
  data?: Record<string, unknown>
): string {
  const parts: string[] = [];
  
  // Level and function name
  parts.push(`[${level.toUpperCase()}]`);
  parts.push(`[${functionName}]`);
  
  // User context - prefer name for readability, fall back to email, then userId
  if (context?.userName) {
    parts.push(`[${context.userName}]`);
  } else if (context?.userEmail) {
    parts.push(`[${context.userEmail}]`);
  } else if (context?.userId) {
    parts.push(`[user:${context.userId.slice(-8)}]`);
  }
  
  // Message
  parts.push(message);
  
  // Additional data
  if (data && Object.keys(data).length > 0) {
    parts.push(JSON.stringify(data));
  }
  
  return parts.join(" ");
}

/**
 * Logger utility for Convex functions
 * 
 * Usage:
 * ```typescript
 * const log = createLogger("myFunction");
 * const context = await getLogContext(ctx);
 * 
 * log.info("Starting operation", context);
 * log.info("Completed", context, { count: 5 });
 * log.error("Failed", context, { error: "something went wrong" });
 * ```
 */
export function createLogger(functionName: string) {
  return {
    info: (message: string, context?: LogContext, data?: Record<string, unknown>) => {
      console.log(formatLogMessage("info", functionName, message, context, data));
    },
    warn: (message: string, context?: LogContext, data?: Record<string, unknown>) => {
      console.warn(formatLogMessage("warn", functionName, message, context, data));
    },
    error: (message: string, context?: LogContext, data?: Record<string, unknown>) => {
      console.error(formatLogMessage("error", functionName, message, context, data));
    },
    debug: (message: string, context?: LogContext, data?: Record<string, unknown>) => {
      console.log(formatLogMessage("debug", functionName, message, context, data));
    },
  };
}

/**
 * Quick log helper for simple cases where you just want to log with user context
 * 
 * Usage:
 * ```typescript
 * await logAction(ctx, "purgeExpiredTokens", "Purged tokens", { count: 5 });
 * ```
 */
export async function logAction(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  functionName: string,
  message: string,
  data?: Record<string, unknown>
) {
  const context = await getLogContext(ctx);
  const log = createLogger(functionName);
  log.info(message, context, data);
}
