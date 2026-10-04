// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Repeating bookings: each date is an ordinary booking linked to a series, so
// these tests check the dates that get made, how clashes are handled, and that
// the series can be reviewed and cancelled as one.

async function setup() {
  const t = convexTest(schema, modules);
  const { memberId, otherId, approverId, resourceId } = await t.run(async (ctx) => {
    const memberId = await ctx.db.insert("users", { name: "Sam Nurse", firstName: "Sam" });
    const otherId = await ctx.db.insert("users", { name: "Jo Adams", firstName: "Jo" });
    const approverId = await ctx.db.insert("users", { name: "Alex Carter", firstName: "Max" });
    const resourceId = await ctx.db.insert("bookingResources", {
      name: "Meeting room",
      isActive: true,
      approvers: [approverId],
      createdBy: approverId,
      createdAt: 0,
      updatedAt: 0,
      updatedBy: approverId,
    });
    return { memberId, otherId, approverId, resourceId };
  });
  return {
    t,
    resourceId,
    asMember: t.withIdentity({ subject: memberId }),
    asOther: t.withIdentity({ subject: otherId }),
    asApprover: t.withIdentity({ subject: approverId }),
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

// Tuesday training night, 7-9 PM, through October 2026
const trainingNights = (resourceId: Id<"bookingResources">) => ({
  resourceId,
  startDate: "2026-10-06",
  startTime: "19:00",
  endTime: "21:00",
  isAllDay: false,
  notes: "Training",
  repeat: { frequency: "weekly" as const, untilDate: "2026-10-27" },
});

async function seriesBookings(t: Setup["t"], seriesId: Id<"bookingSeries">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_seriesId", (q) => q.eq("seriesId", seriesId))
      .collect(),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createBooking with a repeat", () => {
  it("makes one pending booking per date, linked to one series", async () => {
    const { t, asMember, resourceId } = await setup();

    const firstId = await asMember.mutation(api.bookings.createBooking, trainingNights(resourceId));
    const first = await t.run(async (ctx) => ctx.db.get(firstId));
    const dates = await seriesBookings(t, first!.seriesId!);

    expect(dates.map((b) => b.startDate)).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
      "2026-10-27",
    ]);
    expect(dates.every((b) => b.status === "pending" && b.startTime === "19:00")).toBe(true);

    const mine = await asMember.query(api.bookings.getMyBookings, {});
    expect(mine[0].series?.description).toBe("Every Tuesday");
  });

  it("names the clashing dates, then books the rest only when asked", async () => {
    const { t, asMember, asOther, resourceId } = await setup();

    await asOther.mutation(api.bookings.createBooking, {
      resourceId,
      startDate: "2026-10-20",
      startTime: "18:00",
      endTime: "20:00",
      isAllDay: false,
      notes: "Committee",
    });

    const error = await asMember
      .mutation(api.bookings.createBooking, trainingNights(resourceId))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<{ code: string; clashDates: string[] }>).data).toMatchObject({
      code: "SERIES_CLASH",
      clashDates: ["2026-10-20"],
      total: 4,
    });

    // Nothing was booked by the refused attempt
    const before = await asMember.query(api.bookings.getMyBookings, {});
    expect(before).toHaveLength(0);

    const firstId = await asMember.mutation(api.bookings.createBooking, {
      ...trainingNights(resourceId),
      skipClashes: true,
    });
    const first = await t.run(async (ctx) => ctx.db.get(firstId));
    const dates = await seriesBookings(t, first!.seriesId!);
    expect(dates.map((b) => b.startDate)).toEqual(["2026-10-06", "2026-10-13", "2026-10-27"]);
  });

  it("refuses a repeat on a multi-day booking", async () => {
    const { asMember, resourceId } = await setup();
    await expect(
      asMember.mutation(api.bookings.createBooking, {
        ...trainingNights(resourceId),
        endDate: "2026-10-07",
      }),
    ).rejects.toThrow(/single-day/);
  });
});

describe("reviewing a series", () => {
  it("approves every pending date at once, and only for an approver", async () => {
    const { t, asMember, asApprover, resourceId } = await setup();
    const firstId = await asMember.mutation(api.bookings.createBooking, trainingNights(resourceId));
    const seriesId = (await t.run(async (ctx) => ctx.db.get(firstId)))!.seriesId!;

    await expect(
      asMember.mutation(api.bookings.approveBookingSeries, { seriesId }),
    ).rejects.toThrow(/not authorized/);

    const approved = await asApprover.mutation(api.bookings.approveBookingSeries, { seriesId });
    expect(approved).toHaveLength(4);
    const dates = await seriesBookings(t, seriesId);
    expect(dates.every((b) => b.status === "approved")).toBe(true);
  });

  it("rejects every pending date with the reviewer's note", async () => {
    const { t, asMember, asApprover, resourceId } = await setup();
    const firstId = await asMember.mutation(api.bookings.createBooking, trainingNights(resourceId));
    const seriesId = (await t.run(async (ctx) => ctx.db.get(firstId)))!.seriesId!;

    await asApprover.mutation(api.bookings.rejectBookingSeries, {
      seriesId,
      reviewNotes: "Room is being painted",
    });
    const dates = await seriesBookings(t, seriesId);
    expect(dates.every((b) => b.status === "rejected" && b.reviewNotes)).toBe(true);
  });
});

describe("cancelBookingSeries", () => {
  it("cancels the remaining dates and leaves the past ones alone", async () => {
    const { t, asMember, resourceId } = await setup();
    const firstId = await asMember.mutation(api.bookings.createBooking, trainingNights(resourceId));
    const seriesId = (await t.run(async (ctx) => ctx.db.get(firstId)))!.seriesId!;

    // Thu 15 Oct 2026, midday in Melbourne
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 15, 1, 0));

    const cancelled = await asMember.mutation(api.bookings.cancelBookingSeries, { seriesId });
    expect(cancelled).toBe(2);

    const dates = await seriesBookings(t, seriesId);
    expect(Object.fromEntries(dates.map((b) => [b.startDate, b.status]))).toEqual({
      "2026-10-06": "pending",
      "2026-10-13": "pending",
      "2026-10-20": "cancelled",
      "2026-10-27": "cancelled",
    });
  });

  it("is only for the member who booked it", async () => {
    const { t, asMember, asOther, resourceId } = await setup();
    const firstId = await asMember.mutation(api.bookings.createBooking, trainingNights(resourceId));
    const seriesId = (await t.run(async (ctx) => ctx.db.get(firstId)))!.seriesId!;

    await expect(
      asOther.mutation(api.bookings.cancelBookingSeries, { seriesId }),
    ).rejects.toThrow(/your own/);
  });
});
