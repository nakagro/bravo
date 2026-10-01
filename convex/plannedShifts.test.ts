// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { shiftInstants } from "./plannedShifts";

const modules = import.meta.glob("./**/*.ts");

// Planned shifts: a member stamps shift types onto dates, and each shift
// applies itself at its start via the scheduler. Times are Melbourne wall
// clock, so these tests pin the system time to a known Melbourne instant.

// Tue 6 Oct 2026, 10:00 AEDT (UTC+11). Daylight saving began Sun 4 Oct.
const NOW = Date.UTC(2026, 9, 5, 23, 0);
const HOUR = 60 * 60 * 1000;

async function setup() {
  const t = convexTest(schema, modules);
  const { memberId, otherId, sharedId, adminId } = await t.run(async (ctx) => {
    const memberId = await ctx.db.insert("users", {
      name: "Sam Nurse",
      firstName: "Sam",
      lastName: "Nurse",
    });
    const otherId = await ctx.db.insert("users", {
      name: "Jo Adams",
      firstName: "Jo",
      lastName: "Adams",
    });
    const sharedId = await ctx.db.insert("users", {
      name: "DO Phone",
      accountType: "shared",
    });
    const adminId = await ctx.db.insert("users", {
      name: "Alex Carter",
      firstName: "Max",
      lastName: "Carter",
      isAdmin: true,
    });
    return { memberId, otherId, sharedId, adminId };
  });
  return {
    t,
    memberId,
    otherId,
    adminId,
    asMember: t.withIdentity({ subject: memberId }),
    asOther: t.withIdentity({ subject: otherId }),
    asShared: t.withIdentity({ subject: sharedId }),
    asAdmin: t.withIdentity({ subject: adminId }),
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

const night = {
  name: "Night",
  startTime: "21:00",
  endTime: "07:30",
  status: "not available" as const,
};
const early = {
  name: "Early",
  startTime: "07:00",
  endTime: "15:30",
  status: "not available" as const,
};

async function createType(s: Setup, fields: typeof night = night) {
  return await s.asMember.mutation(api.plannedShifts.createShiftType, fields);
}

async function shiftOn(s: Setup, date: string) {
  return await s.t.run(async (ctx) =>
    ctx.db
      .query("plannedShifts")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", s.memberId).eq("date", date))
      .first(),
  );
}

async function user(s: Setup, id: Id<"users"> = s.memberId) {
  return await s.t.run(async (ctx) => ctx.db.get(id));
}

/** Run the job the scheduler would run at the shift's start. */
async function apply(s: Setup, shiftId: Id<"plannedShifts">, startAt: number) {
  await s.t.mutation(internal.plannedShifts.applyShift, { shiftId, startAt });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("shiftInstants", () => {
  it("puts an overnight shift's end on the next day", () => {
    const { startAt, endAt } = shiftInstants("2026-10-06", "21:00", "07:30");
    expect(startAt).toBe(Date.UTC(2026, 9, 6, 10, 0)); // 21:00 AEDT
    expect(endAt).toBe(Date.UTC(2026, 9, 6, 20, 30)); // 07:30 AEDT next day
  });

  it("keeps wall-clock times across the October DST change", () => {
    // Sat 3 Oct 21:00 AEST to Sun 4 Oct 07:30 AEDT: one real hour shorter.
    const { startAt, endAt } = shiftInstants("2026-10-03", "21:00", "07:30");
    expect(startAt).toBe(Date.UTC(2026, 9, 3, 11, 0));
    expect(endAt).toBe(Date.UTC(2026, 9, 3, 20, 30));
    expect(endAt - startAt).toBe(9.5 * HOUR);
  });

  it("keeps wall-clock times across the April DST change", () => {
    // Sat 3 Apr 2027 21:00 AEDT to Sun 4 Apr 07:30 AEST: one real hour longer.
    const { startAt, endAt } = shiftInstants("2027-04-03", "21:00", "07:30");
    expect(startAt).toBe(Date.UTC(2027, 3, 3, 10, 0));
    expect(endAt).toBe(Date.UTC(2027, 3, 3, 21, 30));
    expect(endAt - startAt).toBe(11.5 * HOUR);
  });

  it("pins a 02:30 start on both DST Sundays", () => {
    // 02:30 doesn't exist on 4 Oct 2026 and happens twice on 4 Apr 2027.
    // Whatever brigadeTimestamp picks, the shift must still end after it starts.
    const october = shiftInstants("2026-10-04", "02:30", "10:00");
    expect(october.startAt).toBe(Date.UTC(2026, 9, 3, 16, 30));
    expect(october.endAt).toBeGreaterThan(october.startAt);

    const april = shiftInstants("2027-04-04", "02:30", "10:00");
    expect(april.startAt).toBe(Date.UTC(2027, 3, 3, 16, 30));
    expect(april.endAt).toBeGreaterThan(april.startAt);
  });
});

describe("applyShift", () => {
  it("sets the status like Add Duration, then the transition cron clears it", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, {
      date: "2026-10-06",
      shiftTypeId: typeId,
    });
    const shift = (await shiftOn(s, "2026-10-06"))!;

    vi.setSystemTime(shift.startAt);
    await apply(s, shift._id, shift.startAt);

    const during = (await user(s))!;
    expect(during.currentStatus).toBe("not available");
    expect(during.statusExpiresAt).toBe(shift.endAt);
    expect(during.statusDurationHours).toBe(10.5);
    expect(during.nextStatus).toBe("reset");
    expect(during.nextStatusAt).toBe(shift.endAt);
    expect((await shiftOn(s, "2026-10-06"))!.state).toBe("applied");
    const history = await s.t.run(async (ctx) => ctx.db.query("memberStatusHistory").collect());
    expect(history).toMatchObject([{ userId: s.memberId, status: "not available" }]);

    vi.setSystemTime(shift.endAt);
    await s.t.mutation(api.availability.processStatusTransitions, {});
    expect((await user(s))!.currentStatus).toBeUndefined();
  });

  it("switches to the type's after-status when the shift ends", async () => {
    const s = await setup();
    const typeId = await s.asMember.mutation(api.plannedShifts.createShiftType, {
      ...early,
      afterStatus: "available - station",
    });
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, {
      date: "2026-10-07",
      shiftTypeId: typeId,
    });
    const shift = (await shiftOn(s, "2026-10-07"))!;

    vi.setSystemTime(shift.startAt);
    await apply(s, shift._id, shift.startAt);
    vi.setSystemTime(shift.endAt);
    await s.t.mutation(api.availability.processStatusTransitions, {});

    const after = (await user(s))!;
    expect(after.currentStatus).toBe("available - station");
    expect(after.statusExpiresAt).toBeUndefined();
  });

  it("isn't blocked by a status with no expiry, such as yesterday's after-status", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, {
      date: "2026-10-06",
      shiftTypeId: typeId,
    });
    const shift = (await shiftOn(s, "2026-10-06"))!;
    await s.t.run(async (ctx) =>
      ctx.db.patch(s.memberId, {
        currentStatus: "available - station",
        statusUpdatedAt: NOW,
      }),
    );

    vi.setSystemTime(shift.startAt);
    await apply(s, shift._id, shift.startAt);
    expect((await user(s))!.currentStatus).toBe("not available");
  });

  it("skips when a manual status runs past the shift's end", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, {
      date: "2026-10-06",
      shiftTypeId: typeId,
    });
    const shift = (await shiftOn(s, "2026-10-06"))!;
    const threeDays = NOW + 72 * HOUR;
    await s.t.run(async (ctx) =>
      ctx.db.patch(s.memberId, {
        currentStatus: "delayed response",
        statusUpdatedAt: NOW,
        statusExpiresAt: threeDays,
      }),
    );

    vi.setSystemTime(shift.startAt);
    await apply(s, shift._id, shift.startAt);

    expect((await user(s))!.currentStatus).toBe("delayed response");
    expect((await user(s))!.statusExpiresAt).toBe(threeDays);
    expect((await shiftOn(s, "2026-10-06"))!.state).toBe("skipped");
  });

  it("skips a disabled member, a deleted member and a shift that has ended", async () => {
    const s = await setup();
    const typeId = await createType(s);
    for (const date of ["2026-10-06", "2026-10-08", "2026-10-10"]) {
      await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date, shiftTypeId: typeId });
    }

    // Ended: the job runs after the shift is already over.
    const ended = (await shiftOn(s, "2026-10-06"))!;
    vi.setSystemTime(ended.endAt + HOUR);
    await apply(s, ended._id, ended.startAt);
    expect((await shiftOn(s, "2026-10-06"))!.state).toBe("skipped");

    // Disabled.
    const second = (await shiftOn(s, "2026-10-08"))!;
    await s.t.run(async (ctx) => ctx.db.patch(s.memberId, { isDisabled: true }));
    vi.setSystemTime(second.startAt);
    await apply(s, second._id, second.startAt);
    expect((await shiftOn(s, "2026-10-08"))!.state).toBe("skipped");
    expect((await user(s))!.currentStatus).toBeUndefined();

    // Deleted (row removed without the deleteUser cleanup).
    const third = (await shiftOn(s, "2026-10-10"))!;
    await s.t.run(async (ctx) => ctx.db.delete(s.memberId));
    vi.setSystemTime(third.startAt);
    await apply(s, third._id, third.startAt);
    expect((await shiftOn(s, "2026-10-10"))!.state).toBe("skipped");
  });

  it("does nothing for a stale job: after removal, a swap, or an edit", async () => {
    const s = await setup();
    const nightId = await createType(s);
    const earlyId = await createType(s, early);

    // Removed.
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-07", shiftTypeId: nightId });
    const removed = (await shiftOn(s, "2026-10-07"))!;
    await s.asMember.mutation(api.plannedShifts.removePlannedShift, { id: removed._id });
    vi.setSystemTime(removed.startAt);
    await apply(s, removed._id, removed.startAt);
    expect((await user(s))!.currentStatus).toBeUndefined();

    // Swapped: the old row is gone, so its job finds nothing.
    vi.setSystemTime(NOW);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-09", shiftTypeId: nightId });
    const beforeSwap = (await shiftOn(s, "2026-10-09"))!;
    expect(
      await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-09", shiftTypeId: earlyId }),
    ).toBe("swapped");
    vi.setSystemTime(beforeSwap.startAt);
    await apply(s, beforeSwap._id, beforeSwap.startAt);
    expect((await shiftOn(s, "2026-10-09"))!.state).toBe("pending");

    // Edited: startAt moved, so the job scheduled for the old start does nothing.
    vi.setSystemTime(NOW);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-12", shiftTypeId: nightId });
    const beforeEdit = (await shiftOn(s, "2026-10-12"))!;
    await s.asMember.mutation(api.plannedShifts.updateShiftType, {
      id: nightId,
      ...night,
      startTime: "22:00",
    });
    vi.setSystemTime(beforeEdit.startAt);
    await apply(s, beforeEdit._id, beforeEdit.startAt);
    expect((await shiftOn(s, "2026-10-12"))!.state).toBe("pending");
    expect((await user(s))!.currentStatus).toBeUndefined();
  });
});

