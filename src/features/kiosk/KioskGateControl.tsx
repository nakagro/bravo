import React, { useState, useEffect, useCallback, useRef } from 'react';
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
const GATE_DOOR_ID   = 'c03e570f-4003-4b24-91d1-fcb216734785';
const GATE_DOOR_NAME = 'D14 Carpark Gate';
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

async function fetchState(): Promise<number> {
  const res = await fetch(`${GATE_API_BASE}/doors/${GATE_DOOR_ID}/state`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const s = data.state ?? data.State;
  if (typeof s !== 'number') throw new Error('Unexpected state format');
  return s;
}

async function sendAction(action: string): Promise<void> {
  await postJson(`${GATE_API_BASE}/doors/${GATE_DOOR_ID}/control`, { action });
}

interface SceneToggles {
  communityLockup: boolean;
  shedSecured: boolean;
}

async function fetchSceneToggles(): Promise<SceneToggles> {
  const res = await fetch(`${GATE_API_BASE}/scenes/state`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    communityLockup: Boolean(data.communityLockup),
    shedSecured: Boolean(data.shedSecured),
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
const setCommunityLockup = (engage: boolean) =>
  postJson(`${GATE_API_BASE}/scenes/community-lockup`, { engage });
const setShed = (secure: boolean) => postJson(`${GATE_API_BASE}/scenes/shed`, { secure });

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
  { icon: DoorOpen, name: 'Open Gate', desc: 'Briefly opens the carpark gate, then it closes and re-locks on its normal schedule.' },
  { icon: LockOpen, name: 'Hold Open', desc: 'Keeps the carpark gate unlocked indefinitely — stays open until you press Reinstate.' },
  { icon: RotateCcw, name: 'Reinstate', desc: 'Clears any Hold Open or override and returns the gate to its normal automatic schedule.' },
  { icon: Flame, name: 'Firecall', desc: 'Holds the carpark gate and the turnout entry door open for 10 minutes, then both re-lock automatically. Use when responding to a callout.' },
  { icon: Lock, name: 'Community Lockup', desc: 'Locks the two public-facing doors (to the engine and operations rooms) to keep the public out during community events. Tap again to restore them.' },
  { icon: Warehouse, name: 'Lock Up & Arm Shed', desc: 'Locks the shed PA door and arms the shed alarm. Tap again to open and disarm. Arming fails if the shed is not sealed.' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface KioskGateControlProps {
  onBack: () => void;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

function KioskGateControl({ onBack }: KioskGateControlProps) {
  const [stateInt, setStateInt]     = useState<number | null>(null);
  const [stateError, setStateError] = useState(false);
  const [scenes, setScenes]         = useState<SceneToggles | null>(null);
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionError, setActionError]   = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadState = useCallback(async () => {
    const [doorRes, sceneRes] = await Promise.allSettled([fetchState(), fetchSceneToggles()]);
    if (doorRes.status === 'fulfilled') {
      setStateInt(doorRes.value);
      setStateError(false);
    } else {
      setStateError(true);
    }
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

  const stateInfo = stateInt !== null ? interpretState(stateInt) : null;
  const busy = actionStatus === 'loading';

  const lockupEngaged = scenes?.communityLockup ?? false;
  const shedSecured   = scenes?.shedSecured ?? false;

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
          Gate &amp; Station Control
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

      {/* Body — two columns that fill the remaining height, never scroll */}
      <main className="flex-1 min-h-0 grid grid-cols-2 gap-6 px-6 pb-6">

        {/* ── Left: Gate ──────────────────────────────────────────────── */}
        <section className="min-h-0 flex flex-col gap-4">
          {/* State indicator */}
          <div className="flex-none flex items-center gap-5 px-5 py-4 rounded-3xl bg-slate-900 border border-slate-800">
            <div className={`flex-none flex items-center justify-center w-24 h-24 rounded-full border-[6px] transition-colors duration-500 bg-slate-950 ${stateInfo ? SEVERITY_RING[stateInfo.severity] : 'border-slate-700'}`}>
              {stateError ? (
                <AlertTriangle className="h-12 w-12 text-red-400" />
              ) : stateInfo ? (
                React.createElement(stateInfo.icon, { className: `h-12 w-12 ${SEVERITY_ICON_COLOR[stateInfo.severity]}` })
              ) : (
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-slate-300" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{GATE_DOOR_NAME}</p>
              <p className="text-2xl font-bold text-white truncate">
                {stateError ? 'Offline' : stateInfo ? stateInfo.label : '…'}
              </p>
              <p className="text-sm text-slate-400 truncate">
                {stateError ? 'Cannot reach API' : stateInfo ? stateInfo.sub : ''}
              </p>
            </div>
          </div>

          {/* Gate actions fill remaining height */}
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <button
              onClick={() => runFlow(() => sendAction('Open'))}
              disabled={busy}
              className="flex-[2] min-h-0 rounded-3xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-4xl font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl"
            >
              {busy ? (
                <span className="flex items-center justify-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                  Working…
                </span>
              ) : (
                'Open Gate'
              )}
            </button>

            <div className="flex-1 min-h-0 flex gap-4">
              <button
                onClick={() => setConfirm({
                  title: 'Hold Gate Open?',
                  body: 'The gate will remain unlocked indefinitely until Reinstate is triggered.',
                  confirmLabel: 'Hold Open',
                  confirmTone: 'amber',
                  run: () => sendAction('Unlock'),
                })}
                disabled={busy}
                className="flex-1 min-h-0 rounded-3xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Hold Open
              </button>
              <button
                onClick={() => setConfirm({
                  title: 'Reinstate Gate?',
                  body: 'Any override will be cleared and the gate will return to its normal schedule.',
                  confirmLabel: 'Reinstate',
                  confirmTone: 'slate',
                  run: () => sendAction('Reinstate'),
                })}
                disabled={busy}
                className="flex-1 min-h-0 rounded-3xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Reinstate
              </button>
            </div>
          </div>
        </section>

        {/* ── Right: Station scenes ───────────────────────────────────── */}
        <section className="min-h-0 flex flex-col gap-4">
          <p className="flex-none text-sm font-semibold uppercase tracking-widest text-slate-500">Station Controls</p>

          {/* Firecall */}
          <button
            onClick={() => setConfirm({
              title: 'Start Firecall?',
              body: 'Holds the carpark gate and turnout entry open for 10 minutes, then they re-lock automatically.',
              confirmLabel: 'Start Firecall',
              confirmTone: 'red',
              run: runFirecall,
            })}
            disabled={busy}
            className="flex-1 min-h-0 rounded-3xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-4xl font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl"
          >
            Firecall
          </button>

          {/* Community Lockup toggle */}
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

          {/* Shed toggle */}
          <SceneToggleButton
            label="Lock Up & Arm Shed"
            activeLabel="Shed Locked & Armed — Tap to Open & Disarm"
            active={shedSecured}
            disabled={busy || scenes === null}
            onPress={() => setConfirm(
              shedSecured
                ? {
                    title: 'Open the Shed?',
                    body: 'Disarms the shed area and unlocks the shed PA door.',
                    confirmLabel: 'Open Shed',
                    confirmTone: 'amber',
                    run: () => setShed(false),
                  }
                : {
                    title: 'Secure the Shed?',
                    body: 'Locks the shed PA door and arms the shed area. Arming will fail if the shed is not sealed.',
                    confirmLabel: 'Secure Shed',
                    confirmTone: 'slate',
                    run: () => setShed(true),
                  },
            )}
          />
        </section>
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
