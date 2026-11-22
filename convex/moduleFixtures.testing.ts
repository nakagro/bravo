// Test-only helper (the extra dot keeps it out of the Convex bundle).
//
// Every module function now checks its Module Settings gate, so a test that
// is about a feature's behaviour rather than its permissions seeds the modules
// it uses as open to every active member. Modules that already have a row are
// left alone, so a test that seeds its own gate keeps it.

import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

const ALL_MODULES = [
  "dashboard", "links", "hoses", "keys", "availability", "availabilityAdmin",
  "dutyCrew", "fireReports", "inventory", "inventoryAdmin", "memberRecords",
  "memberRecordsAdmin", "vehicleFaults", "bookings", "bookingsAdmin", "settings",
  "feedback", "equipment", "equipmentAdmin", "baSkills", "baSkillsAdmin",
  "training", "events", "eventsAdmin", "calendar", "calendarWrite", "actions",
  "kiosk",
];

export async function openModules(
  ctx: GenericMutationCtx<DataModel>,
  moduleIds: string[] = ALL_MODULES,
) {
  for (const moduleId of moduleIds) {
    const existing = await ctx.db
      .query("moduleSettings")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();
    if (existing) continue;
    await ctx.db.insert("moduleSettings", {
      moduleId,
      moduleName: moduleId,
      isEnabled: true,
      adminOnly: false,
      requiredRoles: [],
      updatedAt: 0,
    });
  }
}