describe("toggleShiftOnDate", () => {
  it("adds, removes, and swaps", async () => {
    const s = await setup();
    const nightId = await createType(s);
    const earlyId = await createType(s, early);
    const toggle = (shiftTypeId: Id<"shiftTypes">) =>
      s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId });

    expect(await toggle(nightId)).toBe("added");
    expect((await shiftOn(s, "2026-10-08"))!.name).toBe("Night");
    expect(await toggle(earlyId)).toBe("swapped");
    expect((await shiftOn(s, "2026-10-08"))!.name).toBe("Early");
    expect(await toggle(earlyId)).toBe("removed");
    expect(await shiftOn(s, "2026-10-08")).toBeNull();
  });

  it("rejects past dates and dates beyond the 3-month horizon", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await expect(
      s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-05", shiftTypeId: typeId }),
    ).rejects.toThrow(/passed/);
    await expect(
      s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2027-01-20", shiftTypeId: typeId }),
    ).rejects.toThrow(/3 months/);
  });

  it("rejects a shift that overlaps the next day's", async () => {
    const s = await setup();
    const nightId = await createType(s);
    const earlyId = await createType(s, early);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: nightId });
    // Early on the 9th starts 07:00, before the Night ends at 07:30.
    await expect(
      s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-09", shiftTypeId: earlyId }),
    ).rejects.toThrow(/overlap the Night shift/);
  });

  it("caps upcoming shifts at 120", async () => {
    const s = await setup();
    const typeId = await createType(s, early);
    await s.t.run(async (ctx) => {
      for (let i = 0; i < 120; i++) {
        await ctx.db.insert("plannedShifts", {
          userId: s.memberId,
          shiftTypeId: typeId,
          name: "Early",
          colour: 0,
          status: "not available",
          afterStatus: "reset",
          // Fake dates in the future; only the count matters here.
          date: `2026-11-${String(i).padStart(3, "0")}`,
          startAt: NOW + (i + 1) * 24 * HOUR,
          endAt: NOW + (i + 1) * 24 * HOUR + HOUR,
          state: "pending",
        });
      }
    });
    await expect(
      s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: typeId }),
    ).rejects.toThrow(/120/);
  });

  it("applies a shift at once when stamped after its start", async () => {
    const s = await setup();
    // 10:00 now; the Early started at 07:00 and runs to 15:30.
    const typeId = await createType(s, early);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-06", shiftTypeId: typeId });
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await shiftOn(s, "2026-10-06"))!.state).toBe("applied");
    expect((await user(s))!.currentStatus).toBe("not available");
  });

  it("removing a shift in progress clears the status it set, but not one changed since", async () => {
    const s = await setup();
    const typeId = await createType(s, early);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-06", shiftTypeId: typeId });
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    const shift = (await shiftOn(s, "2026-10-06"))!;
    await s.asMember.mutation(api.plannedShifts.removePlannedShift, { id: shift._id });
    expect((await user(s))!.currentStatus).toBeUndefined();

    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-06", shiftTypeId: typeId });
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    await s.asMember.mutation(api.availability.updateUserStatus, { status: "available - station" });
    const again = (await shiftOn(s, "2026-10-06"))!;
    await s.asMember.mutation(api.plannedShifts.removePlannedShift, { id: again._id });
    expect((await user(s))!.currentStatus).toBe("available - station");
  });
});

