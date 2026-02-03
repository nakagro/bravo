import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

/**
 * Get user context from the auth identity for logging
 */
export async function getLogContext(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<LogContext> {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {};
    }
    return {
      userId: identity.subject,
      userEmail: identity.email,
      userName: identity.name,
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
  
  // User context
  if (context?.userEmail) {
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
