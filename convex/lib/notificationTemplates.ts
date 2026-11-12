// Message templates for targeted notifications (assignment and event change
// notices). Pure: no Convex imports, so the admin editor renders its live
// preview with exactly this code on the client.
//
// The defaults below are what members receive until a global admin edits a
// template. The live text is in the `notificationTemplates` table (one row per
// edited key, absent = default), and Admin → Notification Settings shows both.

export const TITLE_TEMPLATE_MAX = 120;
export const BODY_TEMPLATE_MAX = 400;
export const TITLE_RENDER_MAX = 65;
export const BODY_RENDER_MAX = 240;
/** Fits inside the rendered body with the default templates. */
export const NOTE_MAX = 140;

export type Placeholder =
  | "firstName"
  | "assignment"
  | "date"
  | "message"
  | "sender"
  | "eventTitle"
  | "time"
  | "location";

export const PLACEHOLDER_HELP: Record<Placeholder, string> = {
  firstName: "Member's first name",
  assignment: "Everything they hold, e.g. Driver · Tanker 1",
  date: "The date, e.g. Sat 14 Dec",
  message: "The sender's optional note",
  sender: "Who sent it",
  eventTitle: "The event's title",
  time: "Event start time (blank for all-day or shift-only)",
  location: "Event location",
};

const EVENT_ASSIGNMENT: Placeholder[] = [
  "firstName",
  "assignment",
  "date",
  "message",
  "sender",
  "eventTitle",
  "time",
  "location",
];
const DEPLOYMENT_ASSIGNMENT: Placeholder[] = ["firstName", "assignment", "date", "message", "sender"];
// Same text for every recipient, so nothing per-member.
const EVENT_CHANGE: Placeholder[] = ["date", "message", "sender", "eventTitle", "time", "location"];

export type TemplateGroup = "Events" | "Deployment crews" | "Event changes";

export type TemplateDef = {
  label: string;
  description: string;
  group: TemplateGroup;
  placeholders: Placeholder[];
  title: string;
  body: string;
  sample: Partial<Record<Placeholder, string>>;
};

const EVENT_SAMPLE = {
  firstName: "Jane",
  assignment: "Driver · Tanker 1",
  date: "Sat 14 Dec",
  message: "Bring hi-vis.",
  sender: "Shaun Gordon",
  eventTitle: "Open day",
  time: "9:00 AM",
  location: "Main Station",
};
const DEPLOYMENT_SAMPLE = {
  firstName: "Jane",
  assignment: "Driver · Tanker 1",
  date: "Sat 14 Dec",
  message: "Meet at the station 0600.",
  sender: "Shaun Gordon",
};

