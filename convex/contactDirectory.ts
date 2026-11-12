import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { isDisabledAccount } from "./lib/accountType";

// The District contact book. It holds named people's phone numbers and emails
// and carries a CFA no-reproduction notice, so it lives in file storage behind
// auth: signed-in accounts (members and shared devices) or a kiosk service
// session can read it; only admins can replace it. The JSON is too large for a
// document (over 1 MiB), so the row only points at the stored file.

const SERVICE_MODULE_KIOSK = "kiosk";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** A kiosk tablet's PIN session, valid and allowed the kiosk module. */
async function isKioskSession(
  ctx: QueryCtx,
  serviceToken: string | undefined,
): Promise<boolean> {
  const token = serviceToken?.trim();
  if (!token) return false;

  const tokenHash = await sha256(token);
  const session = await ctx.db
    .query("serviceAccountSessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .first();
  if (!session || session.expiresAt < Date.now()) return false;

  const account = await ctx.db.get(session.serviceAccountId);
  return !!account && account.isActive && account.allowedModules.includes(SERVICE_MODULE_KIOSK);
}

async function canRead(ctx: QueryCtx, serviceToken: string | undefined) {
  const userId = await getAuthUserId(ctx);
  if (userId) {
    const user = await ctx.db.get(userId);
    if (user && !isDisabledAccount(user)) return true;
  }
  return await isKioskSession(ctx, serviceToken);
}

async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");
  const user = await ctx.db.get(userId);
  if (!user?.isAdmin || isDisabledAccount(user)) {
    throw new Error("Admin access required");
  }
  return userId;
}

async function currentFile(ctx: QueryCtx) {
  return await ctx.db.query("contactDirectoryFiles").order("desc").first();
}

/**
 * Where to fetch the contact book from. `serviceToken` is for kiosk tablets,
 * which sign in by PIN rather than through Convex Auth.
 */
export const getDirectoryFile = query({
  args: { serviceToken: v.optional(v.string()) },
  returns: v.union(
    v.object({ status: v.literal("unauthorised") }),
    v.object({ status: v.literal("missing") }),
    v.object({
      status: v.literal("ready"),
      url: v.string(),
      uploadedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!(await canRead(ctx, args.serviceToken))) {
      return { status: "unauthorised" as const };
    }
    const file = await currentFile(ctx);
    if (!file) return { status: "missing" as const };
    const url = await ctx.storage.getUrl(file.storageId);
    if (!url) return { status: "missing" as const };
    return { status: "ready" as const, url, uploadedAt: file.uploadedAt };
  },
});

/** Admin card summary: what is loaded and who loaded it. */
export const getAdminSummary = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      fileName: v.string(),
      title: v.optional(v.string()),
      sizeBytes: v.number(),
      uploadedAt: v.number(),
      uploadedByName: v.string(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const file = await currentFile(ctx);
    if (!file) return null;
    const uploader = await ctx.db.get(file.uploadedBy);
    const uploadedByName =
      [uploader?.firstName, uploader?.lastName].filter(Boolean).join(" ") ||
      uploader?.name ||
      "Unknown";
    return {
      fileName: file.fileName,
      title: file.title,
      sizeBytes: file.sizeBytes,
      uploadedAt: file.uploadedAt,
      uploadedByName,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Make an uploaded file the current contact book. The browser validates the
 * JSON shape before uploading; this checks the stored file's size and swaps
 * it in, deleting the previous file.
 */
export const setDirectoryFile = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);

    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata) throw new Error("Uploaded file not found");
    if (metadata.size > MAX_FILE_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Contact book file is too large (10 MB maximum)");
    }

    const previous = await ctx.db.query("contactDirectoryFiles").take(10);
    for (const row of previous) {
      if (row.storageId !== args.storageId) {
        await ctx.storage.delete(row.storageId);
      }
      await ctx.db.delete("contactDirectoryFiles", row._id);
    }

    await ctx.db.insert("contactDirectoryFiles", {
      storageId: args.storageId,
      fileName: args.fileName.trim().slice(0, 200) || "contact-book.json",
      title: args.title?.trim().slice(0, 200) || undefined,
      sizeBytes: metadata.size,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });
    return null;
  },
});
