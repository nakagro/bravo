import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all booking resources with their details
 */
export const getBookingResources = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookingResources"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      approvers: v.array(v.id("users")),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
      createdByUser: v.optional(
        v.object({
          _id: v.id("users"),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          name: v.optional(v.string()),
        })
      ),
      approverUsers: v.array(
        v.object({
          _id: v.id("users"),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          name: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    const resources = await ctx.db.query("bookingResources").collect();

    const resourcesWithUsers = await Promise.all(
      resources.map(async (resource) => {
        const createdByUser = await ctx.db.get(resource.createdBy);
        const approverUsers = await Promise.all(
          resource.approvers.map((approverId) => ctx.db.get(approverId))
        );

        return {
          ...resource,
          createdByUser: createdByUser
            ? {
                _id: createdByUser._id,
                firstName: createdByUser.firstName,
                lastName: createdByUser.lastName,
                name: createdByUser.name,
              }
            : undefined,
          approverUsers: approverUsers
            .filter((user) => user !== null)
            .map((user) => ({
              _id: user!._id,
              firstName: user!.firstName,
              lastName: user!.lastName,
              name: user!.name,
            })),
        };
      })
    );

    return resourcesWithUsers;
  },
});

/**
 * Get active booking resources only
 */
export const getActiveBookingResources = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookingResources"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      approvers: v.array(v.id("users")),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      updatedBy: v.id("users"),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("bookingResources")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
  },
});

/**
 * Create a new booking resource
 */
export const createBookingResource = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    approvers: v.array(v.id("users")),
  },
  returns: v.id("bookingResources"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to create a booking resource");
    }

    const now = Date.now();

    const resourceId = await ctx.db.insert("bookingResources", {
      name: args.name,
      description: args.description,
      isActive: true,
      approvers: args.approvers,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    });

    return resourceId;
  },
});

/**
 * Update a booking resource
 */
export const updateBookingResource = mutation({
  args: {
    resourceId: v.id("bookingResources"),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    approvers: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update a booking resource");
    }

    await ctx.db.patch(args.resourceId, {
      name: args.name,
      description: args.description,
      isActive: args.isActive,
      approvers: args.approvers,
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    return null;
  },
});

/**
 * Delete a booking resource
 */
export const deleteBookingResource = mutation({
  args: {
    resourceId: v.id("bookingResources"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete a booking resource");
    }

    // Check if there are any bookings for this resource
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .collect();

    if (bookings.length > 0) {
      throw new Error(
        "Cannot delete resource with existing bookings. Please cancel or complete all bookings first."
      );
    }

    await ctx.db.delete(args.resourceId);
    return null;
  },
});

/**
 * Get all bookings with user and resource details
 */
export const getBookings = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      _creationTime: v.number(),
      resourceId: v.id("bookingResources"),
      requestedBy: v.id("users"),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cancelled")
      ),
      startDate: v.string(),
      endDate: v.optional(v.string()),
      startTime: v.optional(v.string()),
      endTime: v.optional(v.string()),
      isAllDay: v.boolean(),
      notes: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      reviewNotes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      resource: v.optional(
        v.object({
          _id: v.id("bookingResources"),
          name: v.string(),
          description: v.optional(v.string()),
        })
      ),
      requestedByUser: v.optional(
        v.object({
          _id: v.id("users"),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          name: v.optional(v.string()),
        })
      ),
      reviewedByUser: v.optional(
        v.object({
          _id: v.id("users"),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          name: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    const bookings = await ctx.db.query("bookings").collect();

    const bookingsWithDetails = await Promise.all(
      bookings.map(async (booking) => {
        const resource = await ctx.db.get(booking.resourceId);
        const requestedByUser = await ctx.db.get(booking.requestedBy);
        const reviewedByUser = booking.reviewedBy
          ? await ctx.db.get(booking.reviewedBy)
          : null;

        return {
          ...booking,
          resource: resource
            ? {
                _id: resource._id,
                name: resource.name,
                description: resource.description,
              }
            : undefined,
          requestedByUser: requestedByUser
            ? {
                _id: requestedByUser._id,
                firstName: requestedByUser.firstName,
                lastName: requestedByUser.lastName,
                name: requestedByUser.name,
              }
            : undefined,
          reviewedByUser: reviewedByUser
            ? {
                _id: reviewedByUser._id,
                firstName: reviewedByUser.firstName,
                lastName: reviewedByUser.lastName,
                name: reviewedByUser.name,
              }
            : undefined,
        };
      })
    );

    return bookingsWithDetails;
  },
});

