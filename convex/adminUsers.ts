import { createAccount, getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";

const rankValidator = v.union(
  v.literal("Brigade Member"),
  v.literal("Probationary"),
  v.literal("Firefighter"),
  v.literal("Lieutenant"),
  v.literal("Captain"),
);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const assertCanCreateUser = internalQuery({
  args: {
    email: v.string(),
    memberNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const administratorId = await getAuthUserId(ctx);
    if (!administratorId) {
      throw new Error("You must be signed in to create a user");
    }

    const administrator = await ctx.db.get("users", administratorId);
    if (!administrator?.isAdmin) {
      throw new Error("Only administrators can create users");
    }

    const existingEmail = await ctx.db
      .query("users")
      .withIndex("email", (query) => query.eq("email", args.email))
      .unique();
    if (existingEmail) {
      throw new Error("An account with this email already exists");
    }

    const existingMember = await ctx.db
      .query("users")
      .withIndex("by_memberNumber", (query) =>
        query.eq("memberNumber", args.memberNumber),
      )
      .unique();
    if (existingMember) {
      throw new Error("A member with this CFA number already exists");
    }

    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (query) =>
        query.eq("provider", "password").eq("providerAccountId", args.email),
      )
      .unique();
    if (existingAccount) {
      throw new Error(
        "An authentication account with this email already exists",
      );
    }

    return null;
  },
});

export const createUser = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    memberNumber: v.string(),
    password: v.string(),
    rank: rankValidator,
  },
  returns: v.object({ userId: v.id("users") }),
  handler: async (ctx, args) => {
    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    const email = args.email.toLowerCase().trim();
    const memberNumber = args.memberNumber.trim();

    if (!firstName || !lastName) {
      throw new Error("First name and last name are required");
    }
    if (firstName.length > 100 || lastName.length > 100) {
      throw new Error("Names must be 100 characters or fewer");
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      throw new Error("Enter a valid email address");
    }
    if (!memberNumber || memberNumber.length > 50) {
      throw new Error("Enter a valid CFA number");
    }
    if (args.password.length < 8) {
      throw new Error("Temporary password must be at least 8 characters long");
    }

    await ctx.runQuery(internal.adminUsers.assertCanCreateUser, {
      email,
      memberNumber,
    });

    const { user } = await createAccount(ctx, {
      provider: "password",
      account: {
        id: email,
        secret: args.password,
      },
      profile: {
        email,
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        memberNumber,
        rank: args.rank,
        isAdmin: false,
      },
    });

    return { userId: user._id };
  },
});
