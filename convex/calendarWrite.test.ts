// @vitest-environment edge-runtime
import { describe, expect, it } from "vitest";
import {
  buildVEventCalendar,
  escapeIcsText,
  findEventResource,
} from "./calendarWrite";

describe("escapeIcsText", () => {
  it("escapes RFC 5545 special characters", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("buildVEventCalendar", () => {
  const now = new Date("2026-07-17T06:00:00Z");

  it("builds a timed event in UTC with CRLF line endings", () => {
    const ics = buildVEventCalendar(
      "bravo-test-1",
      {
        summary: "Truck check",
        location: "Station",
        description: "Line one\nLine two",
        when: {
          kind: "timed",
          start: Date.parse("2026-08-10T09:00:00Z"),
          end: Date.parse("2026-08-10T10:30:00Z"),
        },
      },
      now,
    );

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("UID:bravo-test-1\r\n");
    expect(ics).toContain("DTSTART:20260810T090000Z\r\n");
    expect(ics).toContain("DTEND:20260810T103000Z\r\n");
    expect(ics).toContain("SUMMARY:Truck check\r\n");
    expect(ics).toContain("LOCATION:Station\r\n");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\r\n");
    expect(ics).toContain("DTSTAMP:20260717T060000Z\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("builds all-day events with VALUE=DATE and no time component", () => {
    const ics = buildVEventCalendar(
      "bravo-test-2",
      {
        summary: "Open day",
        when: {
          kind: "allDay",
          startDate: "2026-08-15",
          endDateExclusive: "2026-08-16",
        },
      },
      now,
    );

    expect(ics).toContain("DTSTART;VALUE=DATE:20260815\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260816\r\n");
    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("rejects empty titles and inverted ranges", () => {
    expect(() =>
      buildVEventCalendar("u", {
        summary: "   ",
        when: { kind: "timed", start: 1, end: 2 },
      }),
    ).toThrow("Event title is required");

    expect(() =>
      buildVEventCalendar("u", {
        summary: "x",
        when: { kind: "timed", start: 2, end: 2 },
      }),
    ).toThrow("Event end must be after its start");

    expect(() =>
      buildVEventCalendar("u", {
        summary: "x",
        when: {
          kind: "allDay",
          startDate: "2026-08-15",
          endDateExclusive: "2026-08-15",
        },
      }),
    ).toThrow("Event end must be after its start");

    expect(() =>
      buildVEventCalendar("u", {
        summary: "x",
        when: {
          kind: "allDay",
          startDate: "15/08/2026",
          endDateExclusive: "2026-08-16",
        },
      }),
    ).toThrow("Invalid all-day date");
  });
});

describe("findEventResource", () => {
  it("extracts href and etag from a Radicale multistatus response", () => {
    const xml = [
      '<?xml version="1.0"?>',
      '<multistatus xmlns="DAV:">',
      "<response>",
      "<href>/wydv/calendar/bravo-abc.ics</href>",
      "<propstat><prop>",
      '<getetag>"3021-1626500000"</getetag>',
      "</prop><status>HTTP/1.1 200 OK</status></propstat>",
      "</response>",
      "</multistatus>",
    ].join("\n");

    expect(findEventResource(xml)).toEqual({
      href: "/wydv/calendar/bravo-abc.ics",
      etag: '"3021-1626500000"',
    });
  });

  it("handles namespace prefixes and XML-escaped etags", () => {
    const xml = [
      '<D:multistatus xmlns:D="DAV:">',
      "<D:response>",
      "<D:href>/wydv/calendar/ext%20client.ics</D:href>",
      "<D:propstat><D:prop>",
      "<D:getetag>&quot;abc123&quot;</D:getetag>",
      "</D:prop></D:propstat>",
      "</D:response>",
      "</D:multistatus>",
    ].join("");

    expect(findEventResource(xml)).toEqual({
      href: "/wydv/calendar/ext%20client.ics",
      etag: '"abc123"',
    });
  });

  it("returns null when no event resource is present", () => {
    expect(
      findEventResource('<multistatus xmlns="DAV:"></multistatus>'),
    ).toBeNull();
    expect(
      findEventResource(
        "<multistatus><response><href>/wydv/calendar/</href></response></multistatus>",
      ),
    ).toBeNull();
  });
});
