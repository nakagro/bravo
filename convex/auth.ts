import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Anonymous],
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});

// Mutation to update user profile with additional information
export const updateUserProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    memberNumber: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user ID
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update your profile");
    }
    
    // Get the current user data
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Update the user with new information
    await ctx.db.patch(userId, {
      ...(args.firstName !== undefined && { firstName: args.firstName }),
      ...(args.lastName !== undefined && { lastName: args.lastName }),
      ...(args.memberNumber !== undefined && { memberNumber: args.memberNumber }),
      ...(args.name !== undefined && { name: args.name }),
      ...(args.email !== undefined && { email: args.email }),
    });
    
    return { success: true };
  },
});

// Mutation to store user profile information during signup
// This is a special function that doesn't require authentication
export const storeSignupData = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    memberNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Store the signup data in a temporary table or session
    // We'll use this to update the user profile once they're authenticated
    
    // Find the user by email (should be created by the auth system)
    const users = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("email"), args.email))
      .collect();
    
    if (users.length === 0) {
      // User not found yet, might be a timing issue
      return { success: false, message: "User not found. Try again after signing in." };
    }
    
    const user = users[0];
    
    // Update the user profile
    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      memberNumber: args.memberNumber,
      name: `${args.firstName} ${args.lastName}`.trim(),
    });
    
    return { success: true };
  },
});
