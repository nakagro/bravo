import { convexAuth, getAuthUserId, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query, mutation, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * DEFAULT SIGNUP RANK CONFIGURATION
 * 
 * Set the default rank for new user signups.
 * Options: "Probationary" | "Firefighter" | "Lieutenant" | "Captain" | null
 * 
 * - null = Member (no rank, limited permissions)
 * - "Probationary" = Probationary firefighter
 * - "Firefighter" = Full firefighter (recommended for most signups)
 * - "Lieutenant" = Lieutenant rank
 * - "Captain" = Captain rank
 * 
 * Change this value to set what rank new users receive on signup.
 */
const DEFAULT_SIGNUP_RANK: "Probationary" | "Firefighter" | "Lieutenant" | "Captain" | null = "Firefighter";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email as string,
          name: params.email as string,
        };
      },
      // Custom password validation that allows numeric passwords (CFA member numbers)
      validatePasswordRequirements: (password: string) => {
        // Only require minimum length of 4 characters
        // This allows CFA member numbers which are typically 7+ digits
        if (password.length < 4) {
          throw new Error("Password must be at least 4 characters long");
        }
        // No other requirements - allows purely numeric passwords
      },
    }),
  ],
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
    
    // Update the user profile with default rank
    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      memberNumber: args.memberNumber,
      name: `${args.firstName} ${args.lastName}`.trim(),
      rank: DEFAULT_SIGNUP_RANK,
    });
    
    // Check if new user signup email is enabled
    const emailSetting = await ctx.db
      .query("emailSettings")
      .withIndex("by_emailType", (q) => q.eq("emailType", "newUserSignup"))
      .first();
    
    // Only send email if setting is enabled (or doesn't exist yet - default to enabled)
    const shouldSendEmail = !emailSetting || emailSetting.enabled;
    
    if (shouldSendEmail) {
      // Get all admin users to notify them
      const adminUsers = await ctx.db
        .query("users")
        .collect()
        .then(users => users.filter(u => u.isAdmin === true));
      
      // Collect admin emails (only those who have email addresses)
      const adminEmails = adminUsers
        .map(admin => admin.email)
        .filter((email): email is string => !!email);
      
      // Schedule email notification to admins (don't await to avoid blocking)
      if (adminEmails.length > 0) {
        ctx.scheduler.runAfter(0, internal.emails.sendNewUserSignupNotification, {
          adminEmails,
          newUserName: `${args.firstName} ${args.lastName}`.trim(),
          newUserEmail: args.email,
          newUserMemberNumber: args.memberNumber,
        });
      }
    }
    
    return { success: true };
  },
});

// Action to change user password
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to change your password");
    }
    
    // Get user information using the existing query
    const user = await ctx.runQuery(api.auth.loggedInUser);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Get the user's email for verification
    const userEmail = user.email;
    if (!userEmail) {
      throw new Error("User email not found");
    }
    
    // Password strength validation
    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
    
    try {
      // Verify current password by attempting to retrieve the account with credentials
      const account = await retrieveAccount(ctx, {
        provider: "password",
        account: { id: userEmail, secret: args.currentPassword }
      });
      
      if (!account) {
        throw new Error("Invalid current password");
      }
      
      // Update the password using the proper auth library function
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: {
          id: userEmail,
          secret: args.newPassword
        }
      });
      
      return { success: true };
      
    } catch (error: any) {
      // Handle specific auth errors
      if (error.message.includes("InvalidSecret") || error.message.includes("Invalid current password")) {
        throw new Error("Invalid current password");
      }
      throw new Error("Failed to change password");
    }
  },
});

// Action to reset another user's password (admin only)
export const adminResetPassword = action({
  args: {
    targetUserId: v.id("users"),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to reset passwords");
    }
    
    // Get current user to check admin status
    const currentUser = await ctx.runQuery(api.auth.loggedInUser);
    if (!currentUser) {
      throw new Error("User not found");
    }
    
    // Check if current user is admin
    if (!currentUser.isAdmin) {
      throw new Error("Only administrators can reset passwords");
    }
    
    // Get target user information
    const targetUser = await ctx.runQuery(api.users.getUserById, { userId: args.targetUserId });
    if (!targetUser) {
      throw new Error("Target user not found");
    }
    
    // Get the target user's email
    const targetEmail = targetUser.email;
    if (!targetEmail) {
      throw new Error("Target user email not found");
    }
    
    // Password strength validation
    if (args.newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
    
    try {
      // Update the target user's password
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: {
          id: targetEmail,
          secret: args.newPassword
        }
      });
      
      return { success: true };
      
    } catch (error: any) {
      throw new Error("Failed to reset password");
    }
  },
});