describe("setShiftTimes", () => {
  const setTimes = (s: Setup, date: string, startTime: string, endTime: string) =>
    s.asMember.mutation(api.plannedShifts.setShiftTimes, { date, startTime, endTime });

  it("adds a one-off shift with no type, then updates and leaves it unchanged", async () => {
    const s = await setup();
    expect(await setTimes(s, "2026-10-08", "06:45", "15:15")).toBe("added");
    const added = (await shiftOn(s, "2026-10-08"))!;
    expect(added).toMatchObject({
      name: "Shift",
      colour: -1,
      status: "not available",
      afterStatus: "reset",
      state: "pending",
      startAt: shiftInstants("2026-10-08", "06:45", "15:15").startAt,
    });
    expect(added.shiftTypeId).toBeUndefined();

    expect(await setTimes(s, "2026-10-08", "06:45", "15:15")).toBe("unchanged");
    expect(await setTimes(s, "2026-10-08", "22:00", "06:00")).toBe("updated");
    const updated = (await shiftOn(s, "2026-10-08"))!;
    expect(updated.endAt).toBe(shiftInstants("2026-10-08", "22:00", "06:00").endAt);

    // The first shift's job is stale: its row is gone.
    vi.setSystemTime(added.startAt);
    await apply(s, added._id, added.startAt);
    expect((await user(s))!.currentStatus).toBeUndefined();
  });

  it("detaches a typed shift whose times are changed, so editing the type leaves it", async () => {
    const s = await setup();
    const nightId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: nightId });
    expect(await setTimes(s, "2026-10-08", "20:00", "06:00")).toBe("updated");

    const detached = (await shiftOn(s, "2026-10-08"))!;
    expect(detached.shiftTypeId).toBeUndefined();
    expect(detached.name).toBe("Night");

    await s.asMember.mutation(api.plannedShifts.updateShiftType, { id: nightId, ...night, startTime: "22:00" });
    expect((await shiftOn(s, "2026-10-08"))!.startAt).toBe(detached.startAt);

    // Tapping the Night on the calendar swaps the one-off back to the type.
    expect(
      await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: nightId }),
    ).toBe("swapped");
  });

  it("applies the one-off shift at its start like any other", async () => {
    const s = await setup();
    await setTimes(s, "2026-10-08", "06:45", "15:15");
    const shift = (await shiftOn(s, "2026-10-08"))!;
    vi.setSystemTime(shift.startAt);
    await apply(s, shift._id, shift.startAt);
    expect((await user(s))!.currentStatus).toBe("not available");
    expect((await user(s))!.nextStatus).toBe("reset");
  });

  it("rejects past dates, bad times and overlaps, and refuses shared accounts", async () => {
    const s = await setup();
    await expect(setTimes(s, "2026-10-05", "07:00", "15:00")).rejects.toThrow(/passed/);
    await expect(setTimes(s, "2026-10-08", "0700", "15:00")).rejects.toThrow(/valid time/);
    await expect(setTimes(s, "2026-10-08", "07:00", "07:00")).rejects.toThrow(/same time/);
    await setTimes(s, "2026-10-08", "21:00", "07:30");
    await expect(setTimes(s, "2026-10-09", "07:00", "15:00")).rejects.toThrow(/overlap/);
    await expect(
      s.asShared.mutation(api.plannedShifts.setShiftTimes, {
        date: "2026-10-08",
        startTime: "07:00",
        endTime: "15:00",
      }),
    ).rejects.toThrow(/member accounts/);
  });
});

