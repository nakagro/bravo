import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Query to get all vehicle faults with user details
export const getVehicleFaults = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("vehicleFaults"),
    _creationTime: v.number(),
    dateReported: v.number(),
    dateLogged: v.optional(v.number()),
    vehicle: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    shortDescription: v.string(),
    longDescription: v.string(),
    eamRequestNumber: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    status: v.union(
      v.literal("pending_dmo"),
      v.literal("pending_wydv"),
      v.literal("resolved")
    ),
    reportedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    notes: v.optional(v.string()),
    reportedByUser: v.optional(v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    })),
    updatedByUser: v.optional(v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    })),
  })),
  handler: async (ctx) => {
    const faults = await ctx.db.query("vehicleFaults")
      .order("desc")
      .collect();
    
    // Fetch user details for each fault
    const faultsWithUsers = await Promise.all(
      faults.map(async (fault) => {
        const reportedByUser = await ctx.db.get(fault.reportedBy);
        const updatedByUser = await ctx.db.get(fault.updatedBy);
        
        return {
          ...fault,
          reportedByUser: reportedByUser ? {
            _id: reportedByUser._id,
            name: reportedByUser.name,
            firstName: reportedByUser.firstName,
            lastName: reportedByUser.lastName,
          } : undefined,
          updatedByUser: updatedByUser ? {
            _id: updatedByUser._id,
            name: updatedByUser.name,
            firstName: updatedByUser.firstName,
            lastName: updatedByUser.lastName,
          } : undefined,
        };
      })
    );
    
    return faultsWithUsers;
  },
});

