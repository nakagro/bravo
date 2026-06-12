import { query, mutation, MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

const RANK_ORDER = {
  Probationary: 1,
  Firefighter: 2,
  Lieutenant: 3,
  Captain: 4,
} as const;

/**
 * Whether the user can manage booking resources (bookingsAdmin module or system admin).
 */
async function hasBookingsAdminAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  if (user.isAdmin) return true;

  const moduleSetting = await ctx.db
    .query("moduleSettings")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", "bookingsAdmin"))
    .first();

  if (!moduleSetting || !moduleSetting.isEnabled) return false;
  if (moduleSetting.adminOnly && !user.isAdmin) return false;

  const requiredRoles = moduleSetting.requiredRoles ?? [];
  const roleOk =
    requiredRoles.length === 0 || requiredRoles.some((role) => (user.roles ?? []).includes(role));

  const requiredRank = moduleSetting.minimumRank;
  const rankOk =
    requiredRank === undefined ||
    (user.rank !== undefined && RANK_ORDER[user.rank] >= RANK_ORDER[requiredRank]);

  return roleOk && rankOk;
}

async function requireBookingsAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("You must be signed in");
  }
  if (!(await hasBookingsAdminAccess(ctx, userId))) {
    throw new Error("Bookings admin access required");
  }
  return userId;
}

/**
 * Check a proposed booking against existing pending/approved bookings for the
 * same resource and throw a structured ConvexError if it overlaps.
 *
 * Time semantics: for multi-day timed bookings, startTime applies to the first
 * day, endTime to the last day, and middle days are fully occupied.
 */
