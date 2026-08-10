# Vehicle Faults Module Overhaul Plan

## Context
The Vehicle Faults module (`src/components/vehicleFaults/`) uses the old directory structure, a Dialog-based detail view (instead of the Sheet/Drawer pattern used by keys/hoses), duplicates shared components, and lacks photo attachment support. This overhaul migrates it to the feature-driven architecture, adopts shared components, adds configurable vehicle types, photo attachments, and responsive mobile layouts.

---

## Key Changes Summary

| Area | Current | After |
|------|---------|-------|
| Directory | `src/components/vehicleFaults/` | `src/features/vehicleFaults/` |
| Detail view | Centered Dialog (600 lines, view+edit) | Sheet/Drawer split into DetailPanel + Form |
| Search | Custom inline | `InventorySearch` shared component |
| View toggle | Custom inline | `ViewModeToggle` shared component (+ localStorage) |
| Empty state | Custom inline | `EmptyState` shared component |
| Table headers | Custom sort logic | `SortableTableHeader` shared component |
| Vehicle types | Hardcoded Pumper/Tanker/FCV | Admin-configurable via new table |
| Attachments | None | Photo/file uploads via Convex storage |
| Filter state | Lost on navigation | Persisted via `useSearchParams` |
| Mobile | No adaptation | `useIsMobile()` → Drawer on mobile, Sheet/Dialog on desktop |
| Type config | Inline in page | Extracted to `types.ts` |

---

## New File Structure

```
src/features/vehicleFaults/
├── types.ts                           # Status/priority colors, type definitions, config
├── components/
│   ├── index.ts                       # Barrel exports
│   ├── VehicleFaultInventory.tsx      # Main list: tabs, filters, cards/table
│   ├── VehicleFaultDetailPanel.tsx    # Read-only Sheet/Drawer detail view
│   ├── VehicleFaultForm.tsx           # Add + edit (Dialog/Drawer)
│   ├── VehicleFaultCards.tsx          # Card grid view (refactored)
│   ├── VehicleFaultTable.tsx          # Table view (adopt SortableTableHeader)
│   ├── VehicleFaultComments.tsx       # Comments section (cleanup)
│   ├── VehicleFaultHistory.tsx        # Per-fault change history (collapsible)
│   ├── VehicleFaultAuditTrail.tsx     # Global audit tab (moved)
│   └── VehicleFaultAttachments.tsx    # NEW: upload + thumbnail grid

src/pages/VehicleFaultsPage.tsx        # Simplified to thin wrapper
```

---

## Component Breakdown

### `types.ts`
Extract from inline definitions in the current page:
- `statusColors`, `statusBorderColors`, `priorityColors` maps
- `statusLabels` map (pending_dmo → "Pending - DMO", etc.)
- `statusIcons` map (Clock, AlertTriangle, CheckCircle)
- `Status`, `Priority` type aliases
- Tab config array

### `VehicleFaultInventory.tsx` (~200 lines)
Main list orchestrator:
- 2 tabs: Faults | Audit (animated red underline indicator)
- `useSearchParams` for filter state persistence (search, status, vehicle, priority)
- `InventorySearch` shared component for debounced search
- `ViewModeToggle` shared component for cards/table
- Dynamic vehicle type filter from `vehicleFaultVehicleTypes` query
- Add button → opens `VehicleFaultForm` in create mode
- Fault click → opens `VehicleFaultDetailPanel`
- `EmptyState` shared component for no-results

### `VehicleFaultDetailPanel.tsx` (~250 lines)
Read-only detail view (replaces view mode of old 600-line Detail):
- **Desktop**: `Sheet` (side panel, max-w-lg)
- **Mobile**: `Drawer` (h-[92vh], from bottom)
- Sticky header with status badge, priority dot, vehicle name
- Sections: Details, Attachments (thumbnails), Comments (collapsible), History (collapsible)
- Footer with Edit button → opens `VehicleFaultForm` in edit mode
- Delete button → `DeleteConfirmDialog`

### `VehicleFaultForm.tsx` (~200 lines)
Create + edit form (replaces AddDialog + edit mode of Detail):
- **Desktop**: `Dialog`
- **Mobile**: `Drawer`
- Vehicle select populated dynamically from `vehicleFaultVehicleTypes` query
- Status select shows all options (flexible transitions, not restricted)
- Priority select (low/medium/high)
- Date fields, EAM number, descriptions, notes
- Attachment upload in edit mode (reuses `VehicleFaultAttachments`)
- Auto-sets `dateLogged` when moving to `pending_wydv`

