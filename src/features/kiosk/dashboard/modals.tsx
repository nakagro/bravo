// Control modals + the confirm dialog. A status tile opens a control modal; the
// actions inside execute directly (the modal IS the deliberate step). Firecall
// and scene toggles, which are one tap from the home screen, use ConfirmDialog
// instead.

import { X, AlertTriangle } from 'lucide-react';
import {
  interpretState, interpretArea,
  SEVERITY_ICON_COLOR, SEVERITY_RING,
} from './gateApi';

const TONE: Record<'amber' | 'red' | 'slate', string> = {
  amber: 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700',
  red:   'bg-red-600 hover:bg-red-500 active:bg-red-700',
  slate: 'bg-slate-600 hover:bg-slate-500 active:bg-slate-700',
};

function ModalShell({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="bg-slate-900 border-4 border-slate-700 rounded-[2rem] w-full max-w-2xl p-8 flex flex-col gap-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 active:bg-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-7 w-7" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Live state banner shared by both control modals.
function StateBanner({ icon: Icon, label, sub, tone, error }: {
  icon: React.ElementType; label: string; sub: string;
  tone: 'normal' | 'open' | 'unlocked' | 'warning' | 'alert'; error: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-slate-950/60 border border-slate-800 p-4">
      <div className={`flex-none flex items-center justify-center w-16 h-16 rounded-full border-4 bg-slate-950 ${error ? SEVERITY_RING.alert : SEVERITY_RING[tone]}`}>
        <Icon className={`h-8 w-8 ${error ? SEVERITY_ICON_COLOR.alert : SEVERITY_ICON_COLOR[tone]}`} />
      </div>
      <div className="min-w-0">
        <p className={`text-2xl font-bold ${error ? SEVERITY_ICON_COLOR.alert : SEVERITY_ICON_COLOR[tone]}`}>
          {error ? 'Offline' : label}
        </p>
        <p className="text-base text-slate-400">{error ? 'Cannot reach the controller' : sub}</p>
      </div>
    </div>
  );
}

function ActionButton({ label, tone, disabled, onClick }: {
  label: string; tone: 'amber' | 'red' | 'slate'; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-6 rounded-2xl text-white text-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${TONE[tone]}`}
    >
      {label}
    </button>
  );
}

// ── Door control ─────────────────────────────────────────────────────────────

export function DoorControlModal({
  name, stateInt, error, secureLabel, busy, onOpen, onHold, onReinstate, onClose,
}: {
  name: string; stateInt: number | null; error: boolean; secureLabel?: string; busy: boolean;
  onOpen: () => void; onHold: () => void; onReinstate: () => void; onClose: () => void;
}) {
  const info = stateInt !== null ? interpretState(stateInt) : null;
  // Override the resting/locked label for things like the boom gate ("Closed").
  const label = info && secureLabel && info.label === 'Secured' ? secureLabel : info?.label;
  return (
    <ModalShell title={name} onClose={onClose}>
      <StateBanner
        icon={error || !info ? AlertTriangle : info.icon}
        label={label ?? '…'}
        sub={info?.sub ?? 'Reading state…'}
        tone={info?.severity ?? 'normal'}
        error={error}
      />
      <button
        onClick={onOpen}
        disabled={busy}
        className="w-full py-8 rounded-2xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-3xl font-bold tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
      >
        Open
      </button>
      <div className="flex gap-4">
        <ActionButton label="Hold Open" tone="slate" disabled={busy} onClick={onHold} />
        <ActionButton label="Lock" tone="slate" disabled={busy} onClick={onReinstate} />
      </div>
    </ModalShell>
  );
}

// ── Alarm (area) control ─────────────────────────────────────────────────────

export function AreaControlModal({
  name, stateInt, error, busy, onArm, onDisarm, onClose,
}: {
  name: string; stateInt: number | null; error: boolean; busy: boolean;
  onArm: () => void; onDisarm: () => void; onClose: () => void;
}) {
  const info = stateInt !== null ? interpretArea(stateInt) : null;
  return (
    <ModalShell title={name} onClose={onClose}>
      <StateBanner
        icon={error || !info ? AlertTriangle : info.icon}
        label={info?.label ?? '…'}
        sub={info ? (info.armed ? 'Shed alarm is armed' : 'Shed alarm is off') : 'Reading state…'}
        tone={info?.severity ?? 'normal'}
        error={error}
      />
      <div className="flex gap-4">
        <ActionButton label="Disarm" tone="amber" disabled={busy} onClick={onDisarm} />
        <ActionButton label="Arm" tone="slate" disabled={busy} onClick={onArm} />
      </div>
    </ModalShell>
  );
}

// ── Confirm dialog (Firecall / scene toggles) ────────────────────────────────

export interface ConfirmConfig {
  title: string;
  body: string;
  confirmLabel: string;
  confirmTone: 'amber' | 'red' | 'slate';
  run: () => Promise<unknown>;
}

export function ConfirmDialog({
  config, onConfirm, onCancel,
}: { config: ConfirmConfig; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="bg-slate-900 border-4 border-slate-700 rounded-[2rem] w-full max-w-xl p-8 flex flex-col gap-6 shadow-2xl">
        <h2 className="text-3xl font-bold text-white text-center">{config.title}</h2>
        <p className="text-xl text-slate-400 text-center leading-snug">{config.body}</p>
        <div className="flex gap-4 mt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-bold transition-colors active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-[2] py-5 rounded-2xl text-white text-2xl font-bold transition-colors active:scale-[0.98] ${TONE[config.confirmTone]}`}
          >
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
