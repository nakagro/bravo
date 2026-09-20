// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";

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
