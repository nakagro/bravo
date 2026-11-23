import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import type { StatusTone } from "@/lib/statusTone";
import { formatDate } from "@/lib/dateFormat";

export type Dashboard = FunctionReturnType<typeof api.accessControl.getDashboard>;
export type Site = Dashboard["sites"][number];
export type Area = Site["areas"][number];
export type Door = Site["doors"][number];
export type AccessEvent = Dashboard["events"][number];
export type Command = Dashboard["recentCommands"][number];
export type CommandAction = Command["action"];
export type TargetKind = Command["targetKind"];
export type AreaStatus = Area["status"];
export type DoorStatus = Door["status"];

/** Matches ACCESS_STALE_AFTER_MS in convex/lib/accessControlValidators.ts. */
export const STALE_AFTER_MS = 2 * 60 * 1000;

export const AREA_LABEL: Record<AreaStatus, { label: string; tone: StatusTone }> = {
  armed: { label: "Armed", tone: "success" },
  disarmed: { label: "Disarmed", tone: "warning" },
  alarm: { label: "Alarm", tone: "danger" },
  exitDelay: { label: "Arming", tone: "info" },
  entryDelay: { label: "Entry delay", tone: "danger" },
};

export const DOOR_LABEL: Record<DoorStatus, { label: string; tone: StatusTone }> = {
  secured: { label: "Secured", tone: "neutral" },
  unlocked: { label: "Unlocked", tone: "warning" },
  open: { label: "Open", tone: "info" },
  heldOpen: { label: "Held open", tone: "danger" },
  forced: { label: "Forced", tone: "danger" },
  offline: { label: "No signal", tone: "warning" },
};

/** "just now", "4 min ago", "3 h ago", "2 d ago", then a date. */
export function ago(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return formatDate(ms);
}

export function isStale(site: Site, now: number): boolean {
  return now - site.lastSeenAt > STALE_AFTER_MS;
}

/**
 * Why a station's controls can't be used right now, most important first, or
 * null when they can. One line, in members' words.
 */
