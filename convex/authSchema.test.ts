/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("accepts the verification timestamp written after email OTP sign-in", async () => {
  const t = convexTest(schema);
  const emailVerificationTime = 1789905720174;

  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "member@example.com",
      emailVerificationTime,
    }),
  );

  const user = await t.run((ctx) => ctx.db.get(userId));
  expect(user?.emailVerificationTime).toBe(emailVerificationTime);
});

it("links email OTP to the existing member user", async () => {
  const t = convexTest(schema, modules);
  const email = "member@example.com";
  const memberId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email,
      firstName: "Existing",
      lastName: "Member",
      memberNumber: "1234567",
    }),
  );

  await t.mutation(internal.auth.store, {
    args: {
      type: "createVerificationCode",
      provider: "email-otp",
      email,
      code: "123456",
      expirationTime: Date.now() + 10 * 60 * 1000,
      allowExtraProviders: false,
    },
  });

  const result = await t.run(async (ctx) => {
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .take(2);
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", email),
      )
      .unique();
    return { users, account };
  });

  expect(result.users).toHaveLength(1);
  expect(result.account?.userId).toBe(memberId);
});

it("refuses email OTP when no member has that email", async () => {
  const t = convexTest(schema, modules);
  const email = "unknown@example.com";

  await expect(
    t.mutation(internal.auth.store, {
      args: {
        type: "createVerificationCode",
        provider: "email-otp",
        email,
        code: "123456",
        expirationTime: Date.now() + 10 * 60 * 1000,
        allowExtraProviders: false,
      },
    }),
  ).rejects.toThrow("No BRAVO account exists for this email address");

  const users = await t.run((ctx) =>
    ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .take(1),
  );
  expect(users).toHaveLength(0);
});

it("repairs an OTP account left pointing at a deleted duplicate user", async () => {
  const t = convexTest(schema, modules);
  const email = "member@example.com";
  const { memberId, authAccountId } = await t.run(async (ctx) => {
    const memberId = await ctx.db.insert("users", {
      email,
      firstName: "Existing",
      lastName: "Member",
      memberNumber: "1234567",
    });
    const duplicateId = await ctx.db.insert("users", { email });
    const authAccountId = await ctx.db.insert("authAccounts", {
      userId: duplicateId,
      provider: "email-otp",
      providerAccountId: email,
    });
    await ctx.db.delete(duplicateId);
    return { memberId, authAccountId };
  });

  await t.mutation(internal.auth.store, {
    args: {
      type: "createVerificationCode",
      provider: "email-otp",
      email,
      code: "123456",
      expirationTime: Date.now() + 10 * 60 * 1000,
      allowExtraProviders: false,
    },
  });

  const authAccount = await t.run((ctx) => ctx.db.get(authAccountId));
  expect(authAccount?.userId).toBe(memberId);
});
