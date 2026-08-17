import { describe, expect, it } from "vitest";
import { compareUserNames } from "./types";

describe("compareUserNames", () => {
  it("sorts members by their displayed full name without case sensitivity", () => {
    const members = [
      { firstName: "Zoe", lastName: "Able" },
      { name: "alice Young" },
      { firstName: "Alice", lastName: "Zeal" },
    ];

    expect([...members].sort(compareUserNames)).toEqual([
      { name: "alice Young" },
      { firstName: "Alice", lastName: "Zeal" },
      { firstName: "Zoe", lastName: "Able" },
    ]);
  });

  it("uses natural numeric ordering", () => {
    const members = [{ name: "Member 10" }, { name: "Member 2" }];

    expect([...members].sort(compareUserNames).map((member) => member.name)).toEqual([
      "Member 2",
      "Member 10",
    ]);
  });
});
