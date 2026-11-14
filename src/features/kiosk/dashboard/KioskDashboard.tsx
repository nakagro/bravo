// Kiosk dashboard host. Owns the live data (door/area polling + scene state),
// the firecall countdown tick, and the modal/confirm orchestration. Renders the
// layout through GridRenderer. The layout is the hardcoded DEFAULT_LAYOUT today;
// in Phase 3 it becomes a Convex query - nothing else here needs to change.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, RefreshCw, DoorOpen, LockOpen, Lock, ShieldAlert } from 'lucide-react';
import {
  fetchDoorState, fetchAreaState, fetchSceneToggles, type SceneToggles,
  controlDoor, setShedAlarm, runFirecall, cancelFirecall, setCommunityLockup,
  POLL_INTERVAL_MS,
} from './gateApi';
import { DEFAULT_LAYOUT, type PlacedWidget, type KioskOverlay } from './layout';
import { GridRenderer, type DashboardContext } from './GridRenderer';
import { DoorControlModal, AreaControlModal, ConfirmDialog, type ConfirmConfig } from './modals';
import { type ResolvedState } from './widgets';
import { errorMessage } from "@/lib/errors";

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';
type ActiveModal = { type: 'door' | 'area'; id: string; name: string; secureLabel?: string } | null;

interface KioskDashboardProps {
  layout?: PlacedWidget[];
  onNavigate: (target: KioskOverlay) => void;
  onExit: () => void;
  /** Bumped by the host page on inactivity to dismiss any open modal/confirm. */
  resetSignal?: number;
}