describe("updateShiftType", () => {
  it("re-stamps pending shifts and leaves applied ones", async () => {
    const s = await setup();
    const typeId = await createType(s, early);
    for (const date of ["2026-10-06", "2026-10-08", "2026-10-10"]) {
      await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date, shiftTypeId: typeId });
    }
    // Today's Early has started, so it applies.
    await s.t.finishInProgressScheduledFunctions();
    vi.advanceTimersByTime(0);
    await s.t.finishInProgressScheduledFunctions();
    const applied = (await shiftOn(s, "2026-10-06"))!;
    expect(applied.state).toBe("applied");

    const types = await s.asMember.query(api.plannedShifts.getMyShiftTypes, {});
    expect(types[0].pendingCount).toBe(2);

    const result = await s.asMember.mutation(api.plannedShifts.updateShiftType, {
      id: typeId,
      ...early,
      name: "Morning",
      startTime: "08:00",
    });
    expect(result.restamped).toBe(2);

    const moved = (await shiftOn(s, "2026-10-08"))!;
    expect(moved.name).toBe("Morning");
    expect(moved.startAt).toBe(shiftInstants("2026-10-08", "08:00", "15:30").startAt);
    const untouched = (await shiftOn(s, "2026-10-06"))!;
    expect(untouched.name).toBe("Early");
    expect(untouched.startAt).toBe(applied.startAt);
  });

  it("rejects an edit that would overlap a neighbour, naming the date", async () => {
    const s = await setup();
    const nightId = await createType(s);
    const lateId = await createType(s, { ...early, name: "Late", startTime: "13:00", endTime: "21:30" });
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: nightId });
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-09", shiftTypeId: lateId });

    // Running the Night to 14:00 would run into Friday's Late.
    await expect(
      s.asMember.mutation(api.plannedShifts.updateShiftType, { id: nightId, ...night, endTime: "14:00" }),
    ).rejects.toThrow(/Thu 8 Oct would overlap the Late shift on Fri 9 Oct/);
    // Nothing changed.
    expect((await shiftOn(s, "2026-10-08"))!.endAt).toBe(shiftInstants("2026-10-08", "21:00", "07:30").endAt);
  });

  it("validates times and caps types at 6", async () => {
    const s = await setup();
    await expect(createType(s, { ...night, startTime: "2100" })).rejects.toThrow(/valid time/);
    await expect(createType(s, { ...night, endTime: "21:00" })).rejects.toThrow(/same time/);
    for (let i = 0; i < 6; i++) await createType(s, { ...night, name: `T${i}` });
    const colours = (await s.asMember.query(api.plannedShifts.getMyShiftTypes, {})).map((t) => t.colour);
    expect(colours).toEqual([0, 1, 2, 3, 4, 5]);
    await expect(createType(s)).rejects.toThrow(/up to 6/);
  });

  it("deleting a type leaves its shifts on the calendar", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: typeId });
    await s.asMember.mutation(api.plannedShifts.deleteShiftType, { id: typeId });
    expect(await s.asMember.query(api.plannedShifts.getMyShiftTypes, {})).toEqual([]);
    expect((await shiftOn(s, "2026-10-08"))!.name).toBe("Night");
  });
});

