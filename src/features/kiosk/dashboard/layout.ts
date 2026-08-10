// Layout-as-data for the kiosk dashboard.
//
// Widgets describe WHAT; PlacedWidget describes WHERE (GridStack-style x/y/w/h
// cells on a 12-column grid). The renderer is the only thing that knows both.
// Authoring the default layout in GridStack coordinates now means Phase 2 can
// feed this exact array to GridStack, and Phase 3 can swap the source of this
// array from a constant to a Convex query - without changing any widget.
// See docs/KIOSK_DASHBOARD_PLAN.md.

import { MapPin, BookOpen } from 'lucide-react';
import { FaMaskVentilator } from 'react-icons/fa6';
import { GATE_DOOR_ID, TURNOUT_DOOR_ID, SHED_DOOR_ID, SHED_AREA_ID } from './gateApi';
import type { NavIcon } from './widgets';

// Full-screen views the kiosk can launch from the dashboard (handled by KioskPage).
export type KioskOverlay = 'appliance-locations' | 'contact-directory' | 'ba-usage';

export type WidgetSpec =
  // `secureLabel` overrides the word shown for the locked/resting state (e.g. a
  // boom gate reads "Closed" rather than "Secured").
  | { kind: 'doorStatus'; doorId: string; name: string; secureLabel?: string }
  | { kind: 'areaStatus'; areaId: string; name: string }
  | { kind: 'firecall' }
  | { kind: 'sceneToggle'; scene: 'communityLockup' }
  | { kind: 'nav'; target: KioskOverlay; title: string; icon: NavIcon };

export interface PlacedWidget {
  /** Stable key - also the future persistence key. */
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  widget: WidgetSpec;
}

export const GRID_COLS = 12;
/** Number of cell-rows the default layout occupies (drives row height). */
export const GRID_ROWS = 6;

// Default dashboard: 4 status tiles (row 0–1), Firecall hero (row 2–3),
// and the bottom section of 4 - Appliances, Contacts, Community Lockup, BA Usage (row 4–5).
export const DEFAULT_LAYOUT: PlacedWidget[] = [
  { id: 'gate',      x: 0, y: 0, w: 3, h: 2, widget: { kind: 'doorStatus', doorId: GATE_DOOR_ID,    name: 'Carpark Gate' } },
  { id: 'turnout',   x: 3, y: 0, w: 3, h: 2, widget: { kind: 'doorStatus', doorId: TURNOUT_DOOR_ID, name: 'Turnout Entry' } },
  { id: 'shed-door', x: 6, y: 0, w: 3, h: 2, widget: { kind: 'doorStatus', doorId: SHED_DOOR_ID,    name: 'Shed Door' } },
  { id: 'shed-alarm',x: 9, y: 0, w: 3, h: 2, widget: { kind: 'areaStatus', areaId: SHED_AREA_ID,    name: 'Shed Alarm' } },

  { id: 'firecall',  x: 0, y: 2, w: 12, h: 2, widget: { kind: 'firecall' } },

  { id: 'appliances',x: 0, y: 4, w: 3, h: 2, widget: { kind: 'nav', target: 'appliance-locations', title: 'Appliance Locations', icon: MapPin } },
  { id: 'contacts',  x: 3, y: 4, w: 3, h: 2, widget: { kind: 'nav', target: 'contact-directory',   title: 'D14 Contact List',   icon: BookOpen } },
  { id: 'lockup',    x: 6, y: 4, w: 3, h: 2, widget: { kind: 'sceneToggle', scene: 'communityLockup' } },
  { id: 'ba-usage',  x: 9, y: 4, w: 3, h: 2, widget: { kind: 'nav', target: 'ba-usage', title: 'Log BA Usage', icon: FaMaskVentilator } },
];
