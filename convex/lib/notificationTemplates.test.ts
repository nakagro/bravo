import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_TEMPLATES,
  formatDateRange,
  joinAssignment,
  renderTemplate,
  truncate,
  validateTemplate,
} from "./notificationTemplates";

const assigned = NOTIFICATION_TEMPLATES["event.assigned"];

describe("renderTemplate", () => {
  it("fills placeholders", () => {
    const out = renderTemplate(assigned, {
      eventTitle: "Open day",
      assignment: "Driver on Tanker 1",
      date: "Sat 14 Dec",
      time: "9:00 AM",
      location: "Main Station",
      message: "Bring hi-vis.",
    });
    expect(out.title).toBe("You're rostered: Open day");
    expect(out.body).toBe("Driver on Tanker 1\nSat 14 Dec 9:00 AM · Main Station\nBring hi-vis.");
  });

  it("tidies up after empty values and drops blank lines", () => {
    const out = renderTemplate(assigned, {
      eventTitle: "Open day",
      assignment: "Driver on Tanker 1",
      date: "Sat 14 Dec",
      time: "",
      location: "",
      message: "",
    });
    expect(out.body).toBe("Driver on Tanker 1\nSat 14 Dec");
  });

  it("drops a separator between two empty values", () => {
    expect(renderTemplate({ title: "x", body: "{a} · {b} · {c}, {d}" }, { a: "A", d: "D" }).body).toBe("A, D");
  });

  it("renders {{ as a literal brace and is case-sensitive", () => {
    const out = renderTemplate({ title: "{{eventTitle}", body: "{EventTitle}!" }, { eventTitle: "X" });
    expect(out.title).toBe("{eventTitle}");
    expect(out.body).toBe("!");
  });

  it("truncates to the push limits", () => {
    const out = renderTemplate(assigned, { eventTitle: "A".repeat(100), assignment: "B".repeat(300) });
    expect(out.title.length).toBe(65);
    expect(out.title.endsWith("…")).toBe(true);
    expect(out.body.length).toBeLessThanOrEqual(240);
    expect(truncate("short", 10)).toBe("short");
  });
});

describe("validateTemplate", () => {
  it("refuses unknown placeholders by name", () => {
    expect(validateTemplate("event.assigned", { title: "{evntTitle}", body: "" })).toMatch("{evntTitle}");
  });
  it("refuses placeholders the source doesn't fill", () => {
    expect(validateTemplate("deployment.assigned", { title: "{eventTitle}", body: "" })).toMatch(
      "can't be used",
    );
    expect(validateTemplate("event.cancelled", { title: "{firstName}", body: "" })).toMatch("can't be used");
    expect(validateTemplate("event.cancelled", { title: "{assignment}", body: "" })).toMatch("can't be used");
  });
  it("accepts every default", () => {
    for (const [key, def] of Object.entries(NOTIFICATION_TEMPLATES)) {
      expect(validateTemplate(key as keyof typeof NOTIFICATION_TEMPLATES, def)).toBeNull();
    }
  });
  it("caps lengths", () => {
    expect(validateTemplate("event.assigned", { title: "x".repeat(121), body: "" })).toMatch("120");
  });
});

describe("formatting", () => {
  it("formats date ranges", () => {
    expect(formatDateRange("2026-12-12")).toBe("Sat 12 Dec");
    expect(formatDateRange("2026-12-12", "2026-12-13")).toBe("Sat 12 – Sun 13 Dec");
    expect(formatDateRange("2026-11-30", "2026-12-01")).toBe("Mon 30 Nov – Tue 1 Dec");
  });
  it("puts seats on their own lines and groups shifts", () => {
    expect(
      joinAssignment([
        "Crew Leader · Wyndham Vale Pumper",
        "Morning (09:00–11:00)",
        "Afternoon (11:00–14:00)",
      ]),
    ).toBe("Crew Leader on Wyndham Vale Pumper\nShifts: Morning (09:00–11:00), Afternoon (11:00–14:00)");
    expect(joinAssignment(["Morning (09:00–11:00)"])).toBe("Shift: Morning (09:00–11:00)");
    expect(joinAssignment(["Crew · Tanker 1", "Whole event"])).toBe("Crew on Tanker 1\nRostered for the whole event");
  });
});
