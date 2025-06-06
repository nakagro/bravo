import { MutationCtx, QueryCtx } from "./_generated/server";
import { UserIdentity } from "convex/server";

/**
 * Helper function to find the current user from an identity
 * This tries multiple methods to find the user and falls back to an admin user if needed
 */
export async function findCurrentUser(ctx: MutationCtx | QueryCtx, identity: UserIdentity) {
  let currentUser = null;
  
  // First try to find by email if available
  if (identity.email) {
    currentUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), identity.email))
      .first();
  }
  
  // If not found by email, try by name if available
  if (!currentUser && identity.name) {
    currentUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("name"), identity.name))
      .first();
  }
  
  // If still not found, try by tokenIdentifier as a last resort
  if (!currentUser && identity.tokenIdentifier) {
    currentUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("tokenIdentifier"), identity.tokenIdentifier))
      .first();
  }
  
  // If we still can't find the user, fall back to an admin user
  if (!currentUser) {
    currentUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .first();
    
    if (!currentUser) {
      throw new Error("Could not find a user to associate with this action. Please contact an administrator.");
    }
    
    console.warn("Using admin user as fallback because the current user could not be found.");
  }
  
  return currentUser;
}
