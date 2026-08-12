// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { moduleSettingAllows } from "./modules";
import { Doc } from "./_generated/dataModel";

/**
 * The "any" mode exists for gates like Events Admin, where officers qualify on
 * rank and the social crew qualify on role. These lock in that "all" stays the
 * behaviour of every row written before the field existed.
 */

function user(overrides: Partial<Doc<"users">>): Doc<"users"> {
  return {
    _id: "users:test" as Doc<"users">["_id"],
    _creationTime: 0,
    isAdmin: false,
    ...overrides,
  } as Doc<"users">;
}

function setting(overrides: Partial<Doc<"moduleSettings">>): Doc<"moduleSettings"> {
  return {
    _id: "moduleSettings:test" as Doc<"moduleSettings">["_id"],
    _creationTime: 0,
    moduleId: "eventsAdmin",
    moduleName: "Events Admin",
    isEnabled: true,
    adminOnly: false,
    requiredRoles: [],
    ...overrides,
  } as Doc<"moduleSettings">;
}

const rankOnly = user({ rank: "Lieutenant", roles: [] });
const roleOnly = user({ rank: "Brigade Member", roles: ["Social Admin"] });
const neither = user({ rank: "Firefighter", roles: ["Key Manager"] });
const both = user({ rank: "Captain", roles: ["Social Admin"] });

describe("moduleSettingAllows requirementMode", () => {
  const gate = { requiredRoles: ["Social Admin"], minimumRank: "Lieutenant" as const };

  it('defaults to AND when requirementMode is absent (pre-existing rows)', () => {
    const s = setting(gate);
    expect(moduleSettingAllows(rankOnly, s)).toBe(false);
    expect(moduleSettingAllows(roleOnly, s)).toBe(false);
    expect(moduleSettingAllows(both, s)).toBe(true);
  });

  it('requires both when mode is "all"', () => {
    const s = setting({ ...gate, requirementMode: "all" });
    expect(moduleSettingAllows(rankOnly, s)).toBe(false);
    expect(moduleSettingAllows(roleOnly, s)).toBe(false);
    expect(moduleSettingAllows(both, s)).toBe(true);
  });

  it('accepts either the rank or the role when mode is "any"', () => {
    const s = setting({ ...gate, requirementMode: "any" });
    expect(moduleSettingAllows(rankOnly, s)).toBe(true);
    expect(moduleSettingAllows(roleOnly, s)).toBe(true);
    expect(moduleSettingAllows(both, s)).toBe(true);
    expect(moduleSettingAllows(neither, s)).toBe(false);
  });

  it('still denies everyone below the bar when only one requirement is set', () => {
    const rankGate = setting({ minimumRank: "Lieutenant", requirementMode: "any" });
    expect(moduleSettingAllows(roleOnly, rankGate)).toBe(false);
    expect(moduleSettingAllows(rankOnly, rankGate)).toBe(true);

    const roleGate = setting({ requiredRoles: ["Social Admin"], requirementMode: "any" });
    expect(moduleSettingAllows(rankOnly, roleGate)).toBe(false);
    expect(moduleSettingAllows(roleOnly, roleGate)).toBe(true);
  });

  it("a disabled or admin-only module denies regardless of mode", () => {
    expect(
      moduleSettingAllows(both, setting({ ...gate, requirementMode: "any", isEnabled: false })),
    ).toBe(false);
    expect(
      moduleSettingAllows(both, setting({ ...gate, requirementMode: "any", adminOnly: true })),
    ).toBe(false);
  });
});
