// Mock data for the Access Control screen. Nothing here talks to a panel.
// The real feed will come from a LAN bridge (Inception at the main station,
// the local Challenger+ service at the satellite) posting normalised state
// into Convex. This file is the shape that bridge should produce.

export type PanelKind = "inception" | "challenger";

export type AreaStatus = "armed" | "disarmed" | "alarm" | "exitDelay" | "entryDelay";
export type DoorStatus = "secured" | "unlocked" | "open" | "heldOpen" | "forced" | "offline";

export interface AccessArea {
  id: string;
  name: string;
  status: AreaStatus;
  changedAt: number;
  changedBy?: string;
}

export interface AccessDoor {
  id: string;
  name: string;
  status: DoorStatus;
  changedAt: number;
  /** Mock permission: whether the signed-in member may operate this door. */
  canControl: boolean;
}

export interface AccessSite {
  id: string;
  name: string;
  panel: PanelKind;
  panelLabel: string;
  /** When the bridge last reported in. Old values show the site as stale. */
  lastSeenAt: number;
  areas: AccessArea[];
  doors: AccessDoor[];
}

export interface AccessEvent {
  id: string;
  siteId: string;
  at: number;
  text: string;
  who?: string;
}

const min = 60_000;

export function buildMockSites(now = Date.now()): AccessSite[] {
  return [
    {
      id: "main",
      name: "Main Station",
      panel: "inception",
      panelLabel: "Inner Range Inception",
      lastSeenAt: now - 8_000,
      areas: [
        { id: "main-station", name: "Station", status: "disarmed", changedAt: now - 42 * min, changedBy: "Alex Carter" },
        { id: "main-shed", name: "Shed", status: "armed", changedAt: now - 5 * 60 * min },
        { id: "main-office", name: "Office", status: "armed", changedAt: now - 26 * 60 * min },
      ],
      doors: [
        { id: "main-gate", name: "Front Gate", status: "secured", changedAt: now - 42 * min, canControl: true },
        { id: "main-turnout", name: "Turnout Room", status: "secured", changedAt: now - 40 * min, canControl: true },
        { id: "main-shed-door", name: "Shed Door", status: "secured", changedAt: now - 5 * 60 * min, canControl: true },
        { id: "main-office-door", name: "Office", status: "secured", changedAt: now - 26 * 60 * min, canControl: false },
        { id: "main-bay", name: "Bay Side Door", status: "open", changedAt: now - 3 * min, canControl: true },
      ],
    },
    {
      id: "satellite",
      name: "Satellite Station",
      panel: "challenger",
      panelLabel: "Tecom Challenger+",
      lastSeenAt: now - 4 * min,
      areas: [
        { id: "sat-station", name: "Station", status: "armed", changedAt: now - 3 * 24 * 60 * min, changedBy: "Jordan Lee" },
      ],
      doors: [
        { id: "sat-front", name: "Front Door", status: "secured", changedAt: now - 3 * 24 * 60 * min, canControl: true },
        { id: "sat-roller", name: "Roller Door", status: "secured", changedAt: now - 3 * 24 * 60 * min, canControl: false },
      ],
    },
  ];
}

export function buildMockEvents(now = Date.now()): AccessEvent[] {
  return [
    { id: "e1", siteId: "main", at: now - 3 * min, text: "Bay Side Door opened" },
    { id: "e2", siteId: "main", at: now - 40 * min, text: "Turnout Room unlocked for 5 s", who: "Alex Carter" },
    { id: "e3", siteId: "main", at: now - 42 * min, text: "Station disarmed", who: "Alex Carter" },
    { id: "e4", siteId: "main", at: now - 5 * 60 * min, text: "Shed armed", who: "Sam Nguyen" },
    { id: "e5", siteId: "satellite", at: now - 3 * 24 * 60 * min, text: "Station armed", who: "Jordan Lee" },
  ];
}

/** A site is stale when its bridge has not reported for this long. */
export const STALE_AFTER_MS = 2 * min;

/** How long a "pulse" unlock holds the door before it relocks. */
export const PULSE_MS = 5_000;
