import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

type AuthProfile = Record<string, unknown> & {
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

type CreateOrUpdateAuthUserArgs = {
  existingUserId: Id<"users"> | null;
  type: "oauth" | "credentials" | "email" | "phone" | "verification";
  profile: AuthProfile;
};

type UserFields = Omit<Partial<Doc<"users">>, "_id" | "_creationTime">;

/**
 * Keep email OTP as a sign-in method for existing BRAVO members.
 *
 * Convex Auth normally links email providers only to users whose email is
 * already marked verified. BRAVO's existing password accounts predate that
 * field, so the default behavior creates a second, empty user. Resolve the
 * member by email before Convex Auth creates or updates the provider account.
 */
export async function createOrUpdateAuthUser(
  ctx: GenericMutationCtx<DataModel>,
  args: CreateOrUpdateAuthUserArgs,
): Promise<Id<"users">> {
  const {
    emailVerified,
    phoneVerified,
    ...rawProfile
  } = args.profile;
  const normalizedEmail =
    typeof args.profile.email === "string"
      ? args.profile.email.toLowerCase().trim()
      : undefined;

  let userId = args.existingUserId;
  if (args.type === "email") {
    if (!normalizedEmail) {
      throw new Error("Email is required for email-code sign-in.");
    }

    const matchingUsers = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalizedEmail))
      .take(2);

    if (matchingUsers.length === 0) {
      throw new Error("No BRAVO account exists for this email address.");
    }
    if (matchingUsers.length > 1) {
      throw new Error(
        "Multiple BRAVO accounts use this email address. Contact an administrator.",
      );
    }

    userId = matchingUsers[0]._id;
  }

  const userData = {
    ...rawProfile,
    ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
    ...(emailVerified ? { emailVerificationTime: Date.now() } : {}),
    ...(phoneVerified ? { phoneVerificationTime: Date.now() } : {}),
  } as UserFields;

  if (userId === null) {
    return await insertNewUser(ctx, userData);
  }

  const existingUser = await ctx.db.get(userId);
  if (!existingUser) {
    throw new Error("The user linked to this sign-in account no longer exists.");
  }
  await ctx.db.patch(userId, userData);
  return userId;
}

/**
 * A brand-new account. Anything not created by an admin (who passes
 * `approvalStatus: "approved"`) is a self-service sign-up: it starts pending,
 * on the floor rank, and reaches nothing until an admin approves it. The
 * default is pending so no other path can create a live account by accident.
 */
async function insertNewUser(ctx: GenericMutationCtx<DataModel>, userData: UserFields) {
  const memberNumber = userData.memberNumber?.trim();
  if (memberNumber) {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_memberNumber", (q) => q.eq("memberNumber", memberNumber))
      .first();
    if (existing) {
      throw new Error(
        "A member with this CFA number already exists. Please check your member number or contact an administrator.",
      );
    }
  }

  const approvalStatus = userData.approvalStatus ?? "pending";
  const userId = await ctx.db.insert("users", {
    ...userData,
    ...(memberNumber !== undefined ? { memberNumber } : {}),
    rank: userData.rank ?? "Brigade Member",
    approvalStatus,
    // Only an admin-created account may arrive as an admin; super admin is
    // never granted on sign-up or account creation.
    isAdmin: approvalStatus === "approved" ? userData.isAdmin : false,
    isSuperAdmin: false,
  });

  if (approvalStatus === "pending") await notifyAdminsOfSignup(ctx, userId);
  return userId;
}

async function notifyAdminsOfSignup(ctx: GenericMutationCtx<DataModel>, userId: Id<"users">) {
  const emailSetting = await ctx.db
    .query("emailSettings")
    .withIndex("by_emailType", (q) => q.eq("emailType", "newUserSignup"))
    .first();
  // Default to enabled when the setting row doesn't exist yet.
  if (emailSetting && !emailSetting.enabled) return;

  const user = await ctx.db.get(userId);
  if (!user) return;
  const admins = await ctx.db
    .query("users")
    .withIndex("by_isAdmin", (q) => q.eq("isAdmin", true))
    .collect();
  const adminEmails = admins
    .filter((admin) => !admin.isDisabled)
    .map((admin) => admin.email)
    .filter((email): email is string => !!email);
  if (adminEmails.length === 0) return;

  await ctx.scheduler.runAfter(0, internal.emails.sendNewUserSignupNotification, {
    adminEmails,
    newUserName:
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.name || user.email || "",
    newUserEmail: user.email ?? "",
    newUserMemberNumber: user.memberNumber ?? "",
  });
}
