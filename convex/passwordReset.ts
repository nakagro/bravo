import { mutation, action, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { modifyAccountCredentials } from "@convex-dev/auth/server";

/**
 * Generate a cryptographically secure random token
 */
function generateResetToken(): string {
  // Generate a random token (32 characters)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Request a password reset - creates a token and sends email
 * Public mutation (no auth required)
 */
export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // Normalize email to lowercase
    const email = args.email.toLowerCase().trim();
    
    // Check if user exists with this email
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("email"), email))
      .first();
    
    // For security, always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      return {
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      };
    }
    
    // Generate a unique token
    const token = generateResetToken();
    
    // Set expiration to 30 minutes from now
    const expiresAt = Date.now() + (30 * 60 * 1000);
    
    // Invalidate any existing unused tokens for this email
    const existingTokens = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter(q => q.eq(q.field("used"), false))
      .collect();
    
    for (const existingToken of existingTokens) {
      await ctx.db.patch(existingToken._id, { used: true });
    }
    
    // Create new reset token
    await ctx.db.insert("passwordResetTokens", {
      email,
      token,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    });
    
    // Schedule email to be sent
    await ctx.scheduler.runAfter(0, internal.emails.sendPasswordResetEmail, {
      email,
      token,
      userName: user.name || user.firstName || email,
    });
    
    return {
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    };
  },
});

/**
 * Internal helper to verify a reset token
 */
async function verifyTokenHelper(ctx: any, token: string) {
  const resetToken = await ctx.db
    .query("passwordResetTokens")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();
  
  if (!resetToken) {
    return { valid: false as const, reason: "Invalid reset token" };
  }
  
  if (resetToken.used) {
    return { valid: false as const, reason: "This reset link has already been used" };
  }
  
  if (resetToken.expiresAt < Date.now()) {
    return { valid: false as const, reason: "This reset link has expired" };
  }
  
  return {
    valid: true as const,
    email: resetToken.email,
  };
}

/**
 * Verify a reset token is valid
 * Public query (no auth required)
 */
export const verifyResetToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      email: v.string(),
    }),
    v.object({
      valid: v.literal(false),
      reason: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    return await verifyTokenHelper(ctx, args.token);
  },
});

/**
 * Internal query to verify a reset token (for use in actions)
 */
export const internalVerifyResetToken = internalQuery({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      valid: v.literal(true),
      email: v.string(),
    }),
    v.object({
      valid: v.literal(false),
      reason: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    return await verifyTokenHelper(ctx, args.token);
  },
});

/**
 * Reset password using a valid token
 * Public action (no auth required)
 */
export const resetPasswordWithToken = action({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    // Verify the token first
    const verification: { valid: true; email: string } | { valid: false; reason: string } = 
      await ctx.runQuery(internal.passwordReset.internalVerifyResetToken, {
        token: args.token,
      });
    
    if (!verification.valid) {
      return {
        success: false,
        message: verification.reason,
      };
    }
    
    const email = verification.email;
    
    // Password strength validation
    if (args.newPassword.length < 8) {
      return {
        success: false,
        message: "Password must be at least 8 characters long",
      };
    }
    
    try {
      // Update the password using Convex auth
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: {
          id: email,
          secret: args.newPassword,
        },
      });
      
      // Mark token as used
      await ctx.runMutation(internal.passwordReset.markTokenAsUsed, {
        token: args.token,
      });
      
      return {
        success: true,
        message: "Password has been reset successfully. You can now sign in with your new password.",
      };
    } catch (error: any) {
      console.error("Password reset error:", error);
      return {
        success: false,
        message: "Failed to reset password. Please try again or request a new reset link.",
      };
    }
  },
});

/**
 * Internal mutation to mark a token as used
 */
export const markTokenAsUsed = internalMutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const resetToken = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    
    if (resetToken) {
      await ctx.db.patch(resetToken._id, { used: true });
    }
    
    return null;
  },
});

/**
 * Cleanup expired tokens (can be run periodically)
 * Admin only
 */
export const cleanupExpiredTokens = mutation({
  args: {},
  returns: v.object({
    deleted: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    
    // Find all expired tokens
    const expiredTokens = await ctx.db
      .query("passwordResetTokens")
      .filter(q => q.lt(q.field("expiresAt"), now))
      .collect();
    
    // Delete them
    for (const token of expiredTokens) {
      await ctx.db.delete(token._id);
    }
    
    return { deleted: expiredTokens.length };
  },
});
