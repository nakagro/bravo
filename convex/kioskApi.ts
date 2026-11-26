import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { isMemberAccount } from "./lib/accountType";
import { isBARecordMemberOption } from "./lib/baEligibility";
import { brigadeDateStr, isIsoCalendarDate } from "./lib/dates";
import { knownLocationsFrom } from "./applianceLocations";
import { kioskHubTokenMatches } from "./lib/kioskHubAuth";
import {
  NOTICE_DETAIL_MAX,
  NOTICE_KEY_RE,
  NOTICE_MAX_COUNT,
  NOTICE_TITLE_MAX,
  stationNoticeSeverityValidator,
} from "./stationNotices";

// Backs the station kiosk hub API, /api/kiosk/v1/* in convex/http.ts. The hub
// (wvfb-kiosk on node01) authenticates per site with a bearer token; by the
// time these run, http.ts has checked it and narrowed the request body's
// types. Everything that needs the database - or must be decided inside one
// transaction, like the BA idempotency check - happens here.
// Contract: docs/plans/kiosk-local-hub-architecture.md, section 3.

const applianceNameValidator = v.union(v.literal("Pumper"), v.literal("Tanker"), v.literal("FCV"));
const usageTypeValidator = v.union(v.literal("firecall"), v.literal("drill"));

const applianceLocationOut = v.object({
  applianceName: applianceNameValidator,
  stationLocation: v.string(),
  updatedAt: v.number(),
});

const stationNoticeOut = v.object({
  key: v.string(),
  title: v.string(),
  detail: v.optional(v.string()),
  severity: stationNoticeSeverityValidator,
  count: v.optional(v.number()),
  source: v.string(),
  updatedBy: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.optional(v.number()),
});

const stationNoticeSyncResultOut = v.object({
  key: v.string(),
  active: v.boolean(),
  title: v.string(),
  detail: v.optional(v.string()),
  severity: stationNoticeSeverityValidator,
  count: v.optional(v.number()),
  source: v.string(),
  updatedBy: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.optional(v.number()),
});

const baMemberOut = v.object({
  id: v.id("users"),
  name: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  rank: v.optional(v.string()),
  skills: v.array(v.string()),
});

const contactDirectoryOut = v.union(
  v.object({ status: v.literal("missing") }),
  v.object({
    status: v.literal("ready"),
    uploadedAt: v.number(),
    sizeBytes: v.number(),
    fileName: v.string(),
    title: v.optional(v.string()),
    etag: v.string(),
  }),
);

export const BA_MAX_DURATION_MINUTES = 480;
export const BA_MAX_AGE_DAYS = 365;
export const BA_NOTES_MAX = 500;
export const CLIENT_REQUEST_ID_MAX = 120;
export const STATION_LOCATION_MAX = 80;
export const KIOSK_DEVICE_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,39}$/;

/** ETag for the stored contact book: changes whenever a new book is uploaded. */
export function contactDirectoryEtag(file: { uploadedAt: number; sizeBytes: number }): string {
  return `"${file.uploadedAt}-${file.sizeBytes}"`;
}

function displayName(user: Doc<"users">): string {
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return full || user.name || "Unknown";
}

function toApplianceOut(row: Doc<"applianceLocations">) {
  return {
    applianceName: row.applianceName,
    stationLocation: row.stationLocation,
    updatedAt: row.updatedAt,
  };
}

async function currentContactFile(ctx: QueryCtx) {
  const file = await ctx.db.query("contactDirectoryFiles").order("desc").first();
  if (!file) return null;
  // A row whose blob has gone is as good as no book.
  const blob = await ctx.db.system.get("_storage", file.storageId);
  return blob ? file : null;
}

async function skillCodesFor(ctx: QueryCtx, user: Doc<"users">): Promise<string[]> {
  const skills = await Promise.all((user.skills ?? []).map((id) => ctx.db.get("skills", id)));
  return skills.flatMap((s) => (s?.code ? [s.code] : []));
}

async function applianceSnapshot(ctx: QueryCtx) {
  const rows = await ctx.db.query("applianceLocations").collect();
  const applianceLocations = rows
    .map(toApplianceOut)
    .sort((a, b) => a.applianceName.localeCompare(b.applianceName));
  return { applianceLocations, knownLocations: knownLocationsFrom(rows) };
}