// Query to get vehicle faults by vehicle
export const getVehicleFaultsByVehicle = query({
  args: {
    vehicle: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
  },
  returns: v.array(v.object({
    _id: v.id("vehicleFaults"),
    _creationTime: v.number(),
    dateReported: v.number(),
    dateLogged: v.optional(v.number()),
    vehicle: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    shortDescription: v.string(),
    longDescription: v.string(),
    eamRequestNumber: v.optional(v.string()),
    status: v.union(
      v.literal("pending_dmo"),
      v.literal("pending_wydv"),
      v.literal("resolved")
    ),
    reportedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    notes: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    return await ctx.db.query("vehicleFaults")
      .filter((q) => q.eq(q.field("vehicle"), args.vehicle))
      .order("desc")
      .collect();
  },
});

// Query to get vehicle faults by status
export const getVehicleFaultsByStatus = query({
  args: {
    status: v.union(
      v.literal("pending_dmo"),
      v.literal("pending_wydv"),
      v.literal("resolved")
    ),
  },
  returns: v.array(v.object({
    _id: v.id("vehicleFaults"),
    _creationTime: v.number(),
    dateReported: v.number(),
    dateLogged: v.optional(v.number()),
    vehicle: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    shortDescription: v.string(),
    longDescription: v.string(),
    eamRequestNumber: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    status: v.union(
      v.literal("pending_dmo"),
      v.literal("pending_wydv"),
      v.literal("resolved")
    ),
    reportedBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
    notes: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    return await ctx.db.query("vehicleFaults")
      .filter((q) => q.eq(q.field("status"), args.status))
      .order("desc")
      .collect();
  },
});

// Mutation to create a new vehicle fault
export const createVehicleFault = mutation({
  args: {
    dateReported: v.number(),
    dateLogged: v.optional(v.number()),
    vehicle: v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    ),
    shortDescription: v.string(),
    longDescription: v.string(),
    eamRequestNumber: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    notes: v.optional(v.string()),
  },
  returns: v.id("vehicleFaults"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to report vehicle faults");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    
    const faultId = await ctx.db.insert("vehicleFaults", {
      dateReported: args.dateReported,
      dateLogged: args.dateLogged,
      vehicle: args.vehicle,
      shortDescription: args.shortDescription,
      longDescription: args.longDescription,
      eamRequestNumber: args.eamRequestNumber,
      priority: args.priority,
      status: "pending_dmo",
      reportedBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      notes: args.notes,
    });

    return faultId;
  },
});

// Mutation to update a vehicle fault
export const updateVehicleFault = mutation({
  args: {
    faultId: v.id("vehicleFaults"),
    dateReported: v.optional(v.number()),
    dateLogged: v.optional(v.number()),
    vehicle: v.optional(v.union(
      v.literal("Pumper"),
      v.literal("Tanker"),
      v.literal("FCV")
    )),
    shortDescription: v.optional(v.string()),
    longDescription: v.optional(v.string()),
    eamRequestNumber: v.optional(v.string()),
    priority: v.optional(v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    )),
    status: v.optional(v.union(
      v.literal("pending_dmo"),
      v.literal("pending_wydv"),
      v.literal("resolved")
    )),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update vehicle faults");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const fault = await ctx.db.get(args.faultId);
    if (!fault) {
      throw new Error("Vehicle fault not found");
    }

    // Build update object with only provided fields
    const updateData: any = {
      updatedAt: Date.now(),
      updatedBy: userId,
    };

    if (args.dateReported !== undefined) updateData.dateReported = args.dateReported;
    if (args.dateLogged !== undefined) updateData.dateLogged = args.dateLogged;
    if (args.vehicle !== undefined) updateData.vehicle = args.vehicle;
    if (args.shortDescription !== undefined) updateData.shortDescription = args.shortDescription;
    if (args.longDescription !== undefined) updateData.longDescription = args.longDescription;
    if (args.eamRequestNumber !== undefined) updateData.eamRequestNumber = args.eamRequestNumber;
    if (args.priority !== undefined) updateData.priority = args.priority;
    if (args.status !== undefined) updateData.status = args.status;
    if (args.notes !== undefined) updateData.notes = args.notes;

    await ctx.db.patch(args.faultId, updateData);
  },
});

// Mutation to delete a vehicle fault (admin only)
export const deleteVehicleFault = mutation({
  args: {
    faultId: v.id("vehicleFaults"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete vehicle faults");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isAdmin) {
      throw new Error("Only administrators can delete vehicle faults");
    }

    const fault = await ctx.db.get(args.faultId);
    if (!fault) {
      throw new Error("Vehicle fault not found");
    }

    await ctx.db.delete(args.faultId);
  },
});

// Query to get a single vehicle fault by ID
export const getVehicleFault = query({
  args: {
    faultId: v.id("vehicleFaults"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("vehicleFaults"),
      _creationTime: v.number(),
      dateReported: v.number(),
      dateLogged: v.optional(v.number()),
      vehicle: v.union(
        v.literal("Pumper"),
        v.literal("Tanker"),
        v.literal("FCV")
      ),
      shortDescription: v.string(),
      longDescription: v.string(),
      eamRequestNumber: v.optional(v.string()),
      priority: v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high")
      ),
      status: v.union(
        v.literal("pending_dmo"),
        v.literal("pending_wydv"),
        v.literal("resolved")
      ),
      reportedBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
      notes: v.optional(v.string()),
      reportedByUser: v.optional(v.object({
        _id: v.id("users"),
        name: v.optional(v.string()),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
      })),
      updatedByUser: v.optional(v.object({
        _id: v.id("users"),
        name: v.optional(v.string()),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
      })),
    })
  ),
  handler: async (ctx, args) => {
    const fault = await ctx.db.get(args.faultId);
    if (!fault) {
      return null;
    }

    const reportedByUser = await ctx.db.get(fault.reportedBy);
    const updatedByUser = await ctx.db.get(fault.updatedBy);

    return {
      ...fault,
      reportedByUser: reportedByUser ? {
        _id: reportedByUser._id,
        name: reportedByUser.name,
        firstName: reportedByUser.firstName,
        lastName: reportedByUser.lastName,
      } : undefined,
      updatedByUser: updatedByUser ? {
        _id: updatedByUser._id,
        name: updatedByUser.name,
        firstName: updatedByUser.firstName,
        lastName: updatedByUser.lastName,
      } : undefined,
    };
  },
});

// Query to get comments for a specific vehicle fault
export const getVehicleFaultComments = query({
  args: {
    faultId: v.id("vehicleFaults"),
  },
  returns: v.array(v.object({
    _id: v.id("vehicleFaultComments"),
    _creationTime: v.number(),
    faultId: v.id("vehicleFaults"),
    userId: v.id("users"),
    timestamp: v.number(),
    text: v.string(),
    user: v.optional(v.object({
      _id: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    })),
  })),
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("vehicleFaultComments")
      .withIndex("by_fault", (q) => q.eq("faultId", args.faultId))
      .order("asc")
      .collect();

    // Fetch user details for each comment
    const commentsWithUsers = await Promise.all(
      comments.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          ...comment,
          user: user ? {
            _id: user._id,
            name: user.name,
            firstName: user.firstName,
            lastName: user.lastName,
          } : undefined,
        };
      })
    );

    return commentsWithUsers;
  },
});

// Mutation to add a comment to a vehicle fault
export const addVehicleFaultComment = mutation({
  args: {
    faultId: v.id("vehicleFaults"),
    text: v.string(),
  },
  returns: v.id("vehicleFaultComments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to add comments");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify the fault exists
    const fault = await ctx.db.get(args.faultId);
    if (!fault) {
      throw new Error("Vehicle fault not found");
    }

    const commentId = await ctx.db.insert("vehicleFaultComments", {
      faultId: args.faultId,
      userId,
      timestamp: Date.now(),
      text: args.text,
    });

    return commentId;
  },
});