export default function KioskDashboard({
  layout = DEFAULT_LAYOUT, onNavigate, onExit, resetSignal = 0,
}: KioskDashboardProps) {
  // Only poll what the layout actually places.
  const { doorIds, areaIds } = useMemo(() => {
    const doors: string[] = [];
    const areas: string[] = [];
    for (const p of layout) {
      if (p.widget.kind === 'doorStatus') doors.push(p.widget.doorId);
      if (p.widget.kind === 'areaStatus') areas.push(p.widget.areaId);
    }
    return { doorIds: doors, areaIds: areas };
  }, [layout]);

  const [doorStates, setDoorStates] = useState<Record<string, number | null>>({});
  const [areaStates, setAreaStates] = useState<Record<string, number | null>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [scenes, setScenes] = useState<SceneToggles | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal>(null);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);

  // Transient post-action feedback per element (e.g. green "Opened"). InnerRange
  // can't reliably distinguish a momentary open from a hold, so we show the
  // user what they just did for a few seconds rather than trusting the poll.
  const [flash, setFlash] = useState<Record<string, ResolvedState>>({});
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const flashStatus = useCallback((id: string, info: ResolvedState, ms = 4000) => {
    if (flashTimers.current[id]) clearTimeout(flashTimers.current[id]);
    setFlash((prev) => ({ ...prev, [id]: info }));
    flashTimers.current[id] = setTimeout(() => {
      setFlash((prev) => { const next = { ...prev }; delete next[id]; return next; });
      delete flashTimers.current[id];
    }, ms);
  }, []);
  useEffect(() => () => { Object.values(flashTimers.current).forEach(clearTimeout); }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadState = useCallback(async () => {
    const [doorResults, areaResults, sceneResult] = await Promise.all([
      Promise.allSettled(doorIds.map(fetchDoorState)),
      Promise.allSettled(areaIds.map(fetchAreaState)),
      fetchSceneToggles().catch(() => null),
    ]);

    const nextDoors: Record<string, number | null> = {};
    const nextAreas: Record<string, number | null> = {};
    const nextErrors: Record<string, boolean> = {};
    doorIds.forEach((id, i) => {
      const r = doorResults[i];
      nextDoors[id] = r.status === 'fulfilled' ? r.value : null;
      nextErrors[id] = r.status === 'rejected';
    });
    areaIds.forEach((id, i) => {
      const r = areaResults[i];
      nextAreas[id] = r.status === 'fulfilled' ? r.value : null;
      nextErrors[id] = r.status === 'rejected';
    });
    setDoorStates(nextDoors);
    setAreaStates(nextAreas);
    setErrors(nextErrors);
    if (sceneResult) setScenes(sceneResult);
  }, [doorIds, areaIds]);

  // Poll on mount.
  useEffect(() => {
    loadState();
    pollRef.current = setInterval(loadState, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadState]);

  // Dismiss transient UI when the host page signals inactivity.
  useEffect(() => {
    if (resetSignal > 0) { setModal(null); setConfirm(null); }
  }, [resetSignal]);

  const runFlow = useCallback(async (fn: () => Promise<unknown>, afterSuccess?: () => void) => {
    setActionStatus('loading');
    setActionError(null);
    setConfirm(null);
    setModal(null);
    try {
      await fn();
      setActionStatus('success');
      afterSuccess?.();
      await loadState();
      setTimeout(() => setActionStatus('idle'), 2500);
    } catch (err) {
      setActionStatus('error');
      setActionError(errorMessage(err, "Action failed"));
      setTimeout(() => { setActionStatus('idle'); setActionError(null); }, 4000);
    }
  }, [loadState]);

  const busy = actionStatus === 'loading';

  // Firecall: lean on the shared expiry so the countdown and the toggle flip in
  // lockstep across both kiosks.
  const firecallExpiresAt = scenes?.firecallExpiresAt ?? null;
  const firecallRemaining = firecallExpiresAt !== null ? firecallExpiresAt - now : 0;
  const firecallActive = firecallRemaining > 0;
  const lockupEngaged = scenes?.communityLockup ?? false;

  // Tick once a second only while a countdown is running.
  useEffect(() => {
    if (!firecallActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [firecallActive]);

  const ctx: DashboardContext = useMemo(() => ({
    doorState: (id) => doorStates[id] ?? null,
    areaState: (id) => areaStates[id] ?? null,
    hasError: (id) => Boolean(errors[id]),
    scenesReady: scenes !== null,
    lockupEngaged,
    firecallActive,
    firecallRemaining,
    busy,
    flashOf: (id) => flash[id] ?? null,
    openDoorControl: (id, name, secureLabel) => setModal({ type: 'door', id, name, secureLabel }),
    openAreaControl: (id, name) => setModal({ type: 'area', id, name }),
    // No confirm dialog - the Firecall hero itself requires a 3-second press and
    // hold, so completing the hold IS the deliberate confirmation.
    toggleFirecall: () => runFlow(firecallActive ? cancelFirecall : runFirecall),
    toggleLockup: () => setConfirm(
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
            body: 'Locks the Engine Bay and Workhub doors to keep the public out during community events. Tap End Lockup to restore them.',
            confirmLabel: 'Lock Doors',
            confirmTone: 'amber',
            run: () => setCommunityLockup(true),
          },
    ),
    navigate: onNavigate,
  }), [doorStates, areaStates, errors, scenes, lockupEngaged, firecallActive, firecallRemaining, busy, onNavigate, runFlow, flash]);

  const modalDoorState = modal?.type === 'door' ? doorStates[modal.id] ?? null : null;
  const modalAreaState = modal?.type === 'area' ? areaStates[modal.id] ?? null : null;
  const modalError = modal ? Boolean(errors[modal.id]) : false;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-50 flex flex-col overflow-hidden select-none touch-none">
      {/* Header - time top-left, date top-right; exit + refresh tucked beside them */}
      <header className="flex-none flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
            aria-label="Exit kiosk"
          >
            <X className="h-8 w-8" />
          </button>
          <HeaderTime />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Wyndham Vale Fire Station</h1>
        <div className="flex items-center gap-3">
          <HeaderDate />
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

      {/* Dashboard grid */}
      <main className="flex-1 min-h-0 px-6 pb-6">
        <GridRenderer layout={layout} ctx={ctx} />
      </main>

      {/* Action feedback toast */}
      {(actionStatus === 'success' || actionStatus === 'error') && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-6 z-[110]">
          <div className={`px-8 py-4 rounded-2xl border-2 text-center shadow-2xl ${
            actionStatus === 'success' ? 'bg-emerald-900/90 border-emerald-600' : 'bg-red-900/90 border-red-600'
          }`}>
            <p className={`text-xl font-bold ${actionStatus === 'success' ? 'text-emerald-300' : 'text-red-300'}`}>
              {actionStatus === 'success' ? 'Command sent successfully' : (actionError ?? 'Command failed')}
            </p>
          </div>
        </div>
      )}

      {/* Control modals */}
      {modal?.type === 'door' && (
        <DoorControlModal
          name={modal.name}
          stateInt={modalDoorState}
          error={modalError}
          secureLabel={modal.secureLabel}
          busy={busy}
          onOpen={() => runFlow(
            () => controlDoor(modal.id, 'Open'),
            () => flashStatus(modal.id, { label: 'Opened', icon: DoorOpen, severity: 'open' }),
          )}
          onHold={() => runFlow(
            () => controlDoor(modal.id, 'Unlock'),
            () => flashStatus(modal.id, { label: 'Held Open', icon: LockOpen, severity: 'unlocked' }),
          )}
          onReinstate={() => runFlow(
            () => controlDoor(modal.id, 'Reinstate'),
            () => flashStatus(modal.id, { label: modal.secureLabel ?? 'Locked', icon: Lock, severity: 'normal' }),
          )}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'area' && (
        <AreaControlModal
          name={modal.name}
          stateInt={modalAreaState}
          error={modalError}
          busy={busy}
          onArm={() => runFlow(
            () => setShedAlarm(true),
            () => flashStatus(modal.id, { label: 'Armed', icon: ShieldAlert, severity: 'alert' }),
          )}
          onDisarm={() => runFlow(
            () => setShedAlarm(false),
            () => flashStatus(modal.id, { label: 'Disarmed', icon: LockOpen, severity: 'open' }),
          )}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirm dialog (lockup) */}
      {confirm && (
        <ConfirmDialog
          config={confirm}
          onConfirm={() => runFlow(confirm.run)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Header clock ────────────────────────────────────────────────────────────

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// 24-hour HH:MM, self-updating so the host doesn't re-render on the tick.
function HeaderTime() {
  const now = useNow(1000);
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return <span className="text-2xl md:text-3xl font-bold tabular-nums text-white">{hh}:{mm}</span>;
}

// e.g. "22 Jun" - day then shorthand month.
function HeaderDate() {
  const now = useNow(60_000);
  const day = now.getDate();
  const month = now.toLocaleString('en-AU', { month: 'short' });
  return <span className="text-2xl md:text-3xl font-bold text-white">{day} {month}</span>;
}
