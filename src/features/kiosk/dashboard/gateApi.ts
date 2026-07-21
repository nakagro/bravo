// Station (wvfb-api) access layer for the kiosk dashboard.
//
// This talks to the LOCAL node API (`wvfb-api` at 192.0.2.10:3000, proxied as
// /gate-api), NOT Convex — door/area control must stay on the local network for
// security. Single source of truth for door + area state interpretation and the
// control/scene endpoints, shared by every dashboard widget and modal.

import {
  Lock, LockOpen, DoorOpen, ShieldAlert, Siren, Clock, Ban,
  AlertTriangle, WifiOff, type LucideIcon,
} from 'lucide-react';
import * as mock from './mockStation';

// ── Config ────────────────────────────────────────────────────────────────────

// When proxied through the BRAVO server: set VITE_GATE_API_BASE=/gate-api (key
// injected by nginx). Direct local access: VITE_GATE_API_BASE=http://192.0.2.10:3000
export const GATE_API_BASE = import.meta.env.VITE_GATE_API_BASE ?? '/gate-api';
export const API_KEY       = import.meta.env.VITE_GATE_API_KEY ?? '';
export const POLL_INTERVAL_MS = 5000;

// Dev mock: the real endpoints are unreachable off the station LAN, so the dev
// server swaps in an in-memory simulation (see mockStation.ts). Auto-on in dev,
// never in production. Force real in dev with VITE_GATE_MOCK=false; force mock
// anywhere with VITE_GATE_MOCK=true. In a production build this folds to a
// constant `false`, so the mock is tree-shaken out entirely.
const USE_MOCK =
  import.meta.env.VITE_GATE_MOCK === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_GATE_MOCK !== 'false');

export const GATE_DOOR_ID    = 'c03e570f-4003-4b24-91d1-fcb216734785';
export const TURNOUT_DOOR_ID  = 'a0637546-f427-49d1-83ab-db78ada81e09';
export const SHED_DOOR_ID     = '1c1b20b3-df08-4e83-8554-aee064cfa6bc';
export const SHED_AREA_ID     = 'a03cba71-5d8b-4c11-8f9a-a2fe9f65ac48';

// ── State interpretation (bit-flags from InnerRange Inception) ────────────────

export type Severity = 'normal' | 'open' | 'unlocked' | 'warning' | 'alert';

export interface DoorStateInfo {
  label: string;
  sub: string;
  icon: LucideIcon;
  severity: Severity;
}

export function interpretState(s: number): DoorStateInfo {
  if (s & 8)   return { label: 'Forced Open',   sub: 'Door has been forced open',         icon: ShieldAlert,   severity: 'alert' };
  if (s & 64)  return { label: 'Breakglass',    sub: 'Breakglass detector triggered',     icon: Siren,         severity: 'alert' };
  if (s & 32)  return { label: 'Held Too Long', sub: 'Door held open too long',           icon: Clock,         severity: 'alert' };
  if (s & 16)  return { label: 'Held Warning',  sub: 'Door nearly held open too long',    icon: Clock,         severity: 'warning' };
  if (s & 4)   return { label: 'Locked Out',    sub: 'Door locked out by override',       icon: Ban,           severity: 'alert' };
  if (s & 128) return { label: 'Reader Tamper', sub: 'Reader tamper, check site',        icon: AlertTriangle, severity: 'warning' };
  if ((s & 1) && (s & 2)) return { label: 'Open', sub: 'Unlocked and physically open',    icon: DoorOpen,      severity: 'open' };
  if (s & 2)   return { label: 'Open',          sub: 'Physically open',                   icon: DoorOpen,      severity: 'open' };
  if (s & 1)   return { label: 'Unlocked',      sub: 'Held open',                         icon: LockOpen,      severity: 'unlocked' };
  if (s & 4096) return { label: 'Lock Offline', sub: 'Wireless lock is offline',          icon: WifiOff,       severity: 'warning' };
  return { label: 'Secured', sub: 'Closed and locked', icon: Lock, severity: 'normal' };
}

// Inception AreaState — bit 1 (0x1) = Armed.
const AREA_ARMED_BIT = 1;
export interface AreaStateInfo { label: string; armed: boolean; severity: Severity; icon: LucideIcon; }
export function interpretArea(s: number): AreaStateInfo {
  const armed = (s & AREA_ARMED_BIT) !== 0;
  return armed
    ? { label: 'Armed', armed: true, severity: 'alert', icon: ShieldAlert }
    : { label: 'Disarmed', armed: false, severity: 'open', icon: LockOpen };
}

