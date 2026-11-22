import { convexAuth, getAuthUserId, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import { query, mutation, action, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { isMemberAccount, isDisabledAccount } from "./lib/accountType";
import { sendGuardedEmail } from "./emails";
import { createOrUpdateAuthUser } from "./lib/authUser";
import { randomDigits } from "./lib/access";

// New sign-ups get the floor rank "Brigade Member" and wait for approval;
// see insertNewUser in lib/authUser.ts.

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = params.email as string;
        // Sign-up also carries the member's name and CFA number, so the account
        // is complete the moment it exists. Pick fields by name: nothing else
        // from the form (an approval status, an admin flag) reaches the row.
        const text = (key: string) => {
          const value = params[key];
          return typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : undefined;
        };
        const firstName = text("firstName");
        const lastName = text("lastName");
        const memberNumber = text("memberNumber");
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        return {
          email,
          name: fullName || email,
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
          ...(memberNumber ? { memberNumber } : {}),
        };
      },
      // Applies whenever a password is set (sign-up, reset). Existing
      // passwords are untouched: this is never checked at sign-in.
      validatePasswordRequirements: (password: string) => {
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters long");
        }
      },
    }),
    Email({
      id: "email-otp",
      maxAge: 10 * 60,
      async generateVerificationToken() {
        return randomDigits(6);
      },
      async sendVerificationRequest({ identifier: email, token }) {
        // ctx is passed at runtime by @convex-dev/auth but absent from the
        // auth.js-inherited type signature (see signIn.js:92).
        const ctx = arguments[1] as GenericActionCtx<DataModel>;
        const user = await ctx.runQuery(internal.auth.getUserByEmail, { email });
        if (user && isDisabledAccount(user)) {
          throw new Error("This account has been disabled.");
        }
        await sendGuardedEmail({
          to: email,
          subject: `${token} is your BRAVO sign-in code`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
              <h1 style="color: #dc2626; margin-bottom: 4px;">BRAVO</h1>
              <p style="color: #6b7280; margin-top: 0;">BRigade AVailability and Operations</p>
              <p>Your sign-in code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 8px; margin: 16px 0;">
                ${token}
              </div>
              <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
              <p style="font-size: 0; color: transparent; line-height: 0; max-height: 0; overflow: hidden;">@bravo.grayhux.io #${token}</p>
            </div>
          `,
        });
      },
    }),
  ],
  callbacks: {
    createOrUpdateUser: createOrUpdateAuthUser,
    // Runs for every sign-in method (password, email code, refresh), so a
    // disabled account can't sign back in by any route. Pending sign-ups may
    // sign in: they see the "waiting for approval" screen and nothing else.
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get(userId);
      if (!user || isDisabledAccount(user)) {
        throw new Error("This account has been disabled.");
      }
    },
  },
  jwt: {
    customClaims: async (ctx, { userId }) => {
      const user = await ctx.db.get(userId);
      return {
        name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.name,
        email: user?.email,
        labsMember: isMemberAccount(user ?? {}),
      };
    },
  },
  session: {
    // 1 year absolute limit (prevents "time bomb" forced logout)
    totalDurationMs: 1000 * 60 * 60 * 24 * 365,
    // 30 days inactivity limit (logs out if they stop using the app)
    inactiveDurationMs: 1000 * 60 * 60 * 24 * 30,
  },
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

// Query to validate signup data before creating an account
// Checks member number and email uniqueness upfront
export const validateSignupData = query({
  args: {
    memberNumber: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existingMember = await ctx.db
      .query("users")
      .withIndex("by_memberNumber", (q) => q.eq("memberNumber", args.memberNumber))
      .first();

    if (existingMember) {
      return { valid: false, error: "A member with this CFA number already exists. Please check your member number or contact an administrator." };
    }

    const normalizedEmail = args.email.toLowerCase().trim();
    const existingEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingEmail) {
      return { valid: false, error: "An account with this email already exists." };
    }

    return { valid: true, error: null };
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

    // Check member number uniqueness if being updated
    if (args.memberNumber !== undefined) {
      const existingMember = await ctx.db
        .query("users")
        .withIndex("by_memberNumber", (q) => q.eq("memberNumber", args.memberNumber))
        .first();

      if (existingMember && existingMember._id !== userId) {
        throw new Error("A member with this CFA number already exists.");
      }
    }

    // Check email uniqueness if being updated
    if (args.email !== undefined) {
      const normalizedEmail = args.email.toLowerCase().trim();
      const existingEmail = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", normalizedEmail))
        .first();

      if (existingEmail && existingEmail._id !== userId) {
        throw new Error("A member with this email address already exists.");
      }
      args.email = normalizedEmail;
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

// Fills in a new sign-up's name and CFA number. Older app builds call this
// after creating the account; the sign-up form now sends these fields with the
// account itself (see the Password profile above), so this is a fallback.
// It only ever touches the caller's own account, and only while that account
// is still waiting for approval, so it can't rename or re-rank anyone.
export const storeSignupData = mutation({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    memberNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, message: "User not found. Try again after signing in." };
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false, message: "User not found. Try again after signing in." };
    }
    if (user.approvalStatus !== "pending") {
      // Approved accounts change their details through updateUserProfile.
      return { success: true };
    }
    if (user.email !== args.email.toLowerCase().trim()) {
      throw new Error("You can only update your own account");
    }

    const memberNumber = args.memberNumber.trim();
    const existingMember = await ctx.db
      .query("users")
      .withIndex("by_memberNumber", (q) => q.eq("memberNumber", memberNumber))
      .first();
    if (existingMember && existingMember._id !== userId) {
      throw new Error("A member with this CFA number already exists. Please check your member number or contact an administrator.");
    }

    const firstName = args.firstName.trim().slice(0, 100);
    const lastName = args.lastName.trim().slice(0, 100);
    await ctx.db.patch(userId, {
      firstName,
      lastName,
      memberNumber,
      name: `${firstName} ${lastName}`.trim(),
    });

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
    await ctx.runQuery(internal.access.assertAdmin, {});

    // Get target user information
    const targetUser = await ctx.runQuery(internal.users.getUserById, { userId: args.targetUserId });
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

    } catch  {
      throw new Error("Failed to reset password");
    }
  },
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      isDisabled: v.optional(v.boolean()),
    }),
    v.null(),
  ),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.toLowerCase().trim()))
      .first();
    if (!user) return null;
    return { isDisabled: user.isDisabled ?? undefined };
  },
});
