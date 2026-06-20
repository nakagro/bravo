// In-memory simulation of the station (wvfb-api) for local dev, where the
// station LAN is unreachable. gateApi swaps these in for the real fetch/post
// functions when USE_MOCK is set (auto-on in the dev server, never in prod).
// Nothing else in the kiosk imports this — it's confined to the gateApi seam.

import type { SceneToggles } from './gateApi';

const SECURED = 0;
const UNLOCKED = 1;

const doors: Record<string, number> = {};      // doorId → state int
let shedArmed = 0;                              // single area (shed alarm)
let communityLockup = false;
let firecallExpiresAt: number | null = null;
const revertTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const FIRECALL_MS = 10 * 60 * 1000;
const MOMENTARY_OPEN_MS = 3000; // a tapped Open re-secures shortly, like a fob swipe

let announced = false;
function announce() {
  if (announced) return;
  announced = true;
  console.info('%c[kiosk] Station API MOCK active — buttons are simulated, no real hardware.', 'color:#f59e0b;font-weight:bold');
}

// Small fake latency so the loading states actually exercise.
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export async function fetchDoorState(doorId: string): Promise<number> {
  announce();
  await delay();
  return doors[doorId] ?? SECURED;
}

export async function fetchAreaState(_areaId: string): Promise<number> {
  await delay();
  return shedArmed;
}

export async function fetchSceneToggles(): Promise<SceneToggles> {
  await delay();
  const firecallActive = firecallExpiresAt !== null && firecallExpiresAt > Date.now();
  return {
    communityLockup,
    shedSecured: false,
    firecallActive,
    firecallExpiresAt: firecallActive ? firecallExpiresAt : null,
  };
}

export async function controlDoor(doorId: string, action: 'Open' | 'Unlock' | 'Reinstate'): Promise<unknown> {
  announce();
  await delay();
  if (revertTimers[doorId]) { clearTimeout(revertTimers[doorId]); delete revertTimers[doorId]; }
  if (action === 'Open') {
    doors[doorId] = UNLOCKED;
    // Momentary: drift back to Secured, mirroring the real controller.
    revertTimers[doorId] = setTimeout(() => { doors[doorId] = SECURED; delete revertTimers[doorId]; }, MOMENTARY_OPEN_MS);
  } else if (action === 'Unlock') {
    doors[doorId] = UNLOCKED; // held open
  } else if (action === 'Reinstate') {
    doors[doorId] = SECURED;
  }
  return { ok: true };
}

export async function runFirecall(): Promise<unknown> {
  announce();
  await delay();
  firecallExpiresAt = Date.now() + FIRECALL_MS;
  return { ok: true };
}

export async function cancelFirecall(): Promise<unknown> {
  await delay();
  firecallExpiresAt = null;
  return { ok: true };
}

export async function setCommunityLockup(engage: boolean): Promise<unknown> {
  announce();
  await delay();
  communityLockup = engage;
  return { ok: true };
}

export async function setShed(_secure: boolean): Promise<unknown> {
  await delay();
  return { ok: true };
}

export async function setShedAlarm(arm: boolean): Promise<unknown> {
  announce();
  await delay();
  shedArmed = arm ? 1 : 0;
  return { ok: true };
}
