import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("strips the Convex server wrapper and stack", () => {
    const error = new Error(
      "[CONVEX M(keys:remove)] [Request ID: abc] Server Error\nUncaught Error: Key is signed out\n    at handler (../convex/keys.ts:10:5)",
    );
    expect(errorMessage(error)).toBe("Key is signed out");
  });

  it("keeps a plain error message", () => {
    expect(errorMessage(new Error("Network down"))).toBe("Network down");
  });

  it("reads ConvexError data", () => {
    expect(errorMessage(new ConvexError("Already booked"))).toBe("Already booked");
    expect(errorMessage(new ConvexError({ code: "X", message: "Clash" }))).toBe("Clash");
  });

  it("falls back for non-errors and empty text", () => {
    expect(errorMessage("nope", "Could not save")).toBe("Could not save");
    expect(errorMessage(new Error(""), "Could not save")).toBe("Could not save");
  });
});
