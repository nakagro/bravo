// Self-contained dashboard widgets. Each knows how to render itself and fire a
// callback; none of them know where they sit on the grid (that's the renderer's
// job) or how the data is fetched (that's the host's job). Adding a new widget
// kind = a new component here + a case in GridRenderer + an entry in WidgetSpec.

import { AlertTriangle, Flame, type LucideIcon } from 'lucide-react';
import { type Severity, SEVERITY_ICON_COLOR, SEVERITY_RING, formatRemaining } from './gateApi';

export interface ResolvedState {
  label: string;
  icon: LucideIcon;
  severity: Severity;
}

// A live status tile — tap opens the matching control modal. Used for both
// doors and the alarm area; both resolve to { label, icon, severity }.
export function StatusTile({
  name, info, error, onClick,
}: { name: string; info: ResolvedState | null; error: boolean; onClick: () => void }) {
  const Icon = error ? AlertTriangle : info?.icon;
  const tone: Severity = error ? 'alert' : info?.severity ?? 'normal';
  return (
    <button
      onClick={onClick}
      className="h-full w-full flex flex-col items-center justify-center gap-3 rounded-3xl bg-slate-900 border border-slate-800 hover:bg-slate-800 active:bg-slate-800/70 transition-all active:scale-[0.98] p-3 text-center"
    >
      <div className={`flex-none flex items-center justify-center w-16 h-16 rounded-full border-4 bg-slate-950 ${error || info ? SEVERITY_RING[tone] : 'border-slate-700'}`}>
        {Icon ? (
          <Icon className={`h-8 w-8 ${SEVERITY_ICON_COLOR[tone]}`} />
        ) : (
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-600 border-t-slate-300" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 truncate">{name}</p>
        <p className={`text-2xl font-bold truncate ${error || info ? SEVERITY_ICON_COLOR[tone] : 'text-slate-400'}`}>
          {error ? 'Offline' : info ? info.label : '…'}
        </p>
      </div>
    </button>
  );
}

// The Firecall hero — one tap from the dashboard (confirmed by the host).
export function FirecallHero({
  active, remaining, disabled, onPress,
}: { active: boolean; remaining: number; disabled: boolean; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className={`h-full w-full rounded-3xl border-2 shadow-xl transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-red-700/40 border-red-500 hover:bg-red-700/60 animate-pulse'
          : 'bg-red-600 border-transparent hover:bg-red-500 active:bg-red-700'
      }`}
    >
      {active ? (
        <div className="flex items-center justify-center gap-6 md:gap-10 text-white">
          <span className="flex items-center gap-3 text-3xl md:text-4xl font-bold">
            <Flame className="h-10 w-10 flex-none" />
            Firecall Active
          </span>
          <span className="text-6xl font-mono font-bold tabular-nums tracking-tight">
            {formatRemaining(remaining)}
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
  );
}

// A station-wide scene toggle (currently just Community Lockup).
export function SceneToggleTile({
  label, activeLabel, sub, activeSub, active, disabled, onPress,
}: {
  label: string; activeLabel: string; sub: string; activeSub: string;
  active: boolean; disabled: boolean; onPress: () => void;
}) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className={`h-full w-full rounded-3xl border-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-amber-700/40 border-amber-500 hover:bg-amber-700/60'
          : 'bg-slate-700 border-transparent hover:bg-slate-600 active:bg-slate-500'
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-1 px-4 text-center text-white">
        <span className="flex items-center gap-3 text-2xl font-bold">
          {active && <span className="h-3 w-3 flex-none rounded-full bg-amber-400 animate-pulse" />}
          {active ? activeLabel : label}
        </span>
        <span className="text-sm font-semibold text-slate-300/80">{active ? activeSub : sub}</span>
      </div>
    </button>
  );
}

// Launches a full-screen kiosk view (handled by KioskPage).
export function NavTile({
  title, icon: Icon, onClick,
}: { title: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-full w-full flex flex-col items-center justify-center gap-3 rounded-3xl bg-slate-800 border border-slate-700 hover:bg-slate-700 active:bg-slate-600 transition-all active:scale-[0.98] p-4 text-center"
    >
      <Icon className="h-12 w-12 text-sky-400" />
      <span className="text-2xl md:text-3xl font-bold text-white leading-tight">{title}</span>
    </button>
  );
}