async function assertNoBookingConflict(
  ctx: MutationCtx,
  booking: {
    resourceId: Id<"bookingResources">;
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    isAllDay: boolean;
    excludeBookingId?: Id<"bookings">;
  }
) {
  const effectiveEndDate = booking.endDate || booking.startDate;

  const existingBookings = await ctx.db
    .query("bookings")
    .withIndex("by_resource", (q) => q.eq("resourceId", booking.resourceId))
    .filter((q) =>
      q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "approved"))
    )
    .collect();

  for (const existing of existingBookings) {
    if (booking.excludeBookingId && existing._id === booking.excludeBookingId) {
      continue;
    }

    const existingEndDate = existing.endDate || existing.startDate;

    // Two date ranges overlap if: start1 <= end2 AND end1 >= start2
    const datesOverlap =
      booking.startDate <= existingEndDate && effectiveEndDate >= existing.startDate;
    if (!datesOverlap) {
      continue;
    }

    const statusLabel = existing.status === "pending" ? " (awaiting approval)" : "";

    // Case 1: Either booking is all-day = automatic conflict
    if (booking.isAllDay || existing.isAllDay) {
      const conflictDates =
        existing.endDate && existing.endDate !== existing.startDate
          ? `${existing.startDate} to ${existing.endDate}`
          : existing.startDate;
      throw new ConvexError({
        code: "BOOKING_CONFLICT",
        message: `This resource is already booked${statusLabel} on ${conflictDates}. Please choose different dates.`,
      });
    }

    // Case 2: Both bookings have specific times
    if (booking.startTime && booking.endTime && existing.startTime && existing.endTime) {
      const newIsSingleDay = effectiveEndDate === booking.startDate;
      const existingIsSingleDay = existingEndDate === existing.startDate;

      let hasTimeConflict = false;

      if (newIsSingleDay && existingIsSingleDay) {
        // Both on the same single day: standard interval overlap
        hasTimeConflict =
          booking.startTime < existing.endTime && booking.endTime > existing.startTime;
      } else if (
        booking.startDate < existingEndDate &&
        effectiveEndDate > existing.startDate
      ) {
        // Overlap extends beyond a single shared edge day, so at least one
        // day is fully occupied by one of the bookings
        hasTimeConflict = true;
      } else if (booking.startDate === existingEndDate) {
        // New booking starts on the existing booking's last day, where the
        // existing booking occupies midnight to its endTime
        hasTimeConflict = booking.startTime < existing.endTime;
      } else if (effectiveEndDate === existing.startDate) {
        // New booking ends on the existing booking's first day, where the
        // existing booking occupies its startTime to midnight
        hasTimeConflict = booking.endTime > existing.startTime;
      }

      if (hasTimeConflict) {
        throw new ConvexError({
          code: "BOOKING_CONFLICT",
          message: `This resource is already booked${statusLabel} from ${existing.startTime} to ${existing.endTime} on ${existing.startDate}${existing.endDate && existing.endDate !== existing.startDate ? ` to ${existing.endDate}` : ""}. Please choose a different time.`,
        });
      }
    }
  }
}

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
      approverOnly: v.optional(v.boolean()),
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
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await hasBookingsAdminAccess(ctx, userId))) {
      return [];
    }

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
      approverOnly: v.optional(v.boolean()),
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
    approverOnly: v.optional(v.boolean()), // If true, only approvers can create bookings
  },
  returns: v.id("bookingResources"),
  handler: async (ctx, args) => {
    const userId = await requireBookingsAdmin(ctx);

    const now = Date.now();

    const resourceId = await ctx.db.insert("bookingResources", {
      name: args.name,
      description: args.description,
      isActive: true,
      approvers: args.approvers,
      approverOnly: args.approverOnly || false,
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
    approverOnly: v.optional(v.boolean()), // If true, only approvers can create bookings
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireBookingsAdmin(ctx);

    await ctx.db.patch(args.resourceId, {
      name: args.name,
      description: args.description,
      isActive: args.isActive,
      approvers: args.approvers,
      approverOnly: args.approverOnly || false,
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
    await requireBookingsAdmin(ctx);

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
 * Get the most recent bookings with user and resource details (admin overview)
 */
export const getBookings = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bookings"),
      _creationTime: v.number(),
      resourceId: v.id("bookingResources"),
      requestedBy: v.optional(v.id("users")),
      isBlocked: v.optional(v.boolean()),
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
    const userId = await getAuthUserId(ctx);
    if (!userId || !(await hasBookingsAdminAccess(ctx, userId))) {
      return [];
    }

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);

    const bookingsWithDetails = await Promise.all(
      bookings.map(async (booking) => {
        const resource = await ctx.db.get(booking.resourceId);
        const requestedByUser = booking.requestedBy ? await ctx.db.get(booking.requestedBy) : null;
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
 * Get a single booking with user and resource details
 */
export const getBooking = query({
  args: {
    bookingId: v.id("bookings"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("bookings"),
      _creationTime: v.number(),
      resourceId: v.id("bookingResources"),
      requestedBy: v.optional(v.id("users")),
      isBlocked: v.optional(v.boolean()),
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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      return null;
    }

    const resource = await ctx.db.get(booking.resourceId);
    const requestedByUser = booking.requestedBy ? await ctx.db.get(booking.requestedBy) : null;

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
      requestedBy: v.optional(v.id("users")),
      isBlocked: v.optional(v.boolean()),
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
      requestedBy: v.optional(v.id("users")),
      isBlocked: v.optional(v.boolean()),
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

    // Get all resources where the current user is an approver (admins see all)
    const currentUser = await ctx.db.get(userId);
    const isAdmin = currentUser?.isAdmin === true;
    const resources = await ctx.db.query("bookingResources").collect();
    const myResourceIds = resources
      .filter((resource) => isAdmin || resource.approvers.includes(userId))
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
        const requestedByUser = booking.requestedBy ? await ctx.db.get(booking.requestedBy) : null;

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
 * Approvers can optionally create bookings on behalf of other users
 * or block a resource without assigning a user
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
    onBehalfOf: v.optional(v.id("users")), // Optional: approvers can book on behalf of another user
    isBlocked: v.optional(v.boolean()), // Optional: block resource without a user (e.g., strike team deployment)
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

    // Determine who the booking is for
    let requestedBy: typeof userId | null = userId;
    let autoApprove = false;
    
    // Get current user info for permission checks
    const currentUser = await ctx.db.get(userId);
    const isApprover = resource.approvers.includes(userId);
    const isAdmin = currentUser?.isAdmin === true;
    
    // Check if resource is approver-only
    if (resource.approverOnly && !isApprover && !isAdmin) {
      throw new Error("This resource can only be booked by its designated approvers");
    }
    
    // Handle blocked bookings (no user assigned)
    if (args.isBlocked) {
      if (!isApprover && !isAdmin) {
        throw new Error("Only approvers or admins can block resources");
      }
      
      requestedBy = null; // No user assigned for blocked bookings
      autoApprove = true;
    } else if (args.onBehalfOf) {
      if (!isApprover && !isAdmin) {
        throw new Error("Only approvers or admins can create bookings on behalf of other users");
      }
      
      // Verify the target user exists
      const targetUser = await ctx.db.get(args.onBehalfOf);
      if (!targetUser) {
        throw new Error("Target user not found");
      }
      
      requestedBy = args.onBehalfOf;
      autoApprove = true; // Auto-approve bookings made by approvers on behalf of others
    } else if (isApprover || isAdmin) {
      // Approvers/admins booking for themselves get auto-approved
      autoApprove = true;
    }

    // Validate time fields if not all-day
    if (!args.isAllDay && (!args.startTime || !args.endTime)) {
      throw new Error("Start time and end time are required for non-all-day bookings");
    }

    // Check for conflicting bookings (only approved or pending ones)
    await assertNoBookingConflict(ctx, {
      resourceId: args.resourceId,
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      isAllDay: args.isAllDay,
    });

    const now = Date.now();

    const bookingId = await ctx.db.insert("bookings", {
      resourceId: args.resourceId,
      requestedBy: requestedBy ?? undefined,
      isBlocked: args.isBlocked || undefined,
      status: autoApprove ? "approved" : "pending",
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      isAllDay: args.isAllDay,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
      // If auto-approved, record who approved it
      ...(autoApprove ? { reviewedBy: userId, reviewedAt: now } : {}),
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

    // Check if the user is an approver for this resource (admins can always approve)
    const resource = await ctx.db.get(booking.resourceId);
    if (!resource) {
      throw new Error("Resource not found");
    }

    const currentUser = await ctx.db.get(userId);
    if (!resource.approvers.includes(userId) && currentUser?.isAdmin !== true) {
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
 * Revert an approved booking back to pending (undo for one-tap approve).
 * Only the reviewer who approved it, or an admin, can revert.
 */
export const revertBookingToPending = mutation({
  args: {
    bookingId: v.id("bookings"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to revert a booking");
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "approved") {
      throw new Error("Only approved bookings can be reverted to pending");
    }

    const currentUser = await ctx.db.get(userId);
    if (booking.reviewedBy !== userId && currentUser?.isAdmin !== true) {
      throw new Error("You are not authorized to revert this booking");
    }

    await ctx.db.patch(args.bookingId, {
      status: "pending",
      reviewedBy: undefined,
      reviewedAt: undefined,
      reviewNotes: undefined,
      updatedAt: Date.now(),
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

    // Check if the user is an approver for this resource (admins can always reject)
    const resource = await ctx.db.get(booking.resourceId);
    if (!resource) {
      throw new Error("Resource not found");
    }

    const currentUser = await ctx.db.get(userId);
    if (!resource.approvers.includes(userId) && currentUser?.isAdmin !== true) {
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

    // Re-check for conflicts with the merged values if the booking will
    // remain active (pending/approved) after this update
    const newStatus = args.status !== undefined ? args.status : booking.status;
    if (newStatus === "pending" || newStatus === "approved") {
      await assertNoBookingConflict(ctx, {
        resourceId: args.resourceId !== undefined ? args.resourceId : booking.resourceId,
        startDate: args.startDate !== undefined ? args.startDate : booking.startDate,
        endDate: args.endDate !== undefined ? args.endDate || undefined : booking.endDate,
        startTime: newIsAllDay ? undefined : newStartTime,
        endTime: newIsAllDay ? undefined : newEndTime,
        isAllDay: newIsAllDay,
        excludeBookingId: args.bookingId,
      });
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
      requestedBy: v.optional(v.id("users")),
      isBlocked: v.optional(v.boolean()),
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
        const requestedByUser = booking.requestedBy ? await ctx.db.get(booking.requestedBy) : null;

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
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

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
