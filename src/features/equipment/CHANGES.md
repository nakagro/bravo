# Equipment Module — UX Improvements (2026-03-24)

## Summary
Comprehensive UX overhaul of the Equipment module across all three tabs (Take, Stock, Manage). Focus on feedback, discoverability, and reducing friction for common operations.

---

## 1. Toast Notifications on All Operations
**Before:** Success/failure feedback was via `console.error` or `alert()`. Users had no visible confirmation that actions succeeded.
**After:** All equipment operations (take, replenish, create/update/delete category, create/update/delete item) show toast notifications via Sonner. Success toasts include item names and quantities. Error toasts show the server error message.
**Files:** `EquipmentTakeTab.tsx`, `EquipmentManageTab.tsx`

## 2. Low Stock Filter + Search on Stock Tab
**Before:** Stock tab had no search and no way to filter to just low-stock items.
**After:** Search input filters items by name, size, or category. Clickable "X Low" button toggles a low-stock-only filter. Button shows total low stock count and turns red when active.
**Files:** `EquipmentStockTab.tsx`

## 3. Per-Item Transaction History Panel
**Before:** No way to view an individual item's transaction history from the Stock tab.
**After:** Tapping any item in the Stock tab opens a Sheet (desktop) or Drawer (mobile) showing the item's full transaction history with color-coded icons, stock deltas, user names, timestamps, and notes.
**Files:** `EquipmentStockTab.tsx`, `EquipmentItemHistory.tsx` (new)

## 4. History Tab Type Filters + Pagination
**Before:** History tab showed only the last 10 transactions with no filtering.
**After:** Horizontal filter pills (All, Takes, Replenish, Adjustments) filter by transaction type. Shows 25 results by default with a "Load more" button for pagination. Backend query accepts optional `type` parameter.
**Files:** `EquipmentRecentActivity.tsx`, `convex/equipment.ts` (getRecentTransactions — added `type` filter arg)

## 5. Quick Restock from Stock Tab
**Before:** Restocking required navigating to Manage → Replenish tab, searching for the item, and going through the full replenish flow.
**After:** The item history panel (opened by tapping any stock item) includes a "Quick Restock" section with a StepperInput and Add button. Restock directly from the Stock tab without leaving context.
**Files:** `EquipmentStockTab.tsx`

## 6. Recent Takes on Take Tab
**Before:** No memory of what the user recently took. Users had to remember or check the History tab.
**After:** A horizontally scrollable "Your Recent Takes" pill bar appears above the item list (hidden when searching). Shows the user's last 5 takes with item name, quantity, and relative time.
**Files:** `EquipmentTakeTab.tsx`, `convex/equipment.ts` (new `getMyRecentTakes` query)

---

## New Components

### `src/features/equipment/components/EquipmentItemHistory.tsx`
Per-item transaction history list. Props: `itemId`. Fetches and displays up to 30 transactions with color-coded type icons, stock deltas, user names, timestamps, and notes.

---

## Backend Changes
| File | Change |
|------|--------|
| `convex/equipment.ts` | `getRecentTransactions` — added optional `type` filter parameter |
| `convex/equipment.ts` | `getMyRecentTakes` — **new query** returning current user's recent take transactions |

## 7. Replenish Promoted to Top-Level Tab
**Before:** Replenish was nested inside the Manage tab behind a shadcn TabsList toggle ("Replenish Stock" / "Categories & Items"). This was visually inconsistent with the rest of the app (which uses red underline tabs, not pill toggles) and buried a frequent operation two levels deep.
**After:** Replenish is now its own top-level tab (Take / Stock / Replenish / History / Manage) using the same red underline tab pattern as the rest of the app. The Manage tab is now purely for Categories & Items CRUD — no nested tabs needed.
**Files:** `EquipmentPage.tsx`, `EquipmentReplenishTab.tsx` (new), `EquipmentManageTab.tsx`

## 8. Manage Tab Cleanup — AlertDialogs & Better Design
**Before:** Delete confirmations used `window.confirm()`. Empty category state was a plain text line. No low stock indicators on category items.
**After:** All delete actions use proper AlertDialog with descriptive messages. Empty categories show an inline "Add one" link. Low stock badges shown on items within categories. Category action buttons separated with a border for clarity.
**Files:** `EquipmentManageTab.tsx`

---

## Files Changed
| File | Change Type |
|------|------------|
| `src/pages/EquipmentPage.tsx` | Modified — added Replenish as top-level tab |
| `src/features/equipment/components/EquipmentTakeTab.tsx` | Modified — toast notifications, recent takes section |
| `src/features/equipment/components/EquipmentStockTab.tsx` | Rewritten — search, low stock filter, clickable items, history panel, quick restock |
| `src/features/equipment/components/EquipmentReplenishTab.tsx` | **New** — extracted from ManageTab, standalone replenish tab |
| `src/features/equipment/components/EquipmentManageTab.tsx` | Rewritten — stripped replenish, removed nested tabs, AlertDialogs, better empty states |
| `src/features/equipment/components/EquipmentRecentActivity.tsx` | Rewritten — type filter pills, pagination |
| `src/features/equipment/components/EquipmentItemHistory.tsx` | **New** — per-item transaction history |
| `src/features/equipment/components/index.ts` | Modified — added EquipmentReplenishTab export |
| `convex/equipment.ts` | Modified — type filter on getRecentTransactions, new getMyRecentTakes query |
