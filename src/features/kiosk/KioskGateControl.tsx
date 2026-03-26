import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────

// When proxied through the BRAVO server (recommended): set VITE_GATE_API_BASE=/gate-api
// API key is then injected by nginx — leave VITE_GATE_API_KEY blank.
// Direct local access fallback: set VITE_GATE_API_BASE=http://192.0.2.10:3000
const GATE_API_BASE  = import.meta.env.VITE_GATE_API_BASE ?? '/gate-api';
const GATE_DOOR_ID   = 'c03e570f-4003-4b24-91d1-fcb216734785';
const GATE_DOOR_NAME = 'D14 Carpark Gate';
const API_KEY        = import.meta.env.VITE_GATE_API_KEY ?? '';
const POLL_INTERVAL_MS = 5000;

// ── State interpretation (bit-flags from InnerRange Inception) ────────────────

interface DoorStateInfo {
  label: string;
  sub: string;
  icon: string;
  severity: 'normal' | 'open' | 'unlocked' | 'warning' | 'alert';
}

function interpretState(s: number): DoorStateInfo {
  if (s & 8)   return { label: 'Forced Open',   sub: 'Gate has been forced open',         icon: '🚨', severity: 'alert' };
  if (s & 64)  return { label: 'Breakglass',    sub: 'Breakglass detector triggered',     icon: '🚨', severity: 'alert' };
  if (s & 32)  return { label: 'Held Too Long', sub: 'Gate held open too long',           icon: '⏱️', severity: 'alert' };
  if (s & 16)  return { label: 'Held Warning',  sub: 'Gate nearly held open too long',    icon: '⏱️', severity: 'warning' };
  if (s & 4)   return { label: 'Locked Out',    sub: 'Gate locked out by override',       icon: '⛔', severity: 'alert' };
  if (s & 128) return { label: 'Reader Tamper', sub: 'Reader tamper — check site',        icon: '⚠️', severity: 'warning' };
  if ((s & 1) && (s & 2)) return { label: 'Open', sub: 'Gate is unlocked and open',      icon: '🟢', severity: 'open' };
  if (s & 2)   return { label: 'Open',          sub: 'Gate is physically open',           icon: '🟢', severity: 'open' };
  if (s & 1)   return { label: 'Unlocked',      sub: 'Gate is held open',                icon: '🔓', severity: 'unlocked' };
  if (s & 4096) return { label: 'Lock Offline', sub: 'Wireless lock is offline',          icon: '📡', severity: 'warning' };
  return { label: 'Secured', sub: 'Gate is closed and locked', icon: '🔒', severity: 'normal' };
}