### `VehicleFaultCards.tsx` (~150 lines)
Refactored card view:
- Add first attachment as thumbnail preview
- Import colors from `types.ts` instead of inline
- Left border color by status (matching current pattern)

### `VehicleFaultTable.tsx` (~180 lines)
Refactored table view:
- Adopt `SortableTableHeader` shared component
- Add attachment count column (paperclip icon + count)
- Import colors from `types.ts`

### `VehicleFaultAttachments.tsx` (~150 lines) - NEW
Photo/file attachment component:
- Upload button using `generateUploadUrl` pattern (same as inventory templates)
- Accept `image/*` and `application/pdf`
- Thumbnail grid for images, file icon for PDFs
- Click thumbnail to view full size (Dialog with image)
- Delete button per attachment (with confirmation)
- Two modes: `view` (in DetailPanel) and `edit` (in Form)

### `VehicleFaultComments.tsx` (~170 lines)
Minor cleanup of existing component - mostly reusable as-is.

### `VehicleFaultHistory.tsx` (~100 lines)
Per-fault change history, extracted as standalone collapsible section:
- Queries `vehicleFaultHistory` by faultId
- Color-coded change type badges
- Before/after value display

### `VehicleFaultAuditTrail.tsx` (~230 lines)
Global audit tab - move as-is from old directory.

---

## Backend Changes

### Schema (`convex/schema.ts`)

**Modify `vehicleFaults` table:**
- Change `vehicle` from `v.union(v.literal("Pumper"), v.literal("Tanker"), v.literal("FCV"))` to `v.string()`

**Add `vehicleFaultVehicleTypes` table:**
```typescript
vehicleFaultVehicleTypes: defineTable({
  name: v.string(),
  isActive: v.boolean(),
  order: v.number(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_order", ["order"])
  .index("by_active", ["isActive", "order"])
```

**Add `vehicleFaultAttachments` table:**
```typescript
vehicleFaultAttachments: defineTable({
  faultId: v.id("vehicleFaults"),
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileType: v.string(),
  uploadedBy: v.id("users"),
  uploadedAt: v.number(),
})
  .index("by_fault", ["faultId"])
```

### New file: `convex/vehicleFaultVehicleTypes.ts`
- `getVehicleTypes` query - returns active types ordered by `order`
- `addVehicleType` mutation - admin only
- `updateVehicleType` mutation - admin only (rename/reorder/deactivate)
- `deleteVehicleType` mutation - admin only, soft delete (isActive=false) if used by existing faults

### Modified: `convex/vehicleFaults.ts`
- Relax `vehicle` validators from union to `v.string()` in all mutations
- Add `generateUploadUrl` mutation (auth-gated, same pattern as `convex/inventoryTemplates.ts`)
- Add `getAttachments(faultId)` query - returns attachments with storage URLs
- Add `addAttachment(faultId, storageId, fileName, fileType)` mutation
- Add `deleteAttachment(attachmentId)` mutation - deletes from `_storage` and table

---

## Shared Components to Adopt

| Component | File | Replaces |
|-----------|------|----------|
| `InventorySearch` | `src/components/shared/InventorySearch.tsx` | Custom search input in page |
| `ViewModeToggle` | `src/components/shared/ViewModeToggle.tsx` | Custom cards/table toggle (adds localStorage) |
| `EmptyState` | `src/components/shared/EmptyState.tsx` | Custom inline empty state |
| `SortableTableHeader` | `src/components/shared/SortableTableHeader.tsx` | Custom sort logic in table |
| `DeleteConfirmDialog` | `src/components/shared/DeleteConfirmDialog.tsx` | Inline AlertDialog in detail |

---

## Admin UI for Vehicle Types

Add a vehicle type management section. Options:
- **Option A**: Add to an existing admin page as a section
- **Option B**: Add as a settings section within the Vehicle Faults module (gear icon → Sheet/Drawer with type list)

Recommend **Option B** - a gear icon in the inventory toolbar (visible to admins) opens a Sheet with:
- List of vehicle types with drag/reorder or up/down arrows
- Add new type (inline input + add button)
- Toggle active/inactive
- Keeps it self-contained within the module

---