describe("access", () => {
  it("never shows or touches another member's shifts", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: typeId });
    const shift = (await shiftOn(s, "2026-10-08"))!;

    expect(await s.asOther.query(api.plannedShifts.getMyShiftTypes, {})).toEqual([]);
    expect(
      await s.asOther.query(api.plannedShifts.getMyPlannedShifts, { from: "2026-10-01", to: "2026-12-31" }),
    ).toEqual([]);
    await expect(
      s.asOther.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-09", shiftTypeId: typeId }),
    ).rejects.toThrow(/not found/);
    await expect(
      s.asOther.mutation(api.plannedShifts.updateShiftType, { id: typeId, ...night }),
    ).rejects.toThrow(/not found/);
    await expect(s.asOther.mutation(api.plannedShifts.deleteShiftType, { id: typeId })).rejects.toThrow(
      /not found/,
    );
    await expect(
      s.asOther.mutation(api.plannedShifts.removePlannedShift, { id: shift._id }),
    ).rejects.toThrow(/not found/);
    expect(await shiftOn(s, "2026-10-08")).not.toBeNull();
  });

  it("refuses shared accounts", async () => {
    const s = await setup();
    await expect(s.asShared.mutation(api.plannedShifts.createShiftType, night)).rejects.toThrow(
      /member accounts/,
    );
  });

  it("deleteUser removes the member's shift types and shifts", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: typeId });
    await s.asAdmin.mutation(api.users.deleteUser, { userId: s.memberId });
    await s.t.run(async (ctx) => {
      expect(await ctx.db.query("shiftTypes").collect()).toHaveLength(0);
      expect(await ctx.db.query("plannedShifts").collect()).toHaveLength(0);
    });
  });
});

