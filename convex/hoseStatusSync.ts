import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper function to determine if a hose should be "In date" or "Due for testing" based on test date
function getAutoStatus(testDate: number): "In date" | "Due for testing" {
  const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000); // 365 days in milliseconds
  return testDate >= oneYearAgo ? "In date" : "Due for testing";
}

// Query to check which hoses need status updates
export const getHosesNeedingStatusUpdate = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("hoses"),
    hoseId: v.string(),
    currentStatus: v.string(),
    suggestedStatus: v.string(),
    testDate: v.number(),
    daysSinceTest: v.number(),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const hoses = await ctx.db.query("hoses").collect();
    const hosesNeedingUpdate = [];

    for (const hose of hoses) {
      // Only check hoses that are currently "In date" or "Due for testing"
      if (hose.status === "In date" || hose.status === "Due for testing") {
        const suggestedStatus = getAutoStatus(hose.testDate);
        
        if (hose.status !== suggestedStatus) {
          const daysSinceTest = Math.floor((Date.now() - hose.testDate) / (24 * 60 * 60 * 1000));
          
          hosesNeedingUpdate.push({
            _id: hose._id,
            hoseId: hose.hoseId,
            currentStatus: hose.status,
            suggestedStatus,
            testDate: hose.testDate,
            daysSinceTest,
          });
        }
      }
    }

    return hosesNeedingUpdate;
  },
});

// Mutation to sync all hose statuses based on their test dates
export const syncAllHoseStatuses = mutation({
  args: {},
  returns: v.object({
    updated: v.number(),
    details: v.array(v.object({
      hoseId: v.string(),
      oldStatus: v.string(),
      newStatus: v.string(),
    })),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const hoses = await ctx.db.query("hoses").collect();
    const updates = [];
    const timestamp = Date.now();

    for (const hose of hoses) {
      // Only auto-update hoses that are currently "In date" or "Due for testing"
      if (hose.status === "In date" || hose.status === "Due for testing") {
        const suggestedStatus = getAutoStatus(hose.testDate);
        
        if (hose.status !== suggestedStatus) {
          // Record the change in history
          await ctx.db.insert("hoseHistory", {
            hoseId: hose._id,
            timestamp,
            userId,
            changeType: "status_auto_sync",
            field: "status",
            oldValue: hose.status,
            newValue: suggestedStatus,
          });

          // Update the hose status
          await ctx.db.patch(hose._id, {
            status: suggestedStatus,
            updatedAt: timestamp,
          });

          updates.push({
            hoseId: hose.hoseId,
            oldStatus: hose.status,
            newStatus: suggestedStatus,
          });
        }
      }
    }

    return {
      updated: updates.length,
      details: updates,
    };
  },
});

// Mutation to sync a specific hose status
export const syncHoseStatus = mutation({
  args: {
    hoseId: v.id("hoses"),
  },
  returns: v.object({
    updated: v.boolean(),
    oldStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const hose = await ctx.db.get(args.hoseId);
    if (!hose) throw new Error("Hose not found");

    // Only auto-update hoses that are currently "In date" or "Due for testing"
    if (hose.status === "In date" || hose.status === "Due for testing") {
      const suggestedStatus = getAutoStatus(hose.testDate);
      
      if (hose.status !== suggestedStatus) {
        const timestamp = Date.now();

        // Record the change in history
        await ctx.db.insert("hoseHistory", {
          hoseId: hose._id,
          timestamp,
          userId,
          changeType: "status_auto_sync",
          field: "status",
          oldValue: hose.status,
          newValue: suggestedStatus,
        });

        // Update the hose status
        await ctx.db.patch(hose._id, {
          status: suggestedStatus,
          updatedAt: timestamp,
        });

        return {
          updated: true,
          oldStatus: hose.status,
          newStatus: suggestedStatus,
        };
      }
    }

    return {
      updated: false,
    };
  },
});
