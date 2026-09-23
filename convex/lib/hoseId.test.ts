import { describe, expect, it } from "vitest";
import { isValidHoseId, normaliseHoseId } from "./hoseId";

describe("hose IDs", () => {
  it("accepts two letters then four digits", () => {
    expect(isValidHoseId("WV3502")).toBe(true);
    expect(isValidHoseId("wv 2510")).toBe(true);
  });

  it("rejects anything else", () => {
    for (const id of ["WV", "WV350", "WV35021", "W3502", "WVX502", "3502WV", ""]) {
      expect(isValidHoseId(id)).toBe(false);
    }
  });

  it("normalises case and spaces", () => {
    expect(normaliseHoseId(" wv 3502 ")).toBe("WV3502");
  });
});