/**
 * Get bookings for the current user
 */
export const getMyBookings = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      _creationTime: v.number(),
      resourceId: v.id("bookingResources"),
      requestedBy: v.id("users"),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cancelled")
      ),
      startDate: v.string(),
      endDate: v.optional(v.string()),
      startTime: v.optional(v.string()),
      endTime: v.optional(v.string()),
      isAllDay: v.boolean(),
      notes: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      reviewNotes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      resource: v.optional(
        v.object({
          _id: v.id("bookingResources"),
          name: v.string(),
          description: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_requestedBy", (q) => q.eq("requestedBy", userId))
      .collect();

    const bookingsWithResource = await Promise.all(
      bookings.map(async (booking) => {
        const resource = await ctx.db.get(booking.resourceId);

        return {
          ...booking,
          resource: resource
            ? {
                _id: resource._id,
                name: resource.name,
                description: resource.description,
              }
            : undefined,
        };
      })
    );

    return bookingsWithResource;
  },
});

/**
 * Get bookings pending approval for the current user
 */
export const getPendingApprovalsForMe = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      _creationTime: v.number(),
      resourceId: v.id("bookingResources"),
      requestedBy: v.id("users"),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cancelled")
      ),
      startDate: v.string(),
      endDate: v.optional(v.string()),
      startTime: v.optional(v.string()),
      endTime: v.optional(v.string()),
      isAllDay: v.boolean(),
      notes: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      reviewNotes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      resource: v.optional(
        v.object({
          _id: v.id("bookingResources"),
          name: v.string(),
          description: v.optional(v.string()),
        })
      ),
      requestedByUser: v.optional(
        v.object({
          _id: v.id("users"),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          name: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get all resources where the current user is an approver
    const resources = await ctx.db.query("bookingResources").collect();
    const myResourceIds = resources
      .filter((resource) => resource.approvers.includes(userId))
      .map((resource) => resource._id);

    if (myResourceIds.length === 0) {
      return [];
    }

    // Get all pending bookings for those resources
    const allPendingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const myPendingBookings = allPendingBookings.filter((booking) =>
      myResourceIds.includes(booking.resourceId)
    );

    const bookingsWithDetails = await Promise.all(
      myPendingBookings.map(async (booking) => {
        const resource = await ctx.db.get(booking.resourceId);
        const requestedByUser = await ctx.db.get(booking.requestedBy);

        return {
          ...booking,
          resource: resource
            ? {
                _id: resource._id,
                name: resource.name,
                description: resource.description,
              }
            : undefined,
          requestedByUser: requestedByUser
            ? {
                _id: requestedByUser._id,
                firstName: requestedByUser.firstName,
                lastName: requestedByUser.lastName,
                name: requestedByUser.name,
              }
            : undefined,
        };
      })
    );

    return bookingsWithDetails;
  },
});

/**
 * Create a new booking request
 */
