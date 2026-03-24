# Duty Crew Module Overhaul Plan

## Context
The Duty Crew module (`src/components/dutyCrew/`) is visually inconsistent with the rest of the app and uses the old component structure instead of the feature-driven architecture. It has 5 tabs (3 admin-only), a 28KB monolith component, and lacks mobile optimization. This overhaul modernizes it to match modules like Availability and Equipment, adds ad-hoc check items for crew leaders, and makes it mobile-first for firefighters walking around the station.

---

## New Tab Structure (3 tabs, down from 5)

| Tab | Visible To | Purpose |
|-----|-----------|---------|
| **This Week** (default) | All | Hero banner with current crew + interactive station checks checklist |
| **Schedule** | All | Forward-looking view of upcoming 8 Sundays with crew assignments |
| **Admin** | Admin only | Accordion with 3 sections: Crew Management, Check Templates, Check History |

---

## Key Design Decisions

### 1. "This Week" Tab — The Main Event
- **Hero Banner** (`DutyCrewHero.tsx`): Crew name, leader, member list, `ProgressRing` showing check completion (e.g. 6/10), status badge (Not Started / In Progress / Completed), week navigation arrows
- **5th Sunday variant**: Amber/yellow hero with "Working Bee — All Crews" messaging
- **Station Checks** (`StationChecksList.tsx`): Full-width tappable rows (min 56px height), auto-save on every tap, notes via Drawer (mobile) / Sheet (desktop)
- **Ad-hoc items**: Visually distinct section below template checks. Leaders tap "+" to add free-text items for their week. Stored with `isAdHoc: true` flag
- **Submit button**: Always visible, disabled state shows "X remaining". Pulses when all items checked
- **General notes**: Textarea at the bottom of the checklist for overall submission notes (existing feature, must preserve)
- **Per-item attribution**: Each checked item shows who completed it (small initials + timestamp) for accountability — data already exists in schema (`completedBy`, `completedAt`)
- **Reopen flow**: "Reopen" button on hero banner (admin/leader only) flips status back to draft. Show confirmation Dialog before reopening

### 2. Schedule Tab
- **Admin override**: Admins see an edit icon on each `ScheduleCard` to swap assigned crew or mark a Sunday as special (uses existing `assignDutyCrew` mutation)
- Card grid of upcoming 8 Sundays (`ScheduleCard.tsx`)
- Each card shows date, crew name, leader, member count
- 5th Sunday cards get amber accent + working bee label
- Matches the deployment view card grid pattern from Availability
- Admin override: admins see edit button on each card to reassign crew or mark special

### 3. Admin Tab (Consolidated)
Single tab with 3 Accordion sections:
- **Crew Management** — CRUD crews, manage members, set leaders (refactored from `DutyCrewAdmin.tsx`)
- **Check Templates** — Ordered list with active/inactive toggle, add/edit/reorder (refactored from `StationChecksAdmin.tsx`)
- **Check History** — Filter by crew, expandable submission details (refactored from `StationChecksHistory.tsx`)

---

## 5th Sunday (Working Bee) Workflow
On a 5th Sunday, all crews come in. For station checks:
- The hero banner shows amber/yellow "Working Bee — All Crews" variant
- Each duty crew can submit their own checks independently (separate submissions per crew)
- The "This Week" tab shows a crew selector at the top so members can pick which crew's checklist to work on
- If a user belongs to a specific crew, that crew is pre-selected

---

## Empty & Loading States
Every view needs graceful handling of missing data:
- **No duty crews configured**: Friendly message with CTA for admins ("Set up your first duty crew in the Admin tab")
- **No check templates**: "No station checks configured yet — ask an admin to add some"
- **No submission for current week**: Show the checklist in "Not Started" state with all items unchecked
- **Loading**: Skeleton cards/rows while Convex queries resolve (use `animate-pulse` placeholder blocks matching the card patterns used elsewhere)

---

## Push Notifications (Future Enhancement)
The app already has a VAPID-based push notification system. Consider adding:
- **Sunday morning reminder**: Notify duty crew members that it's their week and checks are due
- **Completion notification**: Notify the crew leader when all checks are submitted
- This can be a follow-up phase after the core overhaul is complete

---

## File Structure

```
src/features/dutyCrew/
├── components/
│   ├── index.ts
│   ├── DutyCrewHero.tsx           # Hero banner + ProgressRing + week nav
│   ├── ThisWeekTab.tsx            # Composes Hero + StationChecksList
│   ├── StationChecksList.tsx      # Mobile-first checklist with ad-hoc section
│   ├── StationCheckItem.tsx       # Single tappable check row
│   ├── AdHocCheckInput.tsx        # Drawer/Sheet for adding ad-hoc items
│   ├── ScheduleTab.tsx            # 8-week forward calendar
│   ├── ScheduleCard.tsx           # Single Sunday card
│   ├── AdminTab.tsx               # Accordion wrapper
│   ├── CrewManagementSection.tsx   # From DutyCrewAdmin
│   ├── CheckTemplatesSection.tsx   # From StationChecksAdmin
│   └── CheckHistorySection.tsx     # From StationChecksHistory
└── types.ts
```