async function formatNoticeActor(
  ctx: QueryCtx,
  row: Doc<"stationNotices">,
): Promise<{ source: string; updatedBy?: string }> {
  if (row.updatedBySource === "kioskHub") {
    return {
      source: "kiosk-hub",
      updatedBy:
        row.updatedByKioskDevice ??
        (row.updatedByKioskSite ? `Station Kiosk (${row.updatedByKioskSite})` : undefined),
    };
  }
  const user = row.updatedBy ? await ctx.db.get("users", row.updatedBy) : null;
  return {
    source: "bravo",
    updatedBy: user ? displayName(user) : undefined,
  };
}

async function toNoticeOut(ctx: QueryCtx, row: Doc<"stationNotices">) {
  const { source, updatedBy } = await formatNoticeActor(ctx, row);
  return {
    key: row.key,
    title: row.title,
    ...(row.detail !== undefined ? { detail: row.detail } : {}),
    severity: row.severity,
    ...(row.count !== undefined ? { count: row.count } : {}),
    source,
    ...(updatedBy !== undefined ? { updatedBy } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.expiresAt !== undefined ? { expiresAt: row.expiresAt } : {}),
  };
}

async function activeNoticesSnapshot(ctx: QueryCtx) {
  const now = Date.now();
  const rows = await ctx.db.query("stationNotices").collect();
  const active = rows.filter(
    (r) => r.active && (r.expiresAt === undefined || r.expiresAt > now),
  );
  const severityOrder = (s: "info" | "warning") => (s === "warning" ? 0 : 1);
  active.sort(
    (a, b) =>
      severityOrder(a.severity) - severityOrder(b.severity) ||
      b.updatedAt - a.updatedAt ||
      a.key.localeCompare(b.key),
  );
  return await Promise.all(active.map((r) => toNoticeOut(ctx, r)));
}

/**
 * Live truck locations and station notices for the station kiosk hub, which
 * subscribes over the Convex WebSocket (convex-rs) so a change made on a phone
 * reaches the station tablets and turnout screen at once. A WebSocket can't
 * carry the hub's Bearer header, so the site's hub token comes as an argument
 * and is checked like the HTTP API's. Same shape as GET /api/kiosk/v1/sync?scope=appliances.
 */
export const watchAppliances = query({
  args: { siteId: v.string(), token: v.string() },
  returns: v.object({
    applianceLocations: v.array(applianceLocationOut),
    knownLocations: v.array(v.string()),
    stationNotices: v.array(stationNoticeOut),
  }),
  handler: async (ctx, { siteId, token }) => {
    if (!(await kioskHubTokenMatches(siteId, token))) {
      throw new ConvexError("Unauthorized");
    }
    const [{ applianceLocations, knownLocations }, stationNotices] = await Promise.all([
      applianceSnapshot(ctx),
      activeNoticesSnapshot(ctx),
    ]);
    return { applianceLocations, knownLocations, stationNotices };
  },
});

/**
 * The hub's cached view of BRAVO. `appliances` is the fast poll (a fallback
 * when the hub's watchAppliances subscription is down);
 * `full` adds the BA member pickers and the contact book's metadata. Never a
 * storage URL: the book itself comes through /api/kiosk/v1/contact-directory.
 * Ordering is stable so http.ts can hash the result into an ETag.
 */
export const getSyncSnapshot = internalQuery({
  args: { scope: v.union(v.literal("appliances"), v.literal("full")) },
  returns: v.object({
    applianceLocations: v.array(applianceLocationOut),
    knownLocations: v.array(v.string()),
    stationNotices: v.array(stationNoticeOut),
    baMembers: v.optional(v.array(baMemberOut)),
    contactDirectory: v.optional(contactDirectoryOut),
  }),
  handler: async (ctx, { scope }) => {
    const [{ applianceLocations, knownLocations }, stationNotices] = await Promise.all([
      applianceSnapshot(ctx),
      activeNoticesSnapshot(ctx),
    ]);
    if (scope === "appliances") return { applianceLocations, knownLocations, stationNotices };

    const [users, skills] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("skills").collect(),
    ]);
    const codeById = new Map(skills.map((s) => [s._id, s.code]));
    const baMembers = users
      .filter(isMemberAccount)
      .map((u) => ({
        id: u._id,
        name: displayName(u),
        firstName: u.firstName,
        lastName: u.lastName,
        rank: u.rank,
        skills: (u.skills ?? [])
          .map((id) => codeById.get(id))
          .filter((code): code is string => Boolean(code)),
      }))
      .filter(isBARecordMemberOption)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    const file = await currentContactFile(ctx);
    const contactDirectory = file
      ? {
          status: "ready" as const,
          uploadedAt: file.uploadedAt,
          sizeBytes: file.sizeBytes,
          fileName: file.fileName,
          ...(file.title ? { title: file.title } : {}),
          etag: contactDirectoryEtag(file),
        }
      : { status: "missing" as const };

    return { applianceLocations, knownLocations, stationNotices, baMembers, contactDirectory };
  },
});