// A door state held open (or physically open) counts as "accessible".
export function isOpen(stateInt: number): boolean {
  return (stateInt & 1) !== 0 || (stateInt & 2) !== 0;
}

export const SEVERITY_ICON_COLOR: Record<Severity, string> = {
  normal:   'text-slate-300',
  open:     'text-emerald-400',
  unlocked: 'text-amber-400',
  warning:  'text-amber-400',
  alert:    'text-red-400',
};

export const SEVERITY_RING: Record<Severity, string> = {
  normal:   'border-slate-600',
  open:     'border-emerald-500',
  unlocked: 'border-amber-500',
  warning:  'border-amber-500',
  alert:    'border-red-500',
};

// ── API helpers ───────────────────────────────────────────────────────────────

function authHeaders(extra?: Record<string, string>): HeadersInit {
  return { 'X-API-Key': API_KEY, ...extra };
}

async function fetchState(path: string): Promise<number> {
  const res = await fetch(`${GATE_API_BASE}/${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const s = data.state ?? data.State;
  if (typeof s !== 'number') throw new Error('Unexpected state format');
  return s;
}

export const fetchDoorState = USE_MOCK ? mock.fetchDoorState : (doorId: string) => fetchState(`doors/${doorId}/state`);
export const fetchAreaState = USE_MOCK ? mock.fetchAreaState : (areaId: string) => fetchState(`areas/${areaId}/state`);

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  // Scene endpoints return 207 + ok:false when a step failed but the request
  // itself was well-formed — surface the first failing step's error.
  if (!res.ok || (data && typeof data === 'object' && 'ok' in data && data.ok === false)) {
    const failed = Array.isArray((data as any)?.results)
      ? (data as any).results.find((r: any) => !r.ok)
      : null;
    throw new Error(failed?.error ?? (data as any)?.error ?? `HTTP ${res.status}`);
  }
  return data;
}

// Per-door control: drives the carpark gate, turnout entry, or shed PA door.
export const controlDoor = USE_MOCK
  ? mock.controlDoor
  : (doorId: string, action: 'Open' | 'Unlock' | 'Reinstate') =>
      postJson(`${GATE_API_BASE}/doors/${doorId}/control`, { action });

export const runFirecall    = USE_MOCK ? mock.runFirecall    : () => postJson(`${GATE_API_BASE}/scenes/firecall`, {});
export const cancelFirecall = USE_MOCK ? mock.cancelFirecall : () => postJson(`${GATE_API_BASE}/scenes/firecall`, { cancel: true });
export const setCommunityLockup = USE_MOCK
  ? mock.setCommunityLockup
  : (engage: boolean) => postJson(`${GATE_API_BASE}/scenes/community-lockup`, { engage });
export const setShed = USE_MOCK ? mock.setShed : (secure: boolean) => postJson(`${GATE_API_BASE}/scenes/shed`, { secure });
// Alarm-only arm/disarm — leaves the PA door untouched.
// NOTE: requires wvfb-api to expose POST /scenes/shed-alarm { arm: boolean }.
export const setShedAlarm = USE_MOCK ? mock.setShedAlarm : (arm: boolean) => postJson(`${GATE_API_BASE}/scenes/shed-alarm`, { arm });

// ── Scene toggles ───────────────────────────────────────────────────────────

export interface SceneToggles {
  communityLockup: boolean;
  shedSecured: boolean;
  firecallActive: boolean;
  firecallExpiresAt: number | null;
}

async function realFetchSceneToggles(): Promise<SceneToggles> {
  const res = await fetch(`${GATE_API_BASE}/scenes/state`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    communityLockup: Boolean(data.communityLockup),
    shedSecured: Boolean(data.shedSecured),
    firecallActive: Boolean(data.firecallActive),
    firecallExpiresAt: typeof data.firecallExpiresAt === 'number' ? data.firecallExpiresAt : null,
  };
}

export const fetchSceneToggles = USE_MOCK ? mock.fetchSceneToggles : realFetchSceneToggles;

// Remaining time as M:SS, derived from the shared expiry timestamp so both
// kiosks display the same countdown (and it survives a reload / unmount).
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