const SEVERITY_RING: Record<DoorStateInfo['severity'], string> = {
  normal:   'border-slate-600',
  open:     'border-emerald-500',
  unlocked: 'border-amber-500',
  warning:  'border-amber-500',
  alert:    'border-red-500',
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchState(): Promise<number> {
  const res = await fetch(`${GATE_API_BASE}/doors/${GATE_DOOR_ID}/state`, {
    headers: { 'X-API-Key': API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const s = data.state ?? data.State;
  if (typeof s !== 'number') throw new Error('Unexpected state format');
  return s;
}

async function sendAction(action: string): Promise<void> {
  const res = await fetch(`${GATE_API_BASE}/doors/${GATE_DOOR_ID}/control`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface KioskGateControlProps {
  onBack: () => void;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

function KioskGateControl({ onBack }: KioskGateControlProps) {
  const [stateInt, setStateInt]     = useState<number | null>(null);
  const [stateError, setStateError] = useState(false);
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionError, setActionError]   = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'Unlock' | 'Reinstate' | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadState = useCallback(async () => {
    try {
      const s = await fetchState();
      setStateInt(s);
      setStateError(false);
    } catch {
      setStateError(true);
    }
  }, []);

  // Poll on mount
  useEffect(() => {
    loadState();
    pollRef.current = setInterval(loadState, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadState]);

  const handleAction = useCallback(async (action: string) => {
    setActionStatus('loading');
    setActionError(null);
    setConfirmAction(null);
    try {
      await sendAction(action);
      setActionStatus('success');
      // Refresh state immediately after action
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

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-50 flex flex-col overflow-hidden select-none touch-none">

      {/* Header */}
      <div className="flex-none flex items-center justify-between px-8 py-6">
        <button
          onClick={onBack}
          className="p-4 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-10 w-10" />
        </button>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
          {GATE_DOOR_NAME}
        </h1>
        <button
          onClick={loadState}
          disabled={busy}
          className="p-4 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw className="h-8 w-8" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8 gap-8 max-w-2xl mx-auto w-full">

        {/* State indicator */}
        <div className={`flex flex-col items-center justify-center w-52 h-52 md:w-64 md:h-64 rounded-full border-8 transition-colors duration-500 bg-slate-900 ${stateInfo ? SEVERITY_RING[stateInfo.severity] : 'border-slate-700'}`}>
          {stateError ? (
            <>
              <span className="text-5xl mb-2">⚠️</span>
              <p className="text-xl font-bold text-red-400">Offline</p>
              <p className="text-base text-slate-500 text-center px-4 mt-1">Cannot reach API</p>
            </>
          ) : stateInfo ? (
            <>
              <span className="text-6xl mb-2">{stateInfo.icon}</span>
              <p className="text-2xl font-bold text-white">{stateInfo.label}</p>
              <p className="text-base text-slate-400 text-center px-6 mt-1 leading-snug">{stateInfo.sub}</p>
            </>
          ) : (
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-slate-300" />
          )}
        </div>

        {/* Action feedback */}
        {actionStatus === 'success' && (
          <div className="w-full px-6 py-4 bg-emerald-900/60 border-2 border-emerald-600 rounded-2xl text-center">
            <p className="text-xl font-bold text-emerald-300">Command sent successfully</p>
          </div>
        )}
        {actionStatus === 'error' && (
          <div className="w-full px-6 py-4 bg-red-900/60 border-2 border-red-600 rounded-2xl text-center">
            <p className="text-xl font-bold text-red-300">{actionError ?? 'Command failed'}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="w-full flex flex-col gap-4">
          {/* Primary: Open */}
          <button
            onClick={() => handleAction('Open')}
            disabled={busy}
            className="w-full py-8 rounded-2xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-3xl md:text-4xl font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-xl"
          >
            {busy && actionStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                Opening…
              </span>
            ) : (
              'Open Gate'
            )}
          </button>

          {/* Secondary: Hold Open + Reinstate */}
          <div className="flex gap-4">
            <button
              onClick={() => setConfirmAction('Unlock')}
              disabled={busy}
              className="flex-1 py-7 rounded-2xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-xl md:text-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Hold Open
            </button>
            <button
              onClick={() => setConfirmAction('Reinstate')}
              disabled={busy}
              className="flex-1 py-7 rounded-2xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white text-xl md:text-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reinstate
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="bg-slate-900 border-4 border-slate-700 rounded-[2rem] w-full max-w-xl p-8 md:p-10 flex flex-col gap-6 shadow-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center">
              {confirmAction === 'Unlock' ? 'Hold Gate Open?' : 'Reinstate Gate?'}
            </h2>
            <p className="text-xl md:text-2xl text-slate-400 text-center leading-snug">
              {confirmAction === 'Unlock'
                ? 'The gate will remain unlocked indefinitely until Reinstate is triggered.'
                : 'Any override will be cleared and the gate will return to its normal schedule.'}
            </p>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-6 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-bold transition-colors active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(confirmAction)}
                className={`flex-[2] py-6 rounded-2xl text-white text-2xl font-bold transition-colors active:scale-[0.98] ${
                  confirmAction === 'Unlock'
                    ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
                    : 'bg-slate-600 hover:bg-slate-500 active:bg-slate-700'
                }`}
              >
                {confirmAction === 'Unlock' ? 'Hold Open' : 'Reinstate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KioskGateControl;