/** Marks a site's hub as alive after a full sync. Keeps the last build if none is sent. */
export const recordHubSync = internalMutation({
  args: { siteId: v.string(), buildId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { siteId, buildId }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("kioskHubStatus")
      .withIndex("by_siteId", (q) => q.eq("siteId", siteId))
      .first();
    if (existing) {
      await ctx.db.patch("kioskHubStatus", existing._id, {
        lastSyncAt: now,
        ...(buildId !== undefined ? { buildId } : {}),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("kioskHubStatus", {
        siteId,
        lastSyncAt: now,
        ...(buildId !== undefined ? { buildId } : {}),
        updatedAt: now,
      });
    }
    return null;
  },
});

/** The current contact book's blob and the metadata its ETag is built from. */
export const getContactDirectoryFile = internalQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
      uploadedAt: v.number(),
      sizeBytes: v.number(),
      contentType: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const file = await currentContactFile(ctx);
    if (!file) return null;
    const blob = await ctx.db.system.get("_storage", file.storageId);
    return {
      storageId: file.storageId,
      fileName: file.fileName,
      uploadedAt: file.uploadedAt,
      sizeBytes: file.sizeBytes,
      ...(blob?.contentType ? { contentType: blob.contentType } : {}),
    };
  },
});

/**
 * Move an appliance from a station tablet. Foyer tablets skip the member
 * rank/skill gate, as the PIN kiosk does today.
 *
 * The hub may flush this from an offline queue, so the write carries when the
 * tablet saw the move (`occurredAt`) and when the hub sent it (`sentAt`), both
 * on the hub's clock. `occurredAt + (serverNow - sentAt)` places the move on
 * BRAVO's clock without trusting the hub's to be right. If BRAVO already holds
 * a newer update (a phone moved the truck since), the stale write is dropped
 * and the newer row is returned.
 */
export const setApplianceLocation = internalMutation({
  args: {
    siteId: v.string(),
    applianceName: applianceNameValidator,
    stationLocation: v.string(),
    kioskDevice: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
  },
  returns: v.object({ applied: v.boolean(), applianceLocation: applianceLocationOut }),
  handler: async (ctx, args) => {
    const serverNow = Date.now();
    const effectiveOccurredAt =
      args.occurredAt !== undefined && args.sentAt !== undefined
        ? Math.min(serverNow, args.occurredAt + (serverNow - args.sentAt))
        : serverNow;

    const existing = await ctx.db
      .query("applianceLocations")
      .withIndex("by_applianceName", (q) => q.eq("applianceName", args.applianceName))
      .unique();
    if (existing && existing.updatedAt > effectiveOccurredAt) {
      return { applied: false, applianceLocation: toApplianceOut(existing) };
    }

    const fields = {
      stationLocation: args.stationLocation,
      updatedBySource: "kioskHub" as const,
      updatedByKioskSite: args.siteId,
      updatedByKioskDevice: args.kioskDevice,
      updatedAt: serverNow,
    };
    if (existing) {
      // Clear the previous writer so the attribution names only the hub.
      await ctx.db.patch("applianceLocations", existing._id, {
        ...fields,
        updatedBy: undefined,
        updatedByServiceAccount: undefined,
      });
    } else {
      await ctx.db.insert("applianceLocations", {
        applianceName: args.applianceName,
        ...fields,
      });
    }
    return {
      applied: true,
      applianceLocation: {
        applianceName: args.applianceName,
        stationLocation: args.stationLocation,
        updatedAt: serverNow,
      },
    };
  },
});

type BaOutcome =
  | { status: "created"; recordId: Id<"baRecords"> }
  | { status: "deduped"; recordId: Id<"baRecords"> }
  | { status: "conflict"; error: string }
  | { status: "invalid"; error: string };

