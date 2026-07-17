import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
  internalQuery,
  query,
  env,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { fetchCalendarData } from "./calendarProxy";

// Calendar reads and CalDAV writes are authenticated Convex actions, so the
// browser never sees Radicale or its credentials. Read and write access use
// separate module settings so administrators can manage them independently.

// ─── Event payload validators ────────────────────────────────────────────────

const whenValidator = v.union(
  v.object({
    kind: v.literal("timed"),
    /** ms since epoch */
    start: v.number(),
    end: v.number(),
  }),
  v.object({
    kind: v.literal("allDay"),
    /** yyyy-MM-dd */
    startDate: v.string(),
    /** yyyy-MM-dd, exclusive per RFC 5545 DTEND;VALUE=DATE */
    endDateExclusive: v.string(),
  }),
);

const eventFields = {
  summary: v.string(),
  location: v.optional(v.string()),
  description: v.optional(v.string()),
  when: whenValidator,
};

type EventWhen =
  | { kind: "timed"; start: number; end: number }
  | { kind: "allDay"; startDate: string; endDateExclusive: string };

export interface EventInput {
  summary: string;
  location?: string;
  description?: string;
  when: EventWhen;
}

// ─── iCalendar serialization (pure, unit-tested) ────────────────────────────

/** Escape text per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatUtcDateTime(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function formatDateOnly(isoDate: string): string {
  if (!DATE_ONLY_RE.test(isoDate)) {
    throw new Error(`Invalid all-day date: ${isoDate}`);
  }
  return isoDate.replace(/-/g, "");
}

/** Build a complete single-VEVENT VCALENDAR payload for a CalDAV PUT. */
export function buildVEventCalendar(
  uid: string,
  input: EventInput,
  now: Date = new Date(),
): string {
  const summary = input.summary.trim();
  if (!summary) throw new Error("Event title is required");

  let dtstart: string;
  let dtend: string;
  if (input.when.kind === "timed") {
    if (input.when.end <= input.when.start) {
      throw new Error("Event end must be after its start");
    }
    dtstart = `DTSTART:${formatUtcDateTime(input.when.start)}`;
    dtend = `DTEND:${formatUtcDateTime(input.when.end)}`;
  } else {
    const start = formatDateOnly(input.when.startDate);
    const end = formatDateOnly(input.when.endDateExclusive);
    if (end <= start) {
      throw new Error("Event end must be after its start");
    }
    dtstart = `DTSTART;VALUE=DATE:${start}`;
    dtend = `DTEND;VALUE=DATE:${end}`;
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BRAVO//Brigade Calendar//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatUtcDateTime(now.getTime())}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeIcsText(summary)}`,
  ];
  if (input.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(input.location.trim())}`);
  }
  if (input.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(input.description.trim())}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

// ─── CalDAV resource discovery (pure parser, unit-tested) ───────────────────

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Pull the first .ics resource (href + etag) out of a CalDAV REPORT
 * multistatus response. Regex-based on purpose: the Convex runtime has no
 * XML parser, and Radicale's namespaced output is stable enough for this.
 */
export function findEventResource(
  multistatusXml: string,
): { href: string; etag: string | null } | null {
  const blocks =
    multistatusXml.match(
      /<(?:\w+:)?response(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?response>/gi,
    ) ?? [];
  for (const block of blocks) {
    const href = block.match(/<(?:\w+:)?href(?:\s[^>]*)?>([^<]+)<\/(?:\w+:)?href>/i)?.[1];
    if (!href || !decodeXmlEntities(href.trim()).endsWith(".ics")) continue;
    const etag = block.match(
      /<(?:\w+:)?getetag(?:\s[^>]*)?>([^<]+)<\/(?:\w+:)?getetag>/i,
    )?.[1];
    return {
      href: decodeXmlEntities(href.trim()),
      etag: etag ? decodeXmlEntities(etag.trim()) : null,
    };
  }
  return null;
}

// ─── Radicale requests ───────────────────────────────────────────────────────

function caldavAuthHeader(): string {
  return `Basic ${btoa(`${env.CALDAV_USERNAME}:${env.CALDAV_PASSWORD}`)}`;
}

function collectionUrl(): string {
  const url = env.CALDAV_URL;
  return url.endsWith("/") ? url : `${url}/`;
}

async function locateEventByUid(
  uid: string,
): Promise<{ url: string; etag: string | null }> {
  const reportBody = [
    '<?xml version="1.0" encoding="utf-8" ?>',
    '<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">',
    "<D:prop><D:getetag/></D:prop>",
    "<C:filter>",
    '<C:comp-filter name="VCALENDAR">',
    '<C:comp-filter name="VEVENT">',
    '<C:prop-filter name="UID">',
    `<C:text-match collation="i;octet">${uid
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</C:text-match>`,
    "</C:prop-filter>",
    "</C:comp-filter>",
    "</C:comp-filter>",
    "</C:filter>",
    "</C:calendar-query>",
  ].join("");

  const response = await fetch(collectionUrl(), {
    method: "REPORT",
    headers: {
      Authorization: caldavAuthHeader(),
      "Content-Type": "application/xml; charset=utf-8",
      Depth: "1",
      "User-Agent": "Brigade-Management-System/1.0",
    },
    body: reportBody,
  });
  if (!response.ok) {
    throw new Error(`Calendar lookup failed with ${response.status}`);
  }

  const resource = findEventResource(await response.text());
  if (!resource) {
    throw new Error("Event not found in the calendar. It may have been deleted.");
  }
  return {
    url: new URL(resource.href, collectionUrl()).toString(),
    etag: resource.etag,
  };
}

async function putEvent(
  url: string,
  ics: string,
  precondition: { ifMatch?: string | null; ifNoneMatch?: string },
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: caldavAuthHeader(),
    "Content-Type": "text/calendar; charset=utf-8",
    "User-Agent": "Brigade-Management-System/1.0",
  };
  if (precondition.ifNoneMatch) headers["If-None-Match"] = precondition.ifNoneMatch;
  if (precondition.ifMatch) headers["If-Match"] = precondition.ifMatch;

  const response = await fetch(url, { method: "PUT", headers, body: ics });
  if (response.status === 412) {
    throw new Error(
      "The event changed in another calendar app. Refresh and try again.",
    );
  }
  if (!response.ok) {
    throw new Error(`Calendar server rejected the event (${response.status})`);
  }
}

// ─── Access control ──────────────────────────────────────────────────────────

async function requireCalendarAccess(
  ctx: QueryCtx,
  moduleId: "calendar" | "calendarWrite",
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  if (user.isAdmin) return;

  const moduleSetting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
    .unique();

  const deniedMessage =
    moduleId === "calendar"
      ? "You do not have access to view the calendar"
      : "You do not have access to modify the calendar";

  if (!moduleSetting?.isEnabled || moduleSetting.adminOnly) {
    throw new Error(deniedMessage);
  }

  const requiredRoles = moduleSetting.requiredRoles ?? [];
  const hasRequiredRole =
    requiredRoles.length === 0 ||
    requiredRoles.some((role) => user.roles?.includes(role));

  const rankOrder = {
    Probationary: 1,
    Firefighter: 2,
    Lieutenant: 3,
    Captain: 4,
  } as const;
  const hasRequiredRank = moduleSetting.minimumRank
    ? user.rank !== undefined &&
      rankOrder[user.rank] >= rankOrder[moduleSetting.minimumRank]
    : true;

  if (!hasRequiredRole || !hasRequiredRank) {
    throw new Error(deniedMessage);
  }
}

export const assertReadAccess = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireCalendarAccess(ctx, "calendar");
    return null;
  },
});

export const assertWriteAccess = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireCalendarAccess(ctx, "calendarWrite");
    return null;
  },
});

/** UI gate for showing add/edit/delete controls on the Calendar page. */
export const canWriteCalendar = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    try {
      await requireCalendarAccess(ctx, "calendarWrite");
      return true;
    } catch {
      return false;
    }
  },
});

/** Authenticated calendar feed used by both the dashboard and Calendar page. */
export const getCalendarEvents = action({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    const _access: null = await ctx.runQuery(
      internal.calendarWrite.assertReadAccess,
      {},
    );
    return await fetchCalendarData({
      calendarUrl: env.CALDAV_URL,
      username: env.CALDAV_USERNAME,
      password: env.CALDAV_PASSWORD,
    });
  },
});

// ─── Public actions ──────────────────────────────────────────────────────────

export const createEvent = action({
  args: eventFields,
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const _access: null = await ctx.runQuery(
      internal.calendarWrite.assertWriteAccess,
      {},
    );
    const uid = `bravo-${crypto.randomUUID()}`;
    const ics = buildVEventCalendar(uid, args);
    // If-None-Match: * — never overwrite an existing resource on create
    await putEvent(`${collectionUrl()}${uid}.ics`, ics, { ifNoneMatch: "*" });
    return uid;
  },
});

export const updateEvent = action({
  args: { uid: v.string(), ...eventFields },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const _access: null = await ctx.runQuery(
      internal.calendarWrite.assertWriteAccess,
      {},
    );
    const { uid, ...input } = args;
    const { url, etag } = await locateEventByUid(uid);
    const ics = buildVEventCalendar(uid, input);
    await putEvent(url, ics, { ifMatch: etag });
    return null;
  },
});

export const deleteEvent = action({
  args: { uid: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const _access: null = await ctx.runQuery(
      internal.calendarWrite.assertWriteAccess,
      {},
    );
    const { url, etag } = await locateEventByUid(args.uid);
    const headers: Record<string, string> = {
      Authorization: caldavAuthHeader(),
      "User-Agent": "Brigade-Management-System/1.0",
    };
    if (etag) headers["If-Match"] = etag;

    const response = await fetch(url, { method: "DELETE", headers });
    if (response.status === 412) {
      throw new Error(
        "The event changed in another calendar app. Refresh and try again.",
      );
    }
    if (!response.ok && response.status !== 404) {
      throw new Error(`Calendar server rejected the delete (${response.status})`);
    }
    return null;
  },
});
