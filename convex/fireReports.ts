import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// Query to get all fire reports for the dashboard
export const getFireReports = query({
  args: {
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("submitted"), 
      v.literal("approved"),
      v.literal("archived")
    )),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const reports = args.status 
      ? await ctx.db.query("fireReports")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(args.limit || 50)
      : await ctx.db.query("fireReports")
          .order("desc")
          .take(args.limit || 50);

    // Get user information for each report
    const reportsWithUserInfo = await Promise.all(
      reports.map(async (report) => {
        const creator = await ctx.db.get(report.createdBy);
        return {
          ...report,
          createdByName: creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.name || creator.email : 'Unknown User'
        };
      })
    );

    return reportsWithUserInfo;
  },
});

// Query to get fire reports created by the current user
export const getMyFireReports = query({
  args: {
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("submitted"), 
      v.literal("approved"),
      v.literal("archived")
    )),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    let reportQuery = ctx.db.query("fireReports").withIndex("by_createdBy", (q) => q.eq("createdBy", userId));
    
    if (args.status) {
      reportQuery = reportQuery.filter((q) => q.eq(q.field("status"), args.status));
    }
    
    return await reportQuery.order("desc").collect();
  },
});

// Query to get a specific fire report by ID
export const getFireReport = query({
  args: {
    reportId: v.id("fireReports"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return null;
    }

    // Get creator information
    const creator = await ctx.db.get(report.createdBy);
    return {
      ...report,
      createdByName: creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.name || creator.email : 'Unknown User'
    };
  },
});

// Mutation to create a new fire report
export const createFireReport = mutation({
  args: {
    // Required fields
    incidentNumber: v.string(),
    brigadeAdvisedDate: v.string(),
    brigadeAdvisedTime: v.string(),
    attendingCapacity: v.union(v.literal("primary"), v.literal("support")),
    typeOfAttendance: v.union(
      v.literal("grassScrub"),
      v.literal("incident"),
      v.literal("structure"),
      v.literal("nonStructure"),
      v.literal("falseAlarm")
    ),
    incidentController: v.string(),
    propertyAddress: v.string(),
    
    // Optional fields - all the rest of the form data
    brigadeCaller: v.optional(v.string()),
    firecomCaller: v.optional(v.string()),
    jobDetail: v.optional(v.string()),
    brigadeOIC: v.optional(v.string()),
    propertyCoordinates: v.optional(v.string()),
    keysUsed: v.optional(v.boolean()),
    chargeRecommended: v.optional(v.boolean()),
    propertyInfo: v.optional(v.any()),
    actionsTaken: v.optional(v.array(v.union(
      v.literal("calledOff"),
      v.literal("stepUp"),
      v.literal("investigateOnly"),
      v.literal("fireOutOnArrival"),
      v.literal("washaway"),
      v.literal("removeHazard"),
      v.literal("rescue"),
      v.literal("isolate"),
      v.literal("standby"),
      v.literal("extinguish"),
      v.literal("service"),
      v.literal("other")
    ))),
    fireDetails: v.optional(v.any()),
    otherServices: v.optional(v.any()),
    casualties: v.optional(v.array(v.any())),
    mobileProperty: v.optional(v.any()),
    notes: v.optional(v.string()),
    additionalData: v.optional(v.any()),
    status: v.optional(v.union(v.literal("draft"), v.literal("submitted"))),
  },
  returns: v.id("fireReports"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();
    
    const reportId = await ctx.db.insert("fireReports", {
      ...args,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      status: args.status || "draft",
    });

    return reportId;
  },
});

