# Hoses Module - UX Improvements (2026-03-24)

## Summary
Comprehensive UX overhaul of the Hose Management module, mirroring the patterns established in the Keys module. Also introduces shared reusable components for consistency across all future modules.

---

## 1. Shared Reusable Components (New)
**Location:** `src/components/shared/`

Six new shared components extracted from common patterns across Keys and Hoses:

| Component | Purpose |
|-----------|---------|
| `InventorySearch.tsx` | Debounced instant search with inline clear button |
| `SortableTableHeader.tsx` | Generic sortable column header with chevron indicators |
| `ViewModeToggle.tsx` | Cards/Table toggle with localStorage persistence |
| `EmptyState.tsx` | Configurable empty state with icon, title, description, action |
| `DeleteConfirmDialog.tsx` | AlertDialog wrapper for delete confirmations |
| `PageTabs.tsx` | Animated page-level tab navigation |

## 2. Instant Search with Debounced Filtering
**Before:** Search required pressing Enter or clicking a "Search" button.
**After:** Search filters instantly as you type (250ms debounce). An inline X button clears the search. Uses shared `InventorySearch` component.
**Files:** `HoseInventory.tsx`, `InventorySearch.tsx`

## 3. Read-Only Quick-View Detail Panel (New)
**Before:** Clicking a hose card/row opened the full edit form immediately.
**After:** Clicking opens a read-only detail panel (Sheet on desktop, Drawer on mobile) showing all hose information at a glance: ID, status badge, size/length/type, location, test date, test expiry. Collapsible comments and change history sections. An explicit "Edit Hose" button opens the edit form when needed.
**Files:** `HoseDetailPanel.tsx` (new), `HoseInventory.tsx`

## 4. Simplified Edit Form (Tabs Removed)
**Before:** The edit form had tabs (Details | History | Comments). Items and history were hidden behind separate tabs.
**After:** The edit form is a single scrollable view with just the form fields and action buttons. History and comments are now viewed in the detail panel instead.
**Files:** `HoseForm.tsx`

## 5. URL-Persisted Search, Sort & Filters
**Before:** Search, sort, and filter state were lost when navigating away.
**After:** Search query (`?q=`), sort field (`?sort=`), sort direction (`?dir=`), and filter values (`?status=`, `?size=`, `?type=`, `?location=`) sync to URL params. Returning to the page restores state.
**Files:** `HoseInventory.tsx`

## 6. Improved Comments
**Before:** Single-line Input, no delete confirmation, absolute timestamps, no avatars.
**After:** Textarea for longer comments, AlertDialog confirmation for deletes, relative timestamps (formatDistanceToNow), avatar circles with user initials.
**Files:** `HoseComments.tsx`

## 7. Better Empty States
**Before:** Minimal empty state ("No hoses found").
**After:** Icon + title + description explaining what hoses are for and how to get started. Uses shared `EmptyState` component.
**Files:** `HoseInventory.tsx`, `HoseComments.tsx`

## 8. Page Tabs Refactored
**Before:** Custom inline TabButton component with animated indicator in HosesPage.
**After:** Uses shared `PageTabs` component with the same animated indicator. Reusable across any page.
**Files:** `HosesPage.tsx`, `PageTabs.tsx`

## 9. Backend: Single Hose Query
**Added:** `hoses.get` query for fetching a single hose by ID (used by the detail panel).
**Files:** `convex/hoses.ts`

---

## Files Created
| File | Description |
|------|-------------|
| `src/components/shared/InventorySearch.tsx` | Debounced instant search input |
| `src/components/shared/SortableTableHeader.tsx` | Generic sortable column header |
| `src/components/shared/ViewModeToggle.tsx` | Cards/Table toggle with persistence |
| `src/components/shared/EmptyState.tsx` | Configurable empty state |
| `src/components/shared/DeleteConfirmDialog.tsx` | AlertDialog delete wrapper |
| `src/components/shared/PageTabs.tsx` | Animated tabbed navigation |
| `src/features/hoses/components/HoseDetailPanel.tsx` | Read-only hose detail panel |

## Files Modified
| File | Change Type |
|------|------------|
| `convex/hoses.ts` | Added `get` query |
| `src/features/hoses/components/HoseInventory.tsx` | Rewritten - instant search, URL params, click-to-view, shared components |
| `src/features/hoses/components/HoseForm.tsx` | Simplified - removed tabs, single scroll view |
| `src/features/hoses/components/HoseComments.tsx` | Rewritten - AlertDialog, avatars, relative time, textarea |
| `src/pages/HosesPage.tsx` | Refactored - uses shared PageTabs |

## Files Deprecated
| File | Reason |
|------|--------|
| `src/features/hoses/components/HoseHistoryModal.tsx` | History moved to HoseDetailPanel |
