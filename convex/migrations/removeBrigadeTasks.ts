import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

// No longer in the schema, so the typed db API doesn't know them. Reading and
// deleting by name still works at runtime - this is the only place that does it.
const DROPPED_TABLES = [
  "brigadeTaskComments",
  "brigadeTasks",
  "actionTaskHistory",
  "actionTasks",
] as const;

const DROPPED_MODULES = ["brigadeTasks", "actionsAdmin"];

const BATCH = 500;

/**
 * Clears what's left of the Brigade Tasks module and the Action Centre's own
 * task list after both were removed: rows in their dropped tables, their
 * moduleSettings entries (so they vanish from the admin module list), their id
 * in any service account's allowedModules, and dismissals of old task actions.
 *
 * Reschedules itself until the dropped tables are empty. Safe to run more than
 * once.
 */
export const run = internalMutation({
  args: {},
  returns: v.object({
    deletedRows: v.number(),
    deletedModuleSettings: v.number(),
    updatedServiceAccounts: v.number(),
    deletedDismissals: v.number(),
    rescheduled: v.boolean(),
  }),
  handler: async (ctx) => {
    const db = ctx.db as any;
    let deletedRows = 0;
    let rescheduled = false;

    for (const table of DROPPED_TABLES) {
      const rows: Array<{ _id: string }> = await db.query(table).take(BATCH - deletedRows);
      for (const row of rows) await db.delete(row._id);
      deletedRows += rows.length;
      if (deletedRows >= BATCH) {
        rescheduled = true;
        break;
      }
    }

    let deletedModuleSettings = 0;
    for (const moduleId of DROPPED_MODULES) {
      const settings = await ctx.db
        .query("moduleSettings")
        .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
        .take(10);
      for (const setting of settings) {
        await ctx.db.delete(setting._id);
        deletedModuleSettings += 1;
      }
    }

    let updatedServiceAccounts = 0;
    for (const account of await ctx.db.query("serviceAccounts").take(200)) {
      const allowedModules = account.allowedModules.filter(
        (id) => !DROPPED_MODULES.includes(id)
      );
      if (allowedModules.length !== account.allowedModules.length) {
        await ctx.db.patch(account._id, { allowedModules });
        updatedServiceAccounts += 1;
      }
    }

    let deletedDismissals = 0;
    for (const dismissal of await ctx.db.query("actionDismissals").take(2000)) {
      if (dismissal.actionId.startsWith("actions:task:")) {
        await ctx.db.delete(dismissal._id);
        deletedDismissals += 1;
      }
    }

    if (rescheduled) {
      await ctx.scheduler.runAfter(0, internal.migrations.removeBrigadeTasks.run, {});
    }

    return {
      deletedRows,
      deletedModuleSettings,
      updatedServiceAccounts,
      deletedDismissals,
      rescheduled,
    };
  },
});