async function eligibleMember(
  ctx: MutationCtx,
  rawId: string,
): Promise<Doc<"users"> | null> {
  const id = ctx.db.normalizeId("users", rawId);
  if (!id) return null;
  const user = await ctx.db.get("users", id);
  if (!user || !isMemberAccount(user)) return null;
  const skills = await skillCodesFor(ctx, user);
  return isBARecordMemberOption({ rank: user.rank, skills }) ? user : null;
}

/**
 * Log one member's BA use from a station tablet. The hub sends one call per
 * member, keyed by `clientRequestId`, and retries until it hears back, so the
 * key check sits in this mutation: Convex serialises two racing retries and
 * only one inserts.
 *
 * The verifier "owns" the record (`submittedBy`), as with the PIN kiosk, so
 * they can correct or delete it from their phone within the delete window.
 */
export const submitBaRecord = internalMutation({
  args: {
    siteId: v.string(),
    clientRequestId: v.string(),
    memberId: v.string(),
    verifiedBy: v.string(),
    dateUsed: v.string(),
    durationMinutes: v.number(),
    usageType: usageTypeValidator,
    notes: v.string(),
    kioskDevice: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      status: v.union(v.literal("created"), v.literal("deduped")),
      recordId: v.id("baRecords"),
    }),
    v.object({
      status: v.union(v.literal("conflict"), v.literal("invalid")),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<BaOutcome> => {
    const invalid = (error: string): BaOutcome => ({ status: "invalid", error });

    const clientRequestId = args.clientRequestId.trim();
    if (clientRequestId.length === 0 || clientRequestId.length > CLIENT_REQUEST_ID_MAX) {
      return invalid(`clientRequestId must be 1-${CLIENT_REQUEST_ID_MAX} characters`);
    }
    if (
      !Number.isInteger(args.durationMinutes) ||
      args.durationMinutes < 1 ||
      args.durationMinutes > BA_MAX_DURATION_MINUTES
    ) {
      return invalid(`durationMinutes must be a whole number from 1 to ${BA_MAX_DURATION_MINUTES}`);
    }
    const notes = args.notes.trim();
    if (notes.length === 0) return invalid("notes are required");
    if (notes.length > BA_NOTES_MAX) return invalid(`notes must be at most ${BA_NOTES_MAX} characters`);
    if (!isIsoCalendarDate(args.dateUsed)) return invalid("dateUsed must be a YYYY-MM-DD date");

    // A retry of a record already taken. Checked before eligibility and the
    // date window, so a retry still dedupes after a rank change or midnight.
    const existing = await ctx.db
      .query("baRecords")
      .withIndex("by_clientRequestId", (q) => q.eq("clientRequestId", clientRequestId))
      .first();
    if (existing) {
      const same =
        existing.memberId === args.memberId &&
        existing.verifiedBy === args.verifiedBy &&
        existing.dateUsed === args.dateUsed;
      return same
        ? { status: "deduped", recordId: existing._id }
        : { status: "conflict", error: "clientRequestId already used for a different BA record" };
    }

    if (args.memberId === args.verifiedBy) return invalid("Verifier must be a different member");
    const member = await eligibleMember(ctx, args.memberId);
    if (!member) return invalid("memberId is not an active BA-eligible member");
    const verifier = await eligibleMember(ctx, args.verifiedBy);
    if (!verifier) return invalid("verifiedBy is not an active BA-eligible member");

    // Melbourne civil dates compare correctly as strings.
    if (args.dateUsed > brigadeDateStr(0)) return invalid("dateUsed cannot be in the future");
    if (args.dateUsed < brigadeDateStr(-BA_MAX_AGE_DAYS)) {
      return invalid(`dateUsed cannot be more than ${BA_MAX_AGE_DAYS} days ago`);
    }

    const now = Date.now();
    const recordId = await ctx.db.insert("baRecords", {
      memberId: member._id,
      dateUsed: args.dateUsed,
      durationMinutes: args.durationMinutes,
      usageType: args.usageType,
      notes,
      verifiedBy: verifier._id,
      submittedBy: verifier._id,
      submittedOnBehalf: member._id !== verifier._id,
      submittedByKioskSite: args.siteId,
      ...(args.kioskDevice ? { submittedByKioskDevice: args.kioskDevice } : {}),
      clientRequestId,
      createdAt: now,
      updatedAt: now,
    });
    return { status: "created", recordId };
  },
});

/**
 * Upsert or clear a station notice from a foyer kiosk via kiosk-hub.
 * Uses the same skew-corrected timestamp conflict rule as setApplianceLocation:
 * if a member on their phone made a newer change while the hub was offline,
 * the stale kiosk write is dropped and BRAVO's authoritative row is returned.
 */
export const syncStationNotice = internalMutation({
  args: {
    siteId: v.string(),
    key: v.string(),
    active: v.boolean(),
    title: v.optional(v.string()),
    detail: v.optional(v.string()),
    severity: v.optional(stationNoticeSeverityValidator),
    count: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    kioskDevice: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      applied: v.boolean(),
      notice: stationNoticeSyncResultOut,
    }),
    v.object({
      status: v.literal("invalid"),
      error: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!NOTICE_KEY_RE.test(args.key)) {
      return { status: "invalid" as const, error: "Invalid notice key" };
    }
    const serverNow = Date.now();
    const effectiveOccurredAt =
      args.occurredAt !== undefined && args.sentAt !== undefined
        ? Math.min(serverNow, args.occurredAt + (serverNow - args.sentAt))
        : serverNow;

    let title = "";
    let detail: string | undefined;
    const severity = args.severity ?? "warning";
    if (args.active) {
      title = args.title?.trim() ?? "";
      if (title.length === 0 || title.length > NOTICE_TITLE_MAX) {
        return {
          status: "invalid" as const,
          error: `title must be 1-${NOTICE_TITLE_MAX} characters`,
        };
      }
      const trimmedDetail = args.detail?.trim() ?? "";
      if (trimmedDetail.length > NOTICE_DETAIL_MAX) {
        return {
          status: "invalid" as const,
          error: `detail must be at most ${NOTICE_DETAIL_MAX} characters`,
        };
      }
      detail = trimmedDetail.length > 0 ? trimmedDetail : undefined;
      if (
        args.count !== undefined &&
        (!Number.isInteger(args.count) || args.count < 0 || args.count > NOTICE_MAX_COUNT)
      ) {
        return {
          status: "invalid" as const,
          error: `count must be a whole number from 0 to ${NOTICE_MAX_COUNT}`,
        };
      }
      if (args.expiresAt !== undefined && (!Number.isFinite(args.expiresAt) || args.expiresAt <= serverNow)) {
        return { status: "invalid" as const, error: "expiresAt must be in the future" };
      }
    }

    const existing = await ctx.db
      .query("stationNotices")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing && existing.updatedAt > effectiveOccurredAt) {
      const expired = existing.expiresAt !== undefined && existing.expiresAt <= serverNow;
      const out = await toNoticeOut(ctx, existing);
      return {
        status: "ok" as const,
        applied: false,
        notice: { ...out, active: existing.active && !expired },
      };
    }

    const wasActive =
      existing !== null &&
      existing.active &&
      (existing.expiresAt === undefined || existing.expiresAt > serverNow);
    const createdAt = args.active && wasActive && existing ? existing.createdAt : serverNow;
    const resolvedTitle = args.active ? title : (existing?.title ?? args.key);

    const fields = {
      title: resolvedTitle,
      detail: args.active ? detail : undefined,
      severity: args.active ? severity : (existing?.severity ?? ("warning" as const)),
      count: args.active ? args.count : undefined,
      active: args.active,
      updatedBy: undefined,
      updatedBySource: "kioskHub" as const,
      updatedByKioskSite: args.siteId,
      updatedByKioskDevice: args.kioskDevice,
      createdAt,
      updatedAt: serverNow,
      expiresAt: args.active ? args.expiresAt : undefined,
    };

    if (existing) {
      await ctx.db.patch("stationNotices", existing._id, fields);
    } else {
      await ctx.db.insert("stationNotices", {
        key: args.key,
        ...fields,
      });
    }

    return {
      status: "ok" as const,
      applied: true,
      notice: {
        key: args.key,
        active: args.active,
        title: resolvedTitle,
        ...(args.active && detail !== undefined ? { detail } : {}),
        severity: fields.severity,
        ...(args.active && args.count !== undefined ? { count: args.count } : {}),
        source: "kiosk-hub",
        ...(args.kioskDevice !== undefined
          ? { updatedBy: args.kioskDevice }
          : { updatedBy: `Station Kiosk (${args.siteId})` }),
        createdAt,
        updatedAt: serverNow,
        ...(args.active && args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
      },
    };
  },
});
