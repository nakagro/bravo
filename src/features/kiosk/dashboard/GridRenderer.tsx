// Thin renderer: the ONLY thing that knows both the layout (where) and the
// widget registry (what). Places each PlacedWidget on a CSS grid using its
// GridStack-style x/y/w/h cells. Phase 2 swaps this for GridStack, feeding it
// the same PlacedWidget[]; nothing else changes.

import { interpretState, interpretArea } from './gateApi';
import { type PlacedWidget, GRID_COLS, GRID_ROWS, type KioskOverlay } from './layout';
import { StatusTile, FirecallHero, SceneToggleTile, NavTile, type ResolvedState } from './widgets';

// Everything a widget might need from the host. Implemented by KioskDashboard.
export interface DashboardContext {
  doorState: (id: string) => number | null;
  areaState: (id: string) => number | null;
  hasError: (id: string) => boolean;
  scenesReady: boolean;
  lockupEngaged: boolean;
  firecallActive: boolean;
  firecallRemaining: number;
  busy: boolean;
  openDoorControl: (doorId: string, name: string) => void;
  openAreaControl: (areaId: string, name: string) => void;
  toggleFirecall: () => void;
  toggleLockup: () => void;
  navigate: (target: KioskOverlay) => void;
}

function renderWidget(p: PlacedWidget, ctx: DashboardContext) {
  switch (p.widget.kind) {
    case 'doorStatus': {
      const { doorId, name } = p.widget;
      const s = ctx.doorState(doorId);
      const info: ResolvedState | null = s !== null ? interpretState(s) : null;
      return (
        <StatusTile
          name={name}
          info={info}
          error={ctx.hasError(doorId)}
          onClick={() => ctx.openDoorControl(doorId, name)}
        />
      );
    }
    case 'areaStatus': {
      const { areaId, name } = p.widget;
      const s = ctx.areaState(areaId);
      const info: ResolvedState | null = s !== null ? interpretArea(s) : null;
      return (
        <StatusTile
          name={name}
          info={info}
          error={ctx.hasError(areaId)}
          onClick={() => ctx.openAreaControl(areaId, name)}
        />
      );
    }
    case 'firecall':
      return (
        <FirecallHero
          active={ctx.firecallActive}
          remaining={ctx.firecallRemaining}
          disabled={ctx.busy || !ctx.scenesReady}
          onPress={ctx.toggleFirecall}
        />
      );
    case 'sceneToggle':
      return (
        <SceneToggleTile
          label="Community Lockup"
          activeLabel="Lockup Active — Tap to End"
          sub="Engine &amp; ops-room doors on normal schedule"
          activeSub="Engine &amp; ops-room doors locked to the public"
          active={ctx.lockupEngaged}
          disabled={ctx.busy || !ctx.scenesReady}
          onPress={ctx.toggleLockup}
        />
      );
    case 'nav': {
      const { title, icon, target } = p.widget;
      return <NavTile title={title} icon={icon} onClick={() => ctx.navigate(target)} />;
    }
  }
}

export function GridRenderer({ layout, ctx }: { layout: PlacedWidget[]; ctx: DashboardContext }) {
  return (
    <div
      className="h-full w-full grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
      }}
    >
      {layout.map((p) => (
        <div
          key={p.id}
          className="min-h-0 min-w-0"
          style={{ gridColumn: `${p.x + 1} / span ${p.w}`, gridRow: `${p.y + 1} / span ${p.h}` }}
        >
          {renderWidget(p, ctx)}
        </div>
      ))}
    </div>
  );
}
