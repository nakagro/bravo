import { describe, expect, it } from "vitest";
import {
  attentionItems,
  mergeActivity,
  siteSummary,
  soleArmedArea,
  splitDoors,
  unavailableReason,
  type AccessEvent,
  type Site,
} from "./model";

const NOW = Date.parse("2026-11-24T09:00:00Z");

function site(overrides: Partial<Site> = {}): Site {
  return {
    id: "satellite",
    name: "Satellite Station",
    panel: "challenger",
    panelLabel: "Panel",
    writesEnabled: true,
    lastSeenAt: NOW - 5_000,
    controlsEnabled: true,
    bravoWritesDisabled: false,
    areas: [{ id: "a1", name: "Station", status: "armed", changedAt: NOW - 60_000, canControl: true }],
    doors: [
      { id: "d1", name: "Front Door", kind: "door", status: "secured", changedAt: NOW, canControl: true, supportsHold: false },
      { id: "d2", name: "Shed PA Door", kind: "door", status: "secured", changedAt: NOW, canControl: false, supportsHold: false },
      { id: "d3", name: "Rear Door", kind: "door", status: "open", changedAt: NOW, canControl: false, supportsHold: false },
    ],
    ...overrides,
  } as Site;
}

function ev(id: string, secondsAfter: number, text: string, source: "panel" | "bravo", who?: string): AccessEvent {
  return { id, siteId: "satellite", at: NOW + secondsAfter * 1000, text, source, who } as AccessEvent;
}

describe("unavailableReason", () => {
  it("is null when the station can be controlled", () => {
    expect(unavailableReason(site(), NOW)).toBeNull();
  });

  it("puts no contact first, then BRAVO's switch, then the bridge", () => {
    expect(
      unavailableReason(site({ lastSeenAt: NOW - 5 * 60_000, controlsEnabled: false, writesEnabled: false }), NOW),
    ).toBe("No contact with the station for 5 min");
    expect(unavailableReason(site({ controlsEnabled: false, writesEnabled: false }), NOW)).toBe(
      "Remote control is off for this station",
    );
    expect(unavailableReason(site({ writesEnabled: false }), NOW)).toBe("This station is view only");
  });

  it("puts the server kill switch ahead of the station switch", () => {
    expect(
      unavailableReason(site({ bravoWritesDisabled: true, bravoWritesDisabledReason: "thisSite", controlsEnabled: false }), NOW),
    ).toBe("Remote control is switched off in BRAVO for this station");
    expect(unavailableReason(site({ bravoWritesDisabled: true, bravoWritesDisabledReason: "allSites" }), NOW)).toBe(
      "Remote control is switched off in BRAVO for all stations",
    );
  });
});

describe("siteSummary", () => {
  it("reads alarm over armed, and partly armed for a mix", () => {
    const two = (a: Site["areas"][number]["status"], b: Site["areas"][number]["status"]) =>
      site({
        areas: [
          { id: "a", name: "Station", status: a, changedAt: NOW, canControl: true },
          { id: "b", name: "Shed", status: b, changedAt: NOW, canControl: true },
        ],
      });
    expect(siteSummary(two("armed", "armed")).label).toBe("Armed");
    expect(siteSummary(two("armed", "disarmed")).label).toBe("Partly armed");
    expect(siteSummary(two("armed", "alarm")).label).toBe("Alarm");
    expect(siteSummary(two("disarmed", "disarmed")).label).toBe("Disarmed");
  });
});

describe("splitDoors", () => {
  it("tiles controllable doors and keeps unsecured view-only doors visible", () => {
    const { controllable, notable, quiet } = splitDoors(site());
    expect(controllable.map((d) => d.name)).toEqual(["Front Door"]);
    expect(notable.map((d) => d.name)).toEqual(["Rear Door"]);
    expect(quiet.map((d) => d.name)).toEqual(["Shed PA Door"]);
  });
});

describe("soleArmedArea", () => {
  it("only answers for a single armed area", () => {
    expect(soleArmedArea(site())?.name).toBe("Station");
    expect(soleArmedArea(site({ areas: [{ ...site().areas[0], status: "disarmed" }] }))).toBeNull();
    expect(soleArmedArea(site({ areas: [site().areas[0], { ...site().areas[0], id: "a2", name: "Shed" }] }))).toBeNull();
  });
});

describe("attentionItems", () => {
  it("flags alarms and forced or held doors", () => {
    const s = site({
      areas: [{ id: "a1", name: "Station", status: "alarm", changedAt: NOW, canControl: true }],
      doors: [{ id: "d1", name: "Front Door", kind: "door", status: "forced", changedAt: NOW, canControl: false, supportsHold: false }],
    });
    expect(attentionItems([s]).map((a) => a.text)).toEqual([
      "Alarm at Satellite Station: Station",
      "Front Door forced at Satellite Station",
    ]);
  });
});

describe("mergeActivity", () => {
  it("folds the panel's copy of a BRAVO unlock and its automatic relock into one line", () => {
    const items = mergeActivity(
      [
        ev("p1", 0, "D11 Front Door: Door Unlocked", "panel"),
        ev("b1", 0, "Front Door unlocked", "bravo", "Alex Carter"),
        ev("p2", 5, "D11 Front Door: Door Locked", "panel"),
        ev("p3", 120, "Shed PA Door: Door Locked", "panel"),
      ],
      site(),
    );
    expect(items.map((i) => i.text)).toEqual(["Shed PA Door: Door Locked", "Front Door unlocked"]);
    expect(items[1]).toMatchObject({ who: "Alex Carter", relocked: true });
  });

  it("matches the longest name, so Shed PA Door isn't taken for Shed", () => {
    const items = mergeActivity(
      [
        ev("b1", 0, "Shed armed", "bravo", "Alex Carter"),
        ev("p1", 1, "Shed PA Door: Door Unlocked", "panel"),
      ],
      { ...site(), areas: [{ id: "a2", name: "Shed", status: "armed", changedAt: NOW, canControl: true }] },
    );
    expect(items).toHaveLength(2);
  });

  it("keeps panel events that aren't near a BRAVO command", () => {
    const items = mergeActivity(
      [ev("p1", 0, "Front Door access granted", "panel"), ev("b1", 60, "Front Door unlocked", "bravo", "Alex Carter")],
      site(),
    );
    expect(items).toHaveLength(2);
  });
});