export const createBooking = mutation({
  args: {
    resourceId: v.id("bookingResources"),
    startDate: v.string(), // ISO date string (YYYY-MM-DD)
    endDate: v.optional(v.string()), // ISO date string, optional for single-day bookings
    startTime: v.optional(v.string()), // Time string (HH:MM)
    endTime: v.optional(v.string()), // Time string (HH:MM)
    isAllDay: v.boolean(),
    notes: v.optional(v.string()),
  },
  returns: v.id("bookings"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to create a booking");
    }

    // Check if the resource exists and is active
    const resource = await ctx.db.get(args.resourceId);
    if (!resource) {
      throw new Error("Resource not found");
    }
    if (!resource.isActive) {
      throw new Error("This resource is not available for booking");
    }

    // Validate time fields if not all-day
    if (!args.isAllDay && (!args.startTime || !args.endTime)) {
      throw new Error("Start time and end time are required for non-all-day bookings");
    }

    // Check for conflicting bookings (only approved or pending ones)
    const effectiveEndDate = args.endDate || args.startDate;
    const existingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_resource", (q) => q.eq("resourceId", args.resourceId))
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "approved")
          ),
          // Check for date overlap
          q.and(
            q.lte(q.field("startDate"), effectiveEndDate),
            q.gte(q.field("startDate"), args.startDate)
          )
        )
      )
      .collect();

    // More thorough conflict check including time overlap
    for (const existing of existingBookings) {
      const existingEndDate = existing.endDate || existing.startDate;
      
      // Check if dates overlap
      if (args.startDate <= existingEndDate && effectiveEndDate >= existing.startDate) {
        // If either booking is all-day, there's a conflict
        if (args.isAllDay || existing.isAllDay) {
          throw new Error(
            `This resource is already booked on ${existing.startDate}. Please choose a different date or time.`
          );
        }
        
        // Check time overlap for same-day bookings
        if (args.startTime && args.endTime && existing.startTime && existing.endTime) {
          if (args.startTime < existing.endTime && args.endTime > existing.startTime) {
            throw new Error(
              `This resource is already booked from ${existing.startTime} to ${existing.endTime} on ${existing.startDate}. Please choose a different time.`
            );
          }
        }
      }
    }

    const now = Date.now();

    const bookingId = await ctx.db.insert("bookings", {
      resourceId: args.resourceId,
      requestedBy: userId,
      status: "pending",
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      isAllDay: args.isAllDay,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    return bookingId;
  },
});

/**
 * Approve a booking
 */
export const approveBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    reviewNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to approve a booking");
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check if the user is an approver for this resource
    const resource = await ctx.db.get(booking.resourceId);
    if (!resource) {
      throw new Error("Resource not found");
    }

    if (!resource.approvers.includes(userId)) {
      throw new Error("You are not authorized to approve this booking");
    }

    if (booking.status !== "pending") {
      throw new Error("Only pending bookings can be approved");
    }

    const now = Date.now();

    await ctx.db.patch(args.bookingId, {
      status: "approved",
      reviewedBy: userId,
      reviewedAt: now,
      reviewNotes: args.reviewNotes,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Reject a booking
 */
export const rejectBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    reviewNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to reject a booking");
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Check if the user is an approver for this resource
    const resource = await ctx.db.get(booking.resourceId);
    if (!resource) {
      throw new Error("Resource not found");
    }

    if (!resource.approvers.includes(userId)) {
      throw new Error("You are not authorized to reject this booking");
    }

    if (booking.status !== "pending") {
      throw new Error("Only pending bookings can be rejected");
    }

    const now = Date.now();

    await ctx.db.patch(args.bookingId, {
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: now,
      reviewNotes: args.reviewNotes,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Cancel a booking (by the requester)
 */
export const cancelBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to cancel a booking");
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Only the requester can cancel their own booking
    if (booking.requestedBy !== userId) {
      throw new Error("You can only cancel your own bookings");
    }

    if (booking.status === "cancelled") {
      throw new Error("This booking is already cancelled");
    }

    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Update a booking (admin only)
 */
export const updateBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    resourceId: v.optional(v.id("bookingResources")),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    isAllDay: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled")
    )),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update a booking");
    }

    // Check if user is admin
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new Error("Only admins can update bookings");
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    // If changing resource, validate it exists and is active
    if (args.resourceId && args.resourceId !== booking.resourceId) {
      const resource = await ctx.db.get(args.resourceId);
      if (!resource) {
        throw new Error("Resource not found");
      }
      if (!resource.isActive) {
        throw new Error("This resource is not available for booking");
      }
    }

    // Validate time fields if changing to non-all-day
    const newIsAllDay = args.isAllDay !== undefined ? args.isAllDay : booking.isAllDay;
    const newStartTime = args.startTime !== undefined ? args.startTime : booking.startTime;
    const newEndTime = args.endTime !== undefined ? args.endTime : booking.endTime;
    
    if (!newIsAllDay && (!newStartTime || !newEndTime)) {
      throw new Error("Start time and end time are required for non-all-day bookings");
    }

    const now = Date.now();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (args.resourceId !== undefined) updateData.resourceId = args.resourceId;
    if (args.startDate !== undefined) updateData.startDate = args.startDate;
    if (args.endDate !== undefined) updateData.endDate = args.endDate || undefined;
    if (args.startTime !== undefined) updateData.startTime = args.startTime || undefined;
    if (args.endTime !== undefined) updateData.endTime = args.endTime || undefined;
    if (args.isAllDay !== undefined) updateData.isAllDay = args.isAllDay;
    if (args.notes !== undefined) updateData.notes = args.notes || undefined;
    if (args.status !== undefined) updateData.status = args.status;

    await ctx.db.patch(args.bookingId, updateData);

    return null;
  },
});

