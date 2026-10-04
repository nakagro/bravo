import { describe, expect, it } from "vitest";
import { compareBySeniority, formatRank, type Rank } from "./ranks";

const person = (lastName: string, rank?: Rank, lieutenantNumber?: number) => ({
  firstName: "A",
  lastName,
  rank,
  lieutenantNumber,
});

describe("seniority", () => {
  it("orders Captain, Lieutenants by number, then everyone else by rank and surname", () => {
    const people = [
      person("Young", "Firefighter"),
      person("Brown", "Brigade Member"),
      person("Smith", "Lieutenant", 2),
      person("Adams", "Probationary"),
      person("Jones", "Lieutenant"),
      person("Clark", "Firefighter"),
      person("Wells", "Lieutenant", 1),
      person("Kerr", "Captain"),
      person("Nobody"),
    ];

    expect([...people].sort(compareBySeniority).map((p) => p.lastName)).toEqual([
      "Kerr",
      "Wells",
      "Smith",
      "Jones", // an unnumbered Lieutenant follows the numbered ones
      "Clark",
      "Young",
      "Adams",
      "Brown",
      "Nobody",
    ]);
  });

  it("names a numbered Lieutenant", () => {
    expect(formatRank(person("Wells", "Lieutenant", 1))).toBe("1st Lieutenant");
    expect(formatRank(person("Smith", "Lieutenant", 3))).toBe("3rd Lieutenant");
    expect(formatRank(person("Jones", "Lieutenant"))).toBe("Lieutenant");
    expect(formatRank(person("Kerr", "Captain"))).toBe("Captain");
    expect(formatRank(person("Nobody"))).toBe("");
  });
});
