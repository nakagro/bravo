import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

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
    return await ctx.db.insert("users", userData);
  }

  const existingUser = await ctx.db.get(userId);
  if (!existingUser) {
    throw new Error("The user linked to this sign-in account no longer exists.");
  }
  await ctx.db.patch(userId, userData);
  return userId;
}