export function unavailableReason(site: Site, now: number): string | null {
  if (isStale(site, now)) {
    const m = Math.round((now - site.lastSeenAt) / 60_000);
    const gap = m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`;
    return `No contact with the station for ${gap}`;
  }
  if (site.bravoWritesDisabled) {
    return site.bravoWritesDisabledReason === "allSites"
      ? "Remote control is switched off in BRAVO for all stations"
      : "Remote control is switched off in BRAVO for this station";
  }
  if (!site.controlsEnabled) return "Remote control is off for this station";
  if (!site.writesEnabled) return "This station is view only";
  return null;
}

export interface SiteSummary {
  label: string;
  tone: StatusTone;
  kind: "alarm" | "armed" | "partly" | "disarmed" | "arming" | "none";
}

/** One word for the whole station. Alarm wins over everything. */
export function siteSummary(site: Site): SiteSummary {
  const areas = site.areas;
  if (areas.length === 0) return { label: "Connected", tone: "neutral", kind: "none" };
  if (areas.some((a) => a.status === "alarm" || a.status === "entryDelay")) {
    return { label: "Alarm", tone: "danger", kind: "alarm" };
  }
  if (areas.some((a) => a.status === "exitDelay")) return { label: "Arming", tone: "info", kind: "arming" };
  const armed = areas.filter((a) => a.status === "armed").length;
  if (armed === areas.length) return { label: "Armed", tone: "success", kind: "armed" };
  if (armed === 0) return { label: "Disarmed", tone: "warning", kind: "disarmed" };
  return { label: "Partly armed", tone: "warning", kind: "partly" };
}

/** The area that changed most recently, for "by X, 12 min ago" under the status. */
export function latestAreaChange(site: Site): Area | null {
  let latest: Area | null = null;
  for (const a of site.areas) if (!latest || a.changedAt > latest.changedAt) latest = a;
  return latest;
}

/** Something at a station that needs eyes on it now, shown at the top whichever station is open. */
export interface Attention {
  siteId: string;
  text: string;
}

export function attentionItems(sites: Site[]): Attention[] {
  const items: Attention[] = [];
  for (const site of sites) {
    for (const a of site.areas) {
      if (a.status === "alarm") items.push({ siteId: site.id, text: `Alarm at ${site.name}: ${a.name}` });
    }
    for (const d of site.doors) {
      if (d.status === "forced") items.push({ siteId: site.id, text: `${d.name} forced at ${site.name}` });
      if (d.status === "heldOpen") items.push({ siteId: site.id, text: `${d.name} held open at ${site.name}` });
    }
  }
  return items;
}

/**
 * Doors the member can act on get tiles. The rest fold into one line, except
 * any that aren't secured, which stay visible so nothing unusual is hidden.
 */
export function splitDoors(site: Site) {
  const controllable = site.doors.filter((d) => d.canControl);
  const others = site.doors.filter((d) => !d.canControl);
  return {
    controllable,
    notable: others.filter((d) => d.status !== "secured"),
    quiet: others.filter((d) => d.status === "secured"),
  };
}

/**
 * The station's only alarm area, when there is exactly one and it is armed.
 * Unlocking a door there won't disarm it, so the page offers Disarm and unlock.
 * With several areas we can't tell which one covers a door, so no prompt.
 */
export function soleArmedArea(site: Site): Area | null {
  if (site.areas.length !== 1) return null;
  const area = site.areas[0];
  return area.status === "armed" ? area : null;
}

/** Doors that aren't closed and secured, named in the Arm prompt. */
export function openDoors(site: Site): Door[] {
  return site.doors.filter((d) => d.status === "open" || d.status === "heldOpen" || d.status === "forced");
}

export interface ActivityItem {
  id: string;
  at: number;
  text: string;
  who?: string;
  /** A BRAVO unlock that the panel locked again by itself shortly after. */
  relocked?: boolean;
}

const RELOCK_WINDOW_MS = 30_000;
const DUPLICATE_WINDOW_MS = 10_000;

function targetIn(text: string, names: string[]): string | null {
  const lower = text.toLowerCase();
  return names.find((n) => lower.includes(n.toLowerCase())) ?? null;
}

const isLockText = (text: string) => /\block(ed)?\b/i.test(text) && !/unlock/i.test(text);

/**
 * One line per thing that happened. A BRAVO command shows up twice (BRAVO's own
 * line and the panel's), and a door unlock is followed by the panel's automatic
 * relock: fold both into the BRAVO line, which carries the member's name.
 */
export function mergeActivity(events: AccessEvent[], site: Pick<Site, "doors" | "areas">): ActivityItem[] {
  const names = [...site.doors, ...site.areas].map((t) => t.name).sort((a, b) => b.length - a.length);
  const sorted = [...events].sort((a, b) => b.at - a.at);
  const hidden = new Set<string>();
  const relocked = new Set<string>();

  for (const ev of sorted) {
    if (ev.source !== "bravo") continue;
    const target = targetIn(ev.text, names);
    if (!target) continue;
    for (const other of sorted) {
      if (other.source !== "panel" || hidden.has(other.id)) continue;
      if (targetIn(other.text, names) !== target) continue;
      const delta = other.at - ev.at;
      if (Math.abs(delta) <= DUPLICATE_WINDOW_MS && !isLockText(other.text)) {
        hidden.add(other.id);
      } else if (delta > 0 && delta <= RELOCK_WINDOW_MS && isLockText(other.text)) {
        hidden.add(other.id);
        relocked.add(ev.id);
      }
    }
  }

  return sorted
    .filter((ev) => !hidden.has(ev.id))
    .map((ev) => ({
      id: ev.id,
      at: ev.at,
      text: ev.text,
      who: ev.who,
      relocked: relocked.has(ev.id) || undefined,
    }));
}

/** Plain words for a command that didn't go through. */
export function commandFailureText(cmd: Pick<Command, "status" | "message">): string {
  if (cmd.status === "expired") return "The station didn't respond in time. Nothing was done.";
  return cmd.message || "The station couldn't do it.";
}