/**
 * Get bookings for a date range (for calendar/schedule view)
 */
export const getBookingsForDateRange = query({
  args: {
    startDate: v.string(), // ISO date string (YYYY-MM-DD)
    endDate: v.string(), // ISO date string (YYYY-MM-DD)
    resourceId: v.optional(v.id("bookingResources")), // Optional filter by resource
  },
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      _creationTime: v.number(),
      resourceId: v.id("bookingResources"),
      requestedBy: v.id("users"),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cancelled")
      ),
      startDate: v.string(),
      endDate: v.optional(v.string()),
      startTime: v.optional(v.string()),
      endTime: v.optional(v.string()),
      isAllDay: v.boolean(),
      notes: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      reviewNotes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      resource: v.optional(
        v.object({
          _id: v.id("bookingResources"),
          name: v.string(),
          description: v.optional(v.string()),
        })
      ),
      requestedByUser: v.optional(
        v.object({
          _id: v.id("users"),
          firstName: v.optional(v.string()),
          lastName: v.optional(v.string()),
          name: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    let allBookings;

    // Filter by resource if specified
    if (args.resourceId) {
      const resourceId = args.resourceId;
      allBookings = await ctx.db
        .query("bookings")
        .withIndex("by_resource_startDate", (q) => q.eq("resourceId", resourceId))
        .collect();
    } else {
      allBookings = await ctx.db
        .query("bookings")
        .withIndex("by_startDate")
        .collect();
    }

    // Filter bookings that overlap with the date range
    // A booking overlaps if: booking.startDate <= args.endDate AND (booking.endDate || booking.startDate) >= args.startDate
    const filteredBookings = allBookings.filter((booking) => {
      const bookingEndDate = booking.endDate || booking.startDate;
      return booking.startDate <= args.endDate && bookingEndDate >= args.startDate;
    });

    // Only show approved and pending bookings in the schedule
    const activeBookings = filteredBookings.filter(
      (b) => b.status === "approved" || b.status === "pending"
    );

    const bookingsWithDetails = await Promise.all(
      activeBookings.map(async (booking) => {
        const resource = await ctx.db.get(booking.resourceId);
        const requestedByUser = await ctx.db.get(booking.requestedBy);

        return {
          ...booking,
          resource: resource
            ? {
                _id: resource._id,
                name: resource.name,
                description: resource.description,
              }
            : undefined,
          requestedByUser: requestedByUser
            ? {
                _id: requestedByUser._id,
                firstName: requestedByUser.firstName,
                lastName: requestedByUser.lastName,
                name: requestedByUser.name,
              }
            : undefined,
        };
      })
    );

    // Sort by date and time
    return bookingsWithDetails.sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }
      // All-day bookings come first
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      // Then sort by start time
      return (a.startTime || "00:00").localeCompare(b.startTime || "00:00");
    });
  },
});

/**
 * Get all users (for approver selection)
 */
export const getAllUsers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      name: v.optional(v.string()),
      rank: v.optional(
        v.union(
          v.literal("Probationary"),
          v.literal("Firefighter"),
          v.literal("Lieutenant"),
          v.literal("Captain")
        )
      ),
    })
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    return users.map((user) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      rank: user.rank,
    }));
  },
});