export const NOTIFICATION_TEMPLATES = {
  "event.assigned": {
    label: "Rostered or crewed",
    description: "A member is new to this event's crew or roster (or is reminded with \"Everyone\").",
    group: "Events",
    placeholders: EVENT_ASSIGNMENT,
    title: "You're rostered: {eventTitle}",
    body: "{assignment} · {date} {time} · {location}\n{message}",
    sample: EVENT_SAMPLE,
  },
  "event.updated": {
    label: "Roster changed",
    description: "A member's seat or shift changed since their last notice.",
    group: "Events",
    placeholders: EVENT_ASSIGNMENT,
    title: "Roster changed: {eventTitle}",
    body: "Now: {assignment} · {date} · {location}\n{message}",
    sample: EVENT_SAMPLE,
  },
  "event.removed": {
    label: "Taken off the roster",
    description: "A member was told before and now holds nothing on the event.",
    group: "Events",
    placeholders: EVENT_ASSIGNMENT,
    title: "Off the roster: {eventTitle}",
    body: "You're no longer rostered for {eventTitle} on {date}.\n{message}",
    sample: EVENT_SAMPLE,
  },
  "deployment.assigned": {
    label: "Crewed for a deployment",
    description: "A member is new to that day's deployment crews.",
    group: "Deployment crews",
    placeholders: DEPLOYMENT_ASSIGNMENT,
    title: "Deployment crew: {date}",
    body: "{assignment}. Tap to see the full crew.\n{message}",
    sample: DEPLOYMENT_SAMPLE,
  },
  "deployment.updated": {
    label: "Deployment crew changed",
    description: "A member's seat changed since their last notice.",
    group: "Deployment crews",
    placeholders: DEPLOYMENT_ASSIGNMENT,
    title: "Deployment crew changed: {date}",
    body: "Now: {assignment}. Tap to see the full crew.\n{message}",
    sample: DEPLOYMENT_SAMPLE,
  },
  "deployment.removed": {
    label: "Taken off a deployment",
    description: "A member was told before and is now off every crew that day.",
    group: "Deployment crews",
    placeholders: DEPLOYMENT_ASSIGNMENT,
    title: "Deployment crew: {date}",
    body: "You're no longer crewed for {date}.\n{message}",
    sample: DEPLOYMENT_SAMPLE,
  },
  "event.cancelled": {
    label: "Event cancelled",
    description: "Sent to everyone involved when the event is cancelled. {message} is the reason.",
    group: "Event changes",
    placeholders: EVENT_CHANGE,
    title: "Cancelled: {eventTitle}",
    body: "{date} {time} · {location}\n{message}",
    sample: { ...EVENT_SAMPLE, message: "Hall double-booked." },
  },
  "event.detailsChanged": {
    label: "Date, time or place changed",
    description: "Sent to everyone involved after the date, time or location is edited.",
    group: "Event changes",
    placeholders: EVENT_CHANGE,
    title: "Changed: {eventTitle}",
    body: "Now {date} {time} · {location}\n{message}",
    sample: { ...EVENT_SAMPLE, date: "Sun 15 Dec", message: "" },
  },
  "event.message": {
    label: "Message about an event",
    description: "A message the organiser sends from the event page, to the people involved or all members.",
    group: "Event changes",
    placeholders: EVENT_CHANGE,
    title: "{eventTitle}",
    body: "{message}\n{date} {time} · {location}",
    sample: { ...EVENT_SAMPLE, message: "Meet at the front gate, bring water." },
  },
  "event.restored": {
    label: "Event back on",
    description: "Sent to the members told of a cancellation when the event is restored.",
    group: "Event changes",
    placeholders: EVENT_CHANGE,
    title: "Back on: {eventTitle}",
    body: "{date} {time} · {location}\n{message}",
    sample: { ...EVENT_SAMPLE, message: "" },
  },
} satisfies Record<string, TemplateDef>;

export type TemplateKey = keyof typeof NOTIFICATION_TEMPLATES;
export const TEMPLATE_KEYS = Object.keys(NOTIFICATION_TEMPLATES) as TemplateKey[];

export function isTemplateKey(key: string): key is TemplateKey {
  return key in NOTIFICATION_TEMPLATES;
}

export type TemplateText = { title: string; body: string };

