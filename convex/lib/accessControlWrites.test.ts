import { describe, expect, it } from "vitest";
import {
  accessActorName,
  accessWritesState,
  isTruthyFlag,
  siteWritesDisabledEnvName,
  writesDisabledMessage,
} from "./accessControlWrites";

describe("access control kill switch", () => {
  it("treats 1, true, yes and on as on, in any case", () => {
    for (const value of ["1", "true", "TRUE", "Yes", "on", " On "]) {
      expect(isTruthyFlag(value)).toBe(true);
    }
    for (const value of [undefined, "", "0", "false", "no", "off", "disabled", "2"]) {
      expect(isTruthyFlag(value)).toBe(false);
    }
  });

  it("names the per-site variable from the uppercased site id", () => {
    expect(siteWritesDisabledEnvName("satellite")).toBe("ACCESS_CONTROL_WRITES_DISABLED_SATELLITE");
    expect(siteWritesDisabledEnvName("main")).toBe("ACCESS_CONTROL_WRITES_DISABLED_MAIN");
  });

  it("blocks every site with the global switch and one site with its own", () => {
    expect(accessWritesState("satellite", {})).toEqual({ disabled: false });

    const all = { ACCESS_CONTROL_WRITES_DISABLED: "true" };
    expect(accessWritesState("satellite", all)).toEqual({ disabled: true, reason: "allSites" });
    expect(accessWritesState("main", all)).toEqual({ disabled: true, reason: "allSites" });

    const sat = { ACCESS_CONTROL_WRITES_DISABLED_SATELLITE: "yes" };
    expect(accessWritesState("satellite", sat)).toEqual({ disabled: true, reason: "thisSite" });
    expect(accessWritesState("main", sat)).toEqual({ disabled: false });

    expect(accessWritesState("main", { ACCESS_CONTROL_WRITES_DISABLED: "off" })).toEqual({ disabled: false });
  });

  it("words the refusal with the site name", () => {
    expect(writesDisabledMessage("Satellite Station")).toBe(
      "Remote control is switched off in BRAVO for Satellite Station",
    );
  });
});

describe("accessActorName", () => {
  it("uses first and last name, trimmed", () => {
    expect(accessActorName({ firstName: " Jordan ", lastName: "Lee " })).toBe("Jordan Lee");
    expect(accessActorName({ firstName: "Jordan" })).toBe("Jordan");
  });

  it("falls back to the account name only when it isn't an email", () => {
    expect(accessActorName({ name: "Riley Brooks" })).toBe("Riley Brooks");
    expect(accessActorName({ name: "riley.brooks@example.com" })).toBe("Member");
    expect(accessActorName({ firstName: "  ", name: "riley@example.com" })).toBe("Member");
  });

  it("never returns an email, even one typed into a name field", () => {
    expect(accessActorName({ firstName: "riley@example.com", name: "Riley Brooks" })).toBe("Riley Brooks");
    expect(accessActorName({})).toBe("Member");
  });
});
