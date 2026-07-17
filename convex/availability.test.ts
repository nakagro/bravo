// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// getStatuses hides a member's status once it predates the daily 4am cutoff
// or has passed its explicit expiry. The cutoff is computed from the
// *server's local* clock, so these tests pin the system time.

const seedUser = (
  t: ReturnType<typeof convexTest>,
  fields: Record<string, unknown>,
) =>
  t.run(async (ctx) => {
    return ctx.db.insert("users", {
      name: "Test Member",
      ...fields,
    });
  });

describe("getStatuses 4am cutoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a status set after today's 4am cutoff", async () => {
    vi.setSystemTime(new Date(2026, 6, 17, 10, 0)); // 10:00 local
    const t = convexTest(schema);
    await seedUser(t, {
      currentStatus: "available - station",
      statusUpdatedAt: new Date(2026, 6, 17, 5, 0).getTime(), // 05:00 today
    });

    const statuses = await t.query(api.availability.getStatuses, {});
    expect(statuses[0].currentStatus).toBe("available - station");
  });

  it("resets a status set before today's 4am cutoff", async () => {
    vi.setSystemTime(new Date(2026, 6, 17, 10, 0));
    const t = convexTest(schema);
    await seedUser(t, {
      currentStatus: "available - station",
      statusUpdatedAt: new Date(2026, 6, 16, 21, 0).getTime(), // 21:00 yesterday
    });

    const statuses = await t.query(api.availability.getStatuses, {});
    expect(statuses[0].currentStatus).toBeUndefined();
    expect(statuses[0].statusUpdatedAt).toBeUndefined();
  });

  it("before 4am, uses the previous day's cutoff so overnight statuses survive", async () => {
    vi.setSystemTime(new Date(2026, 6, 17, 3, 30)); // 03:30 local
    const t = convexTest(schema);
    await seedUser(t, {
      currentStatus: "not available",
      statusUpdatedAt: new Date(2026, 6, 16, 21, 0).getTime(), // 21:00 yesterday
    });

    const statuses = await t.query(api.availability.getStatuses, {});
    expect(statuses[0].currentStatus).toBe("not available");
  });

  it("resets a status whose explicit expiry has passed", async () => {
    vi.setSystemTime(new Date(2026, 6, 17, 10, 0));
    const t = convexTest(schema);
    await seedUser(t, {
      currentStatus: "delayed response",
      statusUpdatedAt: new Date(2026, 6, 17, 8, 0).getTime(),
      statusExpiresAt: new Date(2026, 6, 17, 9, 0).getTime(), // expired an hour ago
    });

    const statuses = await t.query(api.availability.getStatuses, {});
    expect(statuses[0].currentStatus).toBeUndefined();
  });
});
