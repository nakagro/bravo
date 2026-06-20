import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, RefreshCw, HelpCircle, X,
  Lock, LockOpen, DoorOpen, RotateCcw, Flame, Warehouse,
  ShieldAlert, Siren, Clock, Ban, AlertTriangle, WifiOff,
  type LucideIcon,
} from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────

// When proxied through the BRAVO server: set VITE_GATE_API_BASE=/gate-api (key
// injected by nginx). Direct local access (current setup): VITE_GATE_API_BASE=http://192.0.2.10:3000
const GATE_API_BASE  = import.meta.env.VITE_GATE_API_BASE ?? '/gate-api';
const GATE_DOOR_ID      = 'c03e570f-4003-4b24-91d1-fcb216734785';
const TURNOUT_DOOR_ID    = 'a0637546-f427-49d1-83ab-db78ada81e09';
const SHED_DOOR_ID      = '1c1b20b3-df08-4e83-8554-aee064cfa6bc';
const SHED_AREA_ID      = 'a03cba71-5d8b-4c11-8f9a-a2fe9f65ac48';
const API_KEY        = import.meta.env.VITE_GATE_API_KEY ?? '';
const POLL_INTERVAL_MS = 5000;

// ── State interpretation (bit-flags from InnerRange Inception) ────────────────

interface DoorStateInfo {
  label: string;
  sub: string;
  icon: LucideIcon;
  severity: 'normal' | 'open' | 'unlocked' | 'warning' | 'alert';
}

function interpretState(s: number): DoorStateInfo {
  if (s & 8)   return { label: 'Forced Open',   sub: 'Gate has been forced open',         icon: ShieldAlert,   severity: 'alert' };
  if (s & 64)  return { label: 'Breakglass',    sub: 'Breakglass detector triggered',     icon: Siren,         severity: 'alert' };
  if (s & 32)  return { label: 'Held Too Long', sub: 'Gate held open too long',           icon: Clock,         severity: 'alert' };
  if (s & 16)  return { label: 'Held Warning',  sub: 'Gate nearly held open too long',    icon: Clock,         severity: 'warning' };
  if (s & 4)   return { label: 'Locked Out',    sub: 'Gate locked out by override',       icon: Ban,           severity: 'alert' };
  if (s & 128) return { label: 'Reader Tamper', sub: 'Reader tamper — check site',        icon: AlertTriangle, severity: 'warning' };
  if ((s & 1) && (s & 2)) return { label: 'Open', sub: 'Gate is unlocked and open',      icon: DoorOpen,      severity: 'open' };
  if (s & 2)   return { label: 'Open',          sub: 'Gate is physically open',           icon: DoorOpen,      severity: 'open' };
  if (s & 1)   return { label: 'Unlocked',      sub: 'Gate is held open',                icon: LockOpen,      severity: 'unlocked' };
  if (s & 4096) return { label: 'Lock Offline', sub: 'Wireless lock is offline',          icon: WifiOff,       severity: 'warning' };
  return { label: 'Secured', sub: 'Gate is closed and locked', icon: Lock, severity: 'normal' };
}

const SEVERITY_ICON_COLOR: Record<DoorStateInfo['severity'], string> = {
  normal:   'text-slate-300',
  open:     'text-emerald-400',
  unlocked: 'text-amber-400',
  warning:  'text-amber-400',
  alert:    'text-red-400',
};

