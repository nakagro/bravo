// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret-0123456789abcdef0123456789abcdef";

function post(t: ReturnType<typeof convexTest>, body: unknown, auth?: string) {
  return t.fetch("/labs/member", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth !== undefined ? { Authorization: auth } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function setup() {
  vi.stubEnv("LABS_MEMBER_CHECK_SECRET", SECRET);
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const base = { firstName: "Pat", lastName: "Doe", rank: "Firefighter" as const };
    return {
      member: await ctx.db.insert("users", base),
      shared: await ctx.db.insert("users", { ...base, accountType: "shared" as const }),
      disabled: await ctx.db.insert("users", { ...base, isDisabled: true }),
      deleted: await ctx.db.insert("users", base),
    };
  });
  await t.run((ctx) => ctx.db.delete(ids.deleted));
  return { t, ids };
}

const bearer = `Bearer ${SECRET}`;

describe("POST /labs/member", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports a member", async () => {
    const { t, ids } = await setup();
    const res = await post(t, { userId: ids.member }, bearer);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ member: true });
  });

  it("reports shared, disabled and deleted accounts as non-members", async () => {
    const { t, ids } = await setup();
    for (const id of [ids.shared, ids.disabled, ids.deleted]) {
      const res = await post(t, { userId: id }, bearer);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ member: false });
    }
  });

  it("reports an unknown or invalid id as a non-member, never 404", async () => {
    const { t } = await setup();
    for (const userId of ["not-an-id", "jd7abcdefghijklmnopqrstuvwxyz12"]) {
      const res = await post(t, { userId }, bearer);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ member: false });
    }
  });

  it("rejects a missing or wrong secret", async () => {
    const { t, ids } = await setup();
    expect((await post(t, { userId: ids.member })).status).toBe(401);
    expect((await post(t, { userId: ids.member }, "Bearer wrong")).status).toBe(401);
    expect((await post(t, { userId: ids.member }, SECRET)).status).toBe(401);
  });

  it("fails closed when the secret is unset", async () => {
    const { t, ids } = await setup();
    vi.stubEnv("LABS_MEMBER_CHECK_SECRET", "");
    expect((await post(t, { userId: ids.member }, "Bearer ")).status).toBe(401);
    expect((await post(t, { userId: ids.member }, bearer)).status).toBe(401);
  });

  it("rejects a malformed body", async () => {
    const { t } = await setup();
    expect((await post(t, "{nope", bearer)).status).toBe(400);
    expect((await post(t, { userId: 42 }, bearer)).status).toBe(400);
    expect((await post(t, {}, bearer)).status).toBe(400);
  });
});