`src/pages/DutyCrewPage.tsx` stays as the route entry point but imports from `src/features/dutyCrew/components`.

---

## Backend Changes

### Schema (`convex/schema.ts`)
Update `stationCheckSubmissions.checkItems` array:
- `checkId` → `v.optional(v.id("stationChecks"))` (was required)
- Add `isAdHoc: v.optional(v.boolean())`
- Add `addedBy: v.optional(v.id("users"))`

### Mutations (`convex/stationChecks.ts`)
- Update `saveDraftStationCheck` and `submitStationCheck` validators to accept optional `checkId`
- Update submit validation to handle ad-hoc items (no template to verify against)

### New Query (`convex/dutyCrew.ts`)
- `isCurrentUserDutyCrewLeader(dutyCrewId)` → boolean, checks if authenticated user is leader

---

## Implementation Order

### Phase 1: Feature module + new components
1. Create `src/features/dutyCrew/` directory and `types.ts`
2. Build `DutyCrewHero.tsx` with ProgressRing integration
3. Build `StationCheckItem.tsx` (single row)
4. Build `StationChecksList.tsx` (composes items + ad-hoc section)
5. Build `ThisWeekTab.tsx` (composes hero + checks list)
6. Build `ScheduleCard.tsx` and `ScheduleTab.tsx`
7. Build `AdminTab.tsx` with 3 accordion sections (refactor existing admin components)
8. Create barrel `index.ts`

### Phase 2: Backend changes for ad-hoc items
9. Update schema for optional checkId + isAdHoc fields
10. Update station check mutations
11. Add `isCurrentUserDutyCrewLeader` query

### Phase 3: Wire up + cleanup
12. Rewrite `src/pages/DutyCrewPage.tsx` to 3-tab structure importing from feature module
13. Delete old `src/components/dutyCrew/` directory

---

## Visual Patterns to Apply

These are the established patterns from the rest of the app — follow them for consistency:

- **Cards**: `bg-white dark:bg-gray-800 shadow-sm rounded-lg p-3`
- **Status badges**: green (complete), yellow (in-progress), gray (not started)
- **Left border accents**: `border-l-4` on section headers
- **Mobile**: Drawer (bottom) for modals, `useIsMobile()` hook from `@/hooks/use-mobile`, min 56px touch targets
- **Icons**: lucide-react, `h-4 w-4` to `h-5 w-5`
- **Toasts**: `toast()` from sonner (replace all `alert()` calls)
- **Tab indicator**: Animated red underline matching Availability/Equipment pages
- **Dark mode**: Every `bg-*` gets a `dark:bg-*` pair, every `text-*` gets `dark:text-*`
- **Responsive**: Drawer on mobile, Sheet on desktop for overlays

## Key Imports Reference

```typescript
// UI Components
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

// Custom Components
import { ProgressRing } from "@/components/common/ProgressRing";

// Utilities
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Backend
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
```

## Existing Backend Functions to Reuse

### `convex/dutyCrew.ts`
- `getAllDutyCrews()` — fetch all crews
- `getDutyCrewForDate(date)` — find crew for a specific Sunday (checks manual schedule, falls back to auto-assignment)
- `getUpcomingDutyCrewAssignments(count)` — next N Sundays with assigned crews
- `assignDutyCrew(date, dutyCrewId, isSpecial, notes)` — manual override
- `deleteAssignment(id)` — remove manual assignment

### `convex/dutyCrewMembers.ts`
- `getDutyCrewMembers(dutyCrewId)` — detailed member info sorted by rank

### `convex/stationChecks.ts`
- `getAllStationChecks(includeInactive)` — check templates
- `getCurrentWeekCheckStatus(dutyCrewId?, date?)` — current submission status
- `saveDraftStationCheck(...)` — auto-save draft
- `submitStationCheck(...)` — mark complete
- `reopenStationCheck(submissionId)` — reopen for editing
- `getStationCheckHistory(dutyCrewId, limit)` — past submissions

## Verification Checklist
- [ ] `npm run lint` — TypeScript check passes
- [ ] Visual check on mobile viewport (Chrome DevTools) — all touch targets ≥ 48px
- [ ] Test station checks workflow: open → check items → auto-save → add ad-hoc item → submit
- [ ] Test admin accordion sections: crew CRUD, template CRUD, history filtering
- [ ] Test 5th Sunday display in schedule and hero (working bee variant)
- [ ] Test 5th Sunday crew selector — each crew submits independently
- [ ] Verify dark mode throughout all new components
- [ ] Test week navigation in "This Week" tab
- [ ] Test leader permissions for ad-hoc items (non-leaders should not see "+" button)
- [ ] Test reopen flow — admin/leader reopens completed submission, confirm dialog shown
- [ ] Test schedule override — admin swaps crew on a ScheduleCard
- [ ] Test per-item attribution — check items show who completed them
- [ ] Test general notes — textarea at bottom of checklist saves/loads correctly
- [ ] Test empty states — no crews, no templates, no submission scenarios
- [ ] Test loading states — skeleton placeholders appear while queries resolve