// Mutation to update an existing fire report
export const updateFireReport = mutation({
  args: {
    reportId: v.id("fireReports"),
    // All the same optional fields as create
    incidentNumber: v.optional(v.string()),
    brigadeAdvisedDate: v.optional(v.string()),
    brigadeAdvisedTime: v.optional(v.string()),
    attendingCapacity: v.optional(v.union(v.literal("primary"), v.literal("support"))),
    typeOfAttendance: v.optional(v.union(
      v.literal("grassScrub"),
      v.literal("incident"),
      v.literal("structure"),
      v.literal("nonStructure"),
      v.literal("falseAlarm")
    )),
    incidentController: v.optional(v.string()),
    propertyAddress: v.optional(v.string()),
    brigadeCaller: v.optional(v.string()),
    firecomCaller: v.optional(v.string()),
    jobDetail: v.optional(v.string()),
    brigadeOIC: v.optional(v.string()),
    propertyCoordinates: v.optional(v.string()),
    keysUsed: v.optional(v.boolean()),
    chargeRecommended: v.optional(v.boolean()),
    propertyInfo: v.optional(v.any()),
    actionsTaken: v.optional(v.array(v.union(
      v.literal("calledOff"),
      v.literal("stepUp"),
      v.literal("investigateOnly"),
      v.literal("fireOutOnArrival"),
      v.literal("washaway"),
      v.literal("removeHazard"),
      v.literal("rescue"),
      v.literal("isolate"),
      v.literal("standby"),
      v.literal("extinguish"),
      v.literal("service"),
      v.literal("other")
    ))),
    fireDetails: v.optional(v.any()),
    otherServices: v.optional(v.any()),
    casualties: v.optional(v.array(v.any())),
    mobileProperty: v.optional(v.any()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("archived")
    )),
    additionalData: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Fire report not found");
    }

    // Only allow updating if user created the report or is admin
    if (report.createdBy !== userId && !user?.isAdmin) {
      throw new Error("Not authorized to update this report");
    }

    // Don't allow updating submitted/approved reports unless admin
    if ((report.status === "submitted" || report.status === "approved") && !user?.isAdmin) {
      throw new Error("Cannot modify submitted or approved reports");
    }

    const { reportId, ...updateData } = args;
    
    await ctx.db.patch(args.reportId, {
      ...updateData,
      updatedAt: Date.now(),
    });

    return null;
  },
});

// Mutation to change fire report status
export const updateFireReportStatus = mutation({
  args: {
    reportId: v.id("fireReports"),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"), 
      v.literal("approved"),
      v.literal("archived")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Fire report not found");
    }

    // Only allow status changes if user created the report or is admin
    if (report.createdBy !== userId && !user?.isAdmin) {
      throw new Error("Not authorized to update this report");
    }

    // Status change validation
    const currentStatus = report.status;
    const newStatus = args.status;

    // Only admins can approve or archive reports
    if ((newStatus === "approved" || newStatus === "archived") && !user?.isAdmin) {
      throw new Error("Only administrators can approve or archive reports");
    }

    // Can't revert from approved/archived without admin
    if ((currentStatus === "approved" || currentStatus === "archived") && !user?.isAdmin) {
      throw new Error("Cannot modify approved or archived reports");
    }

    await ctx.db.patch(args.reportId, {
      status: newStatus,
      updatedAt: Date.now(),
    });

    return null;
  },
});

// Mutation to delete a fire report
export const deleteFireReport = mutation({
  args: {
    reportId: v.id("fireReports"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Fire report not found");
    }

    // Only allow deletion if user created the report or is admin
    if (report.createdBy !== userId && !user?.isAdmin) {
      throw new Error("Not authorized to delete this report");
    }

    // Don't allow deletion of submitted/approved reports unless admin
    if ((report.status === "submitted" || report.status === "approved") && !user?.isAdmin) {
      throw new Error("Cannot delete submitted or approved reports");
    }

    // Delete associated file attachments if any
    if (report.attachments && report.attachments.length > 0) {
      for (const attachment of report.attachments) {
        await ctx.storage.delete(attachment.fileId);
      }
    }

    await ctx.db.delete(args.reportId);
    return null;
  },
});

// Mutation to add file attachments to a fire report
export const addFireReportAttachment = mutation({
  args: {
    reportId: v.id("fireReports"),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Fire report not found");
    }

    // Only allow adding attachments if user created the report or is admin
    if (report.createdBy !== userId && !user?.isAdmin) {
      throw new Error("Not authorized to modify this report");
    }

    const attachment = {
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      uploadedAt: Date.now(),
    };

    const existingAttachments = report.attachments || [];
    
    await ctx.db.patch(args.reportId, {
      attachments: [...existingAttachments, attachment],
      updatedAt: Date.now(),
    });

    return null;
  },
});

// Mutation to remove file attachments from a fire report
export const removeFireReportAttachment = mutation({
  args: {
    reportId: v.id("fireReports"),
    fileId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    const user = await ctx.db.get(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Fire report not found");
    }

    // Only allow removing attachments if user created the report or is admin
    if (report.createdBy !== userId && !user?.isAdmin) {
      throw new Error("Not authorized to modify this report");
    }

    const attachments = report.attachments || [];
    const updatedAttachments = attachments.filter(att => att.fileId !== args.fileId);
    
    await ctx.db.patch(args.reportId, {
      attachments: updatedAttachments,
      updatedAt: Date.now(),
    });

    // Delete the file from storage
    await ctx.storage.delete(args.fileId);

    return null;
  },
});