describe("You tab summary", () => {
  it("counts pending shifts and names the next one", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-10", shiftTypeId: typeId });
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: typeId });
    const info = (await s.asMember.query(api.availability.getUserInfoForYouTab, {}))!;
    expect(info.canPlanShifts).toBe(true);
    expect(info.plannedShifts.upcomingCount).toBe(2);
    expect(info.plannedShifts.next).toMatchObject({
      name: "Night",
      startAt: shiftInstants("2026-10-08", "21:00", "07:30").startAt,
    });
  });
});

describe("clearStatus", () => {
  it("leaves a status whose expiry is still ahead", async () => {
    const s = await setup();
    await s.t.run(async (ctx) =>
      ctx.db.patch(s.memberId, {
        currentStatus: "not available",
        statusExpiresAt: NOW + HOUR,
      }),
    );
    await s.t.mutation(internal.availability.clearStatus, { userId: s.memberId });
    expect((await user(s))!.currentStatus).toBe("not available");

    await s.t.run(async (ctx) => ctx.db.patch(s.memberId, { statusExpiresAt: undefined }));
    await s.t.mutation(internal.availability.clearStatus, { userId: s.memberId });
    expect((await user(s))!.currentStatus).toBeUndefined();
  });
});

describe("cleanupOldPlannedShifts", () => {
  it("deletes shifts that ended more than a week ago", async () => {
    const s = await setup();
    const typeId = await createType(s);
    await s.asMember.mutation(api.plannedShifts.toggleShiftOnDate, { date: "2026-10-08", shiftTypeId: typeId });
    const shift = (await shiftOn(s, "2026-10-08"))!;

    vi.setSystemTime(shift.endAt + 6 * 24 * HOUR);
    expect(await s.t.mutation(internal.plannedShifts.cleanupOldPlannedShifts, {})).toBe(0);
    vi.setSystemTime(shift.endAt + 8 * 24 * HOUR);
    expect(await s.t.mutation(internal.plannedShifts.cleanupOldPlannedShifts, {})).toBe(1);
  });
});