const SEVERITY_RING: Record<DoorStateInfo['severity'], string> = {
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

async function fetchDoorState(doorId: string): Promise<number> {
  const res = await fetch(`${GATE_API_BASE}/doors/${doorId}/state`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const s = data.state ?? data.State;
  if (typeof s !== 'number') throw new Error('Unexpected state format');
  return s;
}

async function fetchAreaState(areaId: string): Promise<number> {
  const res = await fetch(`${GATE_API_BASE}/areas/${areaId}/state`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const s = data.state ?? data.State;
  if (typeof s !== 'number') throw new Error('Unexpected state format');
  return s;
}

// Inception AreaState — bit 1 (0x1) = Armed. Verify against live values if the
// indicator looks wrong (arm the shed and compare the raw State number).
const AREA_ARMED_BIT = 1;
function interpretArea(s: number): { label: string; armed: boolean; severity: DoorStateInfo['severity'] } {
  const armed = (s & AREA_ARMED_BIT) !== 0;
  return armed
    ? { label: 'Armed', armed: true, severity: 'alert' }
    : { label: 'Disarmed', armed: false, severity: 'open' };
}

// Generic per-door control so the same Open / Hold Open / Reinstate actions can
// drive either the carpark gate or the turnout entry door independently.
function controlDoor(doorId: string, action: string): Promise<unknown> {
  return postJson(`${GATE_API_BASE}/doors/${doorId}/control`, { action });
}

interface StationStatus {
  gate: number | null;
  turnout: number | null;
  shedDoor: number | null;
  shedArea: number | null;
}

interface SceneToggles {
  communityLockup: boolean;
  shedSecured: boolean;
  firecallActive: boolean;
  firecallExpiresAt: number | null;
}

async function fetchSceneToggles(): Promise<SceneToggles> {
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

const runFirecall = () => postJson(`${GATE_API_BASE}/scenes/firecall`, {});
const cancelFirecall = () => postJson(`${GATE_API_BASE}/scenes/firecall`, { cancel: true });
const setCommunityLockup = (engage: boolean) =>
  postJson(`${GATE_API_BASE}/scenes/community-lockup`, { engage });
const setShed = (secure: boolean) => postJson(`${GATE_API_BASE}/scenes/shed`, { secure });
// Alarm-only arm/disarm — leaves the PA door untouched. Lets the kiosk reach the
// in-between states (door locked but disarmed, etc.) that the combined scene
// can't express on its own.
// NOTE: requires the station API (wvfb-api) to expose POST /scenes/shed-alarm
// { arm: boolean }. Add it alongside the existing /scenes/shed handler.
const setShedAlarm = (arm: boolean) => postJson(`${GATE_API_BASE}/scenes/shed-alarm`, { arm });

// Remaining time as M:SS, derived from the shared expiry timestamp so both
// kiosks display the same countdown (and it survives a reload / unmount).
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Confirmation descriptor ─────────────────────────────────────────────────────

interface ConfirmConfig {
  title: string;
  body: string;
  confirmLabel: string;
  confirmTone: 'amber' | 'red' | 'slate';
  run: () => Promise<unknown>;
}

const CONFIRM_TONE: Record<ConfirmConfig['confirmTone'], string> = {
  amber: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700',
  red:   'bg-red-600 hover:bg-red-500 active:bg-red-700',
  slate: 'bg-slate-600 hover:bg-slate-500 active:bg-slate-700',
};

// ── Help content ────────────────────────────────────────────────────────────────

const HELP_ITEMS: Array<{ icon: LucideIcon; name: string; desc: string }> = [
  { icon: DoorOpen, name: 'Open', desc: 'Briefly releases that column’s door — the carpark gate or the turnout entry — then it re-locks on its normal schedule.' },
  { icon: LockOpen, name: 'Hold Open', desc: 'Keeps that door unlocked indefinitely — stays open until you press Reinstate for it.' },
  { icon: RotateCcw, name: 'Reinstate', desc: 'Clears any Hold Open or override and returns that door to its normal automatic schedule. Use this to re-lock the turnout entry if it was left held open from the app.' },
  { icon: Flame, name: 'Firecall', desc: 'Holds the carpark gate and the turnout entry door open for 10 minutes, then both re-lock automatically. A live countdown shows on both station tablets. Use when responding to a callout — tap again to cancel early and re-lock both doors immediately.' },
  { icon: Lock, name: 'Community Lockup', desc: 'Locks the two public-facing doors (to the engine and operations rooms) to keep the public out during community events. Tap again to restore them.' },
  { icon: Warehouse, name: 'Shed', desc: 'The big button does both at once: Open disarms the shed and holds the PA door open; Secure re-locks the door and arms the shed (arming fails if it is not sealed). When the shed is part-open, separate Door-only and Alarm-only buttons appear so you can, for example, lock the door but leave the alarm off.' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface KioskGateControlProps {
  onBack: () => void;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

function KioskGateControl({ onBack }: KioskGateControlProps) {
  const [status, setStatus] = useState<StationStatus>({ gate: null, turnout: null, shedDoor: null, shedArea: null });
  const [gateError, setGateError] = useState(false);
  const [scenes, setScenes]         = useState<SceneToggles | null>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionError, setActionError]   = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadState = useCallback(async () => {
    const [gateRes, turnoutRes, shedDoorRes, shedAreaRes, sceneRes] = await Promise.allSettled([
      fetchDoorState(GATE_DOOR_ID),
      fetchDoorState(TURNOUT_DOOR_ID),
      fetchDoorState(SHED_DOOR_ID),
      fetchAreaState(SHED_AREA_ID),
      fetchSceneToggles(),
    ]);
    setGateError(gateRes.status === 'rejected');
    setStatus({
      gate:     gateRes.status === 'fulfilled' ? gateRes.value : null,
      turnout:  turnoutRes.status === 'fulfilled' ? turnoutRes.value : null,
      shedDoor: shedDoorRes.status === 'fulfilled' ? shedDoorRes.value : null,
      shedArea: shedAreaRes.status === 'fulfilled' ? shedAreaRes.value : null,
    });
    if (sceneRes.status === 'fulfilled') {
      setScenes(sceneRes.value);
    }
  }, []);

  // Poll on mount
  useEffect(() => {
    loadState();
    pollRef.current = setInterval(loadState, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadState]);

  const runFlow = useCallback(async (fn: () => Promise<unknown>) => {
    setActionStatus('loading');
    setActionError(null);
    setConfirm(null);
    try {
      await fn();
      setActionStatus('success');
      await loadState();
      setTimeout(() => setActionStatus('idle'), 2500);
    } catch (err) {
      setActionStatus('error');
      setActionError(err instanceof Error ? err.message : 'Action failed');
      setTimeout(() => { setActionStatus('idle'); setActionError(null); }, 4000);
    }
  }, [loadState]);

  const busy = actionStatus === 'loading';

  const lockupEngaged = scenes?.communityLockup ?? false;

  // Firecall is "active" while the shared expiry is still in the future. We lean
  // on the timestamp rather than the server's boolean so the countdown and the
  // toggle flip in lockstep on the same tick.
  const firecallExpiresAt = scenes?.firecallExpiresAt ?? null;
  const firecallRemaining = firecallExpiresAt !== null ? firecallExpiresAt - now : 0;
  const firecallActive    = firecallRemaining > 0;

  // Tick once a second only while a countdown is running.
  useEffect(() => {
    if (!firecallActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [firecallActive]);

  const gateInfo     = status.gate    !== null ? interpretState(status.gate)    : null;
  const turnoutInfo  = status.turnout !== null ? interpretState(status.turnout) : null;
  const shedDoorInfo = status.shedDoor !== null ? interpretState(status.shedDoor) : null;
  const shedAreaInfo = status.shedArea !== null ? interpretArea(status.shedArea) : null;

  // Shape the alarm (an Area, not a Door) into the same descriptor the status
  // strip renders, choosing an icon from its armed state.
  const shedAlarmChip: DoorStateInfo | null = shedAreaInfo
    ? { label: shedAreaInfo.label, sub: '', icon: shedAreaInfo.armed ? ShieldAlert : Lock, severity: shedAreaInfo.severity }
    : null;

  // Treat the door and the alarm as the two independent axes they actually are,
  // read live (not from the combined scene flag) so the in-between states show
  // honestly. "Door open" = held open or physically open; anything else = locked.
  const shedReady        = status.shedDoor !== null && status.shedArea !== null;
  const shedArmed        = shedAreaInfo?.armed ?? false;
  const shedDoorOpen     = status.shedDoor !== null && ((status.shedDoor & 1) !== 0 || (status.shedDoor & 2) !== 0);
  const shedFullySecured = shedReady && !shedDoorOpen && shedArmed;
  const shedFullyOpen    = shedReady && shedDoorOpen && !shedArmed;
  const shedPrimaryLabel = shedFullySecured
    ? 'Shed Secured — Tap to Open'
    : shedFullyOpen
      ? 'Shed Open — Tap to Secure'
      : 'Shed Part-Secured — Tap to Secure';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-50 flex flex-col overflow-hidden select-none touch-none">

      {/* Header */}
      <header className="flex-none flex items-center justify-between px-6 py-4">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-8 w-8" />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          Station Control
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHelp(true)}
            className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
            aria-label="Help — what do these buttons do?"
          >
            <HelpCircle className="h-7 w-7" />
          </button>
          <button
            onClick={loadState}
            disabled={busy}
            className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className="h-7 w-7" />
          </button>
        </div>
      </header>

      {/* ── Live status strip ────────────────────────────────────────────
          Read-only dashboard of every monitored point. Status lives here, not
          inside the action buttons, so the buttons are purely actions and a
          passer-by can read the whole station at a glance. */}
      <div className="flex-none px-6 pb-3">
        <div className="grid grid-cols-4 gap-3">
          <StatusChip name="Carpark Gate"  info={gateInfo}    error={gateError} />
          <StatusChip name="Turnout Entry" info={turnoutInfo} error={false} />
          <StatusChip name="Shed Door"     info={shedDoorInfo} error={false} />
          <StatusChip name="Shed Alarm"    info={shedAlarmChip} error={false} />
        </div>
      </div>

      {/* ── Action zones ─────────────────────────────────────────────────
          Firecall is the one time-critical action, so it gets a permanent
          full-width hero. Everything else is grouped by mental model:
          Perimeter (the daily access doors) and Station (whole-building modes
          and the shed). Never scrolls. */}
      <main className="flex-1 min-h-0 flex flex-col gap-4 px-6 pb-6">

        {/* Firecall hero — toggle with live countdown */}
        <button
          onClick={() => setConfirm(
            firecallActive
              ? {
                  title: 'Cancel Firecall?',
                  body: 'Re-locks the carpark gate and turnout entry immediately and stops the countdown.',
                  confirmLabel: 'Cancel Firecall',
                  confirmTone: 'slate',
                  run: cancelFirecall,
                }
              : {
                  title: 'Start Firecall?',
                  body: 'Holds the carpark gate and turnout entry open for 10 minutes, then they re-lock automatically.',
                  confirmLabel: 'Start Firecall',
                  confirmTone: 'red',
                  run: runFirecall,
                },
          )}
          disabled={busy || scenes === null}
          className={`flex-none w-full rounded-3xl border-2 shadow-xl transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed ${
            firecallActive
              ? 'bg-red-700/40 border-red-500 hover:bg-red-700/60 animate-pulse py-4'
              : 'bg-red-600 border-transparent hover:bg-red-500 active:bg-red-700 py-6'
          }`}
        >
          {firecallActive ? (
            <div className="flex items-center justify-center gap-6 md:gap-10 text-white">
              <span className="flex items-center gap-3 text-3xl md:text-4xl font-bold">
                <Flame className="h-10 w-10 flex-none" />
                Firecall Active
              </span>
              <span className="text-6xl font-mono font-bold tabular-nums tracking-tight">
                {formatRemaining(firecallRemaining)}
              </span>
              <span className="text-xl font-semibold text-red-200">Tap to Cancel</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 text-white">
              <Flame className="h-9 w-9 flex-none" />
              <span className="text-4xl font-bold tracking-wide">Firecall</span>
              <span className="hidden md:inline text-lg font-semibold text-red-100/80">
                Hold gate &amp; turnout open · 10 min
              </span>
            </div>
          )}
        </button>

        {/* Two grouped zones */}
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-6">

          {/* Perimeter — the daily access doors */}
          <section className="min-h-0 flex flex-col gap-2">
            <SectionLabel icon={DoorOpen}>Perimeter</SectionLabel>
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
              <DoorTile
                name="Carpark Gate"
                openLabel="Open Gate"
                busy={busy}
                onOpen={() => runFlow(() => controlDoor(GATE_DOOR_ID, 'Open'))}
                onHold={() => setConfirm({
                  title: 'Hold Gate Open?',
                  body: 'The carpark gate will remain unlocked indefinitely until Reinstate is triggered.',
                  confirmLabel: 'Hold Open',
                  confirmTone: 'amber',
                  run: () => controlDoor(GATE_DOOR_ID, 'Unlock'),
                })}
                onReinstate={() => setConfirm({
                  title: 'Reinstate Gate?',
                  body: 'Any override will be cleared and the carpark gate will return to its normal schedule.',
                  confirmLabel: 'Reinstate',
                  confirmTone: 'slate',
                  run: () => controlDoor(GATE_DOOR_ID, 'Reinstate'),
                })}
              />
              <DoorTile
                name="Turnout Entry"
                openLabel="Open Door"
                busy={busy}
                onOpen={() => runFlow(() => controlDoor(TURNOUT_DOOR_ID, 'Open'))}
                onHold={() => setConfirm({
                  title: 'Hold Turnout Door Open?',
                  body: 'The turnout entry door will remain unlocked indefinitely until Reinstate is triggered.',
                  confirmLabel: 'Hold Open',
                  confirmTone: 'amber',
                  run: () => controlDoor(TURNOUT_DOOR_ID, 'Unlock'),
                })}
                onReinstate={() => setConfirm({
                  title: 'Reinstate Turnout Door?',
                  body: 'Any override will be cleared and the turnout entry door will re-lock and return to its normal schedule. Use this if it was left held open from the app.',
                  confirmLabel: 'Reinstate',
                  confirmTone: 'slate',
                  run: () => controlDoor(TURNOUT_DOOR_ID, 'Reinstate'),
                })}
              />
            </div>
          </section>

          {/* Station — whole-building modes and the shed */}
          <section className="min-h-0 flex flex-col gap-2">
            <SectionLabel icon={Warehouse}>Station</SectionLabel>
            <div className="flex-1 min-h-0 grid grid-rows-[1fr_1.5fr] gap-4">

              {/* Community Lockup */}
              <SceneToggleButton
                label="Community Lockup"
                activeLabel="Lockup Active — Tap to End"
                active={lockupEngaged}
                disabled={busy || scenes === null}
                onPress={() => setConfirm(
                  lockupEngaged
                    ? {
                        title: 'End Community Lockup?',
                        body: 'The two public-facing doors will return to their normal unlock schedule.',
                        confirmLabel: 'End Lockup',
                        confirmTone: 'slate',
                        run: () => setCommunityLockup(false),
                      }
                    : {
                        title: 'Engage Community Lockup?',
                        body: 'Locks the two doors leading to the engine and operations rooms to keep the public out during the event.',
                        confirmLabel: 'Lock Doors',
                        confirmTone: 'amber',
                        run: () => setCommunityLockup(true),
                      },
                )}
              />

              {/* Shed — smart combined button plus granular per-axis controls
                  (door / alarm) whenever it is not fully secured. Live status
                  for both axes lives in the strip above. */}
              <div className="min-h-0 flex flex-col gap-2">
                <button
                  onClick={() => setConfirm(
                    shedFullySecured
                      ? {
                          title: 'Open & Access Shed?',
                          body: 'Disarms the shed and holds the PA door open so it can be propped. It stays open until you secure the shed again.',
                          confirmLabel: 'Open Shed',
                          confirmTone: 'amber',
                          run: () => setShed(false),
                        }
                      : {
                          title: 'Secure the Shed?',
                          body: 'Re-locks the PA door and arms the shed. Arming will fail if the shed is not sealed.',
                          confirmLabel: 'Secure Shed',
                          confirmTone: 'slate',
                          run: () => setShed(true),
                        },
                  )}
                  disabled={busy || !shedReady}
                  className={`flex-1 min-h-0 rounded-3xl px-4 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed border-2 ${
                    shedFullySecured
                      ? 'bg-slate-700 border-transparent hover:bg-slate-600 active:bg-slate-500'
                      : 'bg-amber-700/40 border-amber-500 hover:bg-amber-700/60'
                  }`}
                >
                  <span className="flex items-center justify-center gap-3 text-2xl md:text-3xl font-bold text-center text-white">
                    {!shedFullySecured && <span className="h-3 w-3 flex-none rounded-full bg-amber-400 animate-pulse" />}
                    {shedPrimaryLabel}
                  </span>
                </button>

                {shedReady && !shedFullySecured && (
                  <div className="flex-none flex gap-2 h-14">
                    <button
                      onClick={() => setConfirm(
                        shedDoorOpen
                          ? {
                              title: 'Lock PA Door Only?',
                              body: 'Re-locks the shed PA door. The shed alarm is left exactly as it is.',
                              confirmLabel: 'Lock Door',
                              confirmTone: 'slate',
                              run: () => controlDoor(SHED_DOOR_ID, 'Reinstate'),
                            }
                          : {
                              title: 'Open PA Door Only?',
                              body: 'Holds the shed PA door open. The shed alarm is left exactly as it is.',
                              confirmLabel: 'Open Door',
                              confirmTone: 'amber',
                              run: () => controlDoor(SHED_DOOR_ID, 'Unlock'),
                            },
                      )}
                      disabled={busy}
                      className="flex-1 min-h-0 rounded-2xl border-2 border-slate-600 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center justify-center gap-2 text-lg font-bold">
                        {shedDoorOpen ? <Lock className="h-5 w-5 flex-none" /> : <DoorOpen className="h-5 w-5 flex-none" />}
                        {shedDoorOpen ? 'Lock Door' : 'Open Door'}
                      </span>
                    </button>
                    <button
                      onClick={() => setConfirm(
                        shedArmed
                          ? {
                              title: 'Disarm Alarm Only?',
                              body: 'Disarms the shed alarm. The PA door is left exactly as it is.',
                              confirmLabel: 'Disarm',
                              confirmTone: 'amber',
                              run: () => setShedAlarm(false),
                            }
                          : {
                              title: 'Arm Alarm Only?',
                              body: 'Arms the shed alarm. The PA door is left as it is. Arming will fail if the shed is not sealed.',
                              confirmLabel: 'Arm',
                              confirmTone: 'slate',
                              run: () => setShedAlarm(true),
                            },
                      )}
                      disabled={busy}
                      className="flex-1 min-h-0 rounded-2xl border-2 border-slate-600 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center justify-center gap-2 text-lg font-bold">
                        {shedArmed ? <LockOpen className="h-5 w-5 flex-none" /> : <ShieldAlert className="h-5 w-5 flex-none" />}
                        {shedArmed ? 'Disarm' : 'Arm'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Action feedback — overlay toast, never affects layout height */}
      {(actionStatus === 'success' || actionStatus === 'error') && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-6 z-[110]">
          <div className={`px-8 py-4 rounded-2xl border-2 text-center shadow-2xl ${
            actionStatus === 'success'
              ? 'bg-emerald-900/90 border-emerald-600'
              : 'bg-red-900/90 border-red-600'
          }`}>
            <p className={`text-xl font-bold ${actionStatus === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
              {actionStatus === 'success' ? 'Command sent successfully' : (actionError ?? 'Command failed')}
            </p>
          </div>
        </div>
      )}

      {/* Help modal — sized to fit 1280×800 with no scrolling */}
      {showHelp && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border-4 border-slate-700 rounded-[2rem] w-full max-w-5xl max-h-full flex flex-col shadow-2xl overflow-hidden">
            <div className="flex-none flex items-center justify-between px-8 py-4 border-b border-slate-800">
              <h2 className="text-3xl font-bold text-white">What do these buttons do?</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
                aria-label="Close help"
              >
                <X className="h-7 w-7" />
              </button>
            </div>
            <div className="flex-1 min-h-0 px-8 py-5 grid grid-cols-2 gap-x-8 gap-y-4 content-center">
              {HELP_ITEMS.map((item) => (
                <div key={item.name} className="flex items-start gap-4">
                  <item.icon className="h-8 w-8 flex-none text-amber-400 mt-1" />
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-white">{item.name}</p>
                    <p className="text-base text-slate-400 leading-snug">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-none px-8 py-4 border-t border-slate-800">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-bold transition-colors active:scale-[0.98]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="bg-slate-900 border-4 border-slate-700 rounded-[2rem] w-full max-w-xl p-8 flex flex-col gap-6 shadow-2xl">
            <h2 className="text-3xl font-bold text-white text-center">{confirm.title}</h2>
            <p className="text-xl text-slate-400 text-center leading-snug">{confirm.body}</p>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-bold transition-colors active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={() => runFlow(confirm.run)}
                className={`flex-[2] py-5 rounded-2xl text-white text-2xl font-bold transition-colors active:scale-[0.98] ${CONFIRM_TONE[confirm.confirmTone]}`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section label ───────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="flex-none flex items-center gap-2 px-1">
      <Icon className="h-5 w-5 text-slate-500" />
      <span className="text-sm font-bold uppercase tracking-[0.15em] text-slate-500">{children}</span>
    </div>
  );
}

// ── Door tile ───────────────────────────────────────────────────────────────────

interface DoorTileProps {
  name: string;
  openLabel: string;
  busy: boolean;
  onOpen: () => void;
  onHold: () => void;
  onReinstate: () => void;
}

// A self-contained door card: name header, a big Open button, then Hold Open /
// Reinstate sharing a 50/50 row. Live state for the door lives in the status
// strip, so the tile is purely the actions for that one door.
function DoorTile({ name, openLabel, busy, onOpen, onHold, onReinstate }: DoorTileProps) {
  return (
    <div className="min-h-0 flex flex-col gap-3 rounded-3xl bg-slate-900/50 border border-slate-800 p-3">
      <p className="flex-none text-center text-base font-bold text-white">{name}</p>

      <button
        onClick={onOpen}
        disabled={busy}
        className="flex-1 min-h-0 rounded-2xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-3xl font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
      >
        {busy ? (
          <span className="flex items-center justify-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            Working…
          </span>
        ) : (
          openLabel
        )}
      </button>

      <div className="flex-none flex gap-3">
        <button
          onClick={onHold}
          disabled={busy}
          aria-label={`Hold ${name} open`}
          className="flex-1 py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Hold Open
        </button>
        <button
          onClick={onReinstate}
          disabled={busy}
          aria-label={`Reinstate ${name}`}
          className="flex-1 py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Reinstate
        </button>
      </div>
    </div>
  );
}

// ── Status displays ─────────────────────────────────────────────────────────────

// One read-only chip in the top status strip. `info` is the resolved state
// descriptor (or null while loading); `error` shows the point as Offline.
function StatusChip({ name, info, error }: { name: string; info: DoorStateInfo | null; error?: boolean }) {
  const Icon = error ? AlertTriangle : info?.icon;
  const tone: DoorStateInfo['severity'] = error ? 'alert' : info?.severity ?? 'normal';
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 min-w-0">
      <div className={`flex-none flex items-center justify-center w-11 h-11 rounded-full border-2 bg-slate-950 ${error || info ? SEVERITY_RING[tone] : 'border-slate-700'}`}>
        {Icon ? (
          <Icon className={`h-6 w-6 ${SEVERITY_ICON_COLOR[tone]}`} />
        ) : (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
        )}
      </div>
      <div className="min-w-0 leading-tight">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 truncate">{name}</p>
        <p className={`text-base md:text-lg font-bold truncate ${error || info ? SEVERITY_ICON_COLOR[tone] : 'text-slate-400'}`}>
          {error ? 'Offline' : info ? info.label : '…'}
        </p>
      </div>
    </div>
  );
}

// ── Toggle button ───────────────────────────────────────────────────────────────

interface SceneToggleButtonProps {
  label: string;
  activeLabel: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}

function SceneToggleButton({ label, activeLabel, active, disabled, onPress }: SceneToggleButtonProps) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className={`flex-1 min-h-0 rounded-3xl text-white text-3xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed border-2 ${
        active
          ? 'bg-amber-700/40 border-amber-500 hover:bg-amber-700/60'
          : 'bg-slate-700 border-transparent hover:bg-slate-600 active:bg-slate-500'
      }`}
    >
      <span className="flex items-center justify-center gap-3 px-4 text-center">
        {active && <span className="h-3 w-3 flex-none rounded-full bg-amber-400 animate-pulse" />}
        {active ? activeLabel : label}
      </span>
    </button>
  );
}

export default KioskGateControl;