/** Stored row (if any) over the default. An empty stored field means "use the default". */
export function effectiveTemplate(key: TemplateKey, stored?: TemplateText | null): TemplateText {
  const def = NOTIFICATION_TEMPLATES[key];
  return {
    title: stored?.title.trim() ? stored.title : def.title,
    body: stored?.body.trim() ? stored.body : def.body,
  };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function substitute(template: string, values: Record<string, string | undefined>): string {
  // `{{` is a literal brace; anything else in braces is a placeholder.
  return template.replace(/\{\{|\{([A-Za-z]+)\}/g, (match, name?: string) => {
    if (match === "{{") return "{";
    return values[name!] ?? "";
  });
}

/**
 * Drops the pieces an empty value leaves behind: a " · " or ", " at either end
 * of the line or next to another separator, and doubled spaces.
 */
function tidyLine(line: string): string {
  const parts = line.split(/(\s*·\s*|,\s+)/);
  let out = "";
  for (let i = 0; i < parts.length; i += 2) {
    const segment = parts[i].replace(/\s+/g, " ").trim();
    if (!segment) continue;
    const sep = i > 0 ? (parts[i - 1].includes("·") ? " · " : ", ") : "";
    out += out ? sep + segment : segment;
  }
  return out;
}

function tidy(text: string): string {
  return text
    .split("\n")
    .map(tidyLine)
    .filter((line) => line.length > 0)
    .join("\n");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/** Fill a template and apply the tidy-up and length caps. What this returns is what is sent. */
export function renderTemplate(
  template: TemplateText,
  values: Record<string, string | undefined>,
): TemplateText {
  return {
    title: truncate(tidy(substitute(template.title, values)).replace(/\n/g, " "), TITLE_RENDER_MAX),
    body: truncate(tidy(substitute(template.body, values)), BODY_RENDER_MAX),
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function placeholdersIn(text: string): string[] {
  const found: string[] = [];
  text.replace(/\{\{|\{([^{}]*)\}/g, (match, name?: string) => {
    if (match !== "{{") found.push(name ?? "");
    return match;
  });
  return found;
}

/** Null when the text is valid for the key, otherwise a message naming the problem. */
export function validateTemplate(key: TemplateKey, text: TemplateText): string | null {
  if (text.title.length > TITLE_TEMPLATE_MAX) {
    return `The title must be ${TITLE_TEMPLATE_MAX} characters or fewer`;
  }
  if (text.body.length > BODY_TEMPLATE_MAX) {
    return `The body must be ${BODY_TEMPLATE_MAX} characters or fewer`;
  }
  const allowed = new Set<string>(NOTIFICATION_TEMPLATES[key].placeholders);
  const all = new Set<string>(Object.keys(PLACEHOLDER_HELP));
  for (const name of [...placeholdersIn(text.title), ...placeholdersIn(text.body)]) {
    if (!all.has(name)) return `Unknown placeholder {${name}}`;
    if (!allowed.has(name)) return `{${name}} can't be used in this message`;
  }
  return null;
}

// ─── Value formatting (shared by the adapters) ──────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "2026-12-14" → "Sat 14 Dec". Calendar dates, so read as UTC on purpose. */
export function formatDay(iso: string): string {
  const date = parseIsoDate(iso);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** UTC-midnight timestamp (deploymentCrews.date) → "Sat 14 Dec". */
export function formatDayMs(ms: number): string {
  return formatDay(new Date(ms).toISOString().slice(0, 10));
}

/** "Sat 14 Dec", or "Sat 14 – Sun 15 Dec" / "Sat 30 Nov – Sun 1 Dec" across days. */
export function formatDateRange(start: string, end?: string): string {
  if (!end || end === start) return formatDay(start);
  const a = parseIsoDate(start);
  const b = parseIsoDate(end);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
  const left = sameMonth ? `${WEEKDAYS[a.getUTCDay()]} ${a.getUTCDate()}` : formatDay(start);
  return `${left} – ${formatDay(end)}`;
}

/** "14:30" → "2:30 PM". */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

/** Joins what a member holds: "Driver · Tanker 1 and Shift 2 (10:00–12:00)". */
export function joinAssignment(lines: string[]): string {
  if (lines.length <= 1) return lines[0] ?? "";
  return `${lines.slice(0, -1).join(", ")} and ${lines[lines.length - 1]}`;
}

/** Order-insensitive equality of two assignment line lists. */
export function sameLines(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((line, i) => line === sb[i]);
}

/**
 * Staleness check for the confirm-then-send step: a plain string hash (FNV-1a)
 * that runs in the default Convex runtime. Not a security control.
 */
export function fingerprintOf(parts: string[]): string {
  let hash = 0x811c9dc5;
  const text = parts.join("\u0001");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16) + ":" + text.length.toString(16);
}
