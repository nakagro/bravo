import { describe, it, expect } from "vitest";
import {
  summariseChecklist,
  ringColorFor,
  statusTint,
  type ChecklistItemStatus,
} from "./checklistStatus";

describe("summariseChecklist", () => {
  it("returns a zeroed summary for an empty list", () => {
    expect(summariseChecklist([])).toEqual({
      resolved: 0,
      attention: 0,
      answered: 0,
      total: 0,
      percentage: 0,
    });
  });

  it("counts attention items as answered", () => {
    const statuses: ChecklistItemStatus[] = [
      "resolved",
      "attention",
      "unanswered",
      "unanswered",
    ];
    expect(summariseChecklist(statuses)).toEqual({
      resolved: 1,
      attention: 1,
      answered: 2,
      total: 4,
      percentage: 50,
    });
  });

  it("rounds the percentage", () => {
    expect(summariseChecklist(["resolved", "unanswered", "unanswered"]).percentage).toBe(33);
    expect(summariseChecklist(["resolved", "resolved", "unanswered"]).percentage).toBe(67);
  });

  it("reaches 100% when every item is answered, including attention items", () => {
    expect(summariseChecklist(["attention", "attention"]).percentage).toBe(100);
  });
});

describe("ringColorFor", () => {
  it("is red while work is outstanding", () => {
    expect(ringColorFor(summariseChecklist(["resolved", "unanswered"]))).toContain("red");
  });

  it("is red for an empty list", () => {
    expect(ringColorFor(summariseChecklist([]))).toContain("red");
  });

  it("is amber when everything is answered but something needs attention", () => {
    expect(ringColorFor(summariseChecklist(["resolved", "attention"]))).toContain("amber");
  });

  it("is green when the list is clean", () => {
    expect(ringColorFor(summariseChecklist(["resolved", "resolved"]))).toContain("green");
  });
});

describe("statusTint", () => {
  it("gives each status a distinct tint", () => {
    const tints = new Set([
      statusTint("resolved"),
      statusTint("attention"),
      statusTint("unanswered"),
    ]);
    expect(tints.size).toBe(3);
  });
});