## Implementation Order

### Phase 1: Backend foundation (no frontend breakage)
1. Add `vehicleFaultVehicleTypes` and `vehicleFaultAttachments` tables to schema
2. Change `vehicle` field from union to `v.string()` in schema + validators
3. Create `convex/vehicleFaultVehicleTypes.ts` with CRUD
4. Add attachment endpoints to `convex/vehicleFaults.ts`
5. Seed Pumper, Tanker, FCV into `vehicleFaultVehicleTypes`

### Phase 2: Feature module + types
6. Create `src/features/vehicleFaults/types.ts`
7. Create `VehicleFaultAttachments.tsx` (new component)
8. Create `VehicleFaultDetailPanel.tsx` (Sheet/Drawer, replaces Dialog detail view)
9. Create `VehicleFaultForm.tsx` (Dialog/Drawer, replaces AddDialog + edit mode)
10. Create `VehicleFaultHistory.tsx` (per-fault, extracted from old Detail)

### Phase 3: Adopt shared components
11. Refactor `VehicleFaultTable.tsx` with `SortableTableHeader`
12. Refactor `VehicleFaultCards.tsx` with thumbnail support
13. Move `VehicleFaultComments.tsx` (minor cleanup)
14. Move `VehicleFaultAuditTrail.tsx` (as-is)

### Phase 4: Wire up + admin
15. Create `VehicleFaultInventory.tsx` with shared components + useSearchParams
16. Add vehicle type admin UI (gear icon → Sheet)
17. Create barrel `index.ts`
18. Simplify `src/pages/VehicleFaultsPage.tsx` to thin wrapper
19. Delete old `src/components/vehicleFaults/` directory

---

## Visual Patterns to Apply

Same patterns as keys/hoses for consistency:
- **Detail panel**: Sticky header/footer, scrollable content, collapsible sections
- **Cards**: Left border accent by status, responsive grid (`grid-cols-1 sm:2 md:3 lg:4`)
- **Status badges**: `bg-yellow-100 text-yellow-800` (pending), `bg-blue-100 text-blue-800` (wydv), `bg-green-100 text-green-800` (resolved)
- **Priority dots**: colored circle indicator (gray/orange/red)
- **Dark mode**: Full `dark:` variant coverage
- **Mobile**: Drawer from bottom (h-[92vh]), large touch targets
- **Toasts**: sonner `toast()` for all user feedback

## Key Imports Reference

```typescript
// Shared components
import { InventorySearch } from "@/components/shared/InventorySearch";
import { ViewModeToggle } from "@/components/shared/ViewModeToggle";
import { EmptyState } from "@/components/shared/EmptyState";
import { SortableTableHeader } from "@/components/shared/SortableTableHeader";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";

// UI components
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Utilities
import { useIsMobile } from "@/hooks/use-mobile";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
```

## Existing Backend Functions to Reuse

### `convex/vehicleFaults.ts`
- `getVehicleFaults()` - all faults with user details
- `getVehicleFault(faultId)` - single fault
- `createVehicleFault(...)` - create with audit trail
- `updateVehicleFault(...)` - update with per-field history
- `deleteVehicleFault(faultId)` - admin delete with audit
- `getVehicleFaultComments(faultId)` - comments list
- `addVehicleFaultComment(faultId, text)` - add comment

### `convex/vehicleFaultAuditTrail.ts`
- `getRecentChanges(limit?)` - global audit trail

## Verification Checklist
- [ ] `npm run lint` - TypeScript check passes
- [ ] Detail panel opens as Sheet on desktop, Drawer on mobile
- [ ] Form opens as Dialog on desktop, Drawer on mobile
- [ ] Photo upload: select image → uploads → thumbnail appears
- [ ] Photo delete: click delete → confirm → removed
- [ ] Vehicle type admin: add/rename/reorder/deactivate types
- [ ] Filter persistence: apply filters → navigate away → come back → filters preserved
- [ ] Cards/table view mode persists in localStorage
- [ ] Search is debounced (no query spam)
- [ ] Status transitions: can move between any status
- [ ] Audit trail tab still works
- [ ] Per-fault history shows in detail panel
- [ ] Comments section works in detail panel
- [ ] Empty states show correctly (no faults, no results)
- [ ] Dark mode throughout all components
- [ ] Delete fault with confirmation dialog
- [ ] Shared components render consistently with keys/hoses
