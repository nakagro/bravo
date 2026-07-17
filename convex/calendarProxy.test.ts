// @vitest-environment edge-runtime
import { describe, expect, it, vi } from "vitest";
import { fetchCalendarData } from "./calendarProxy";

describe("fetchCalendarData", () => {
  it("fetches the configured Radicale calendar with Basic authentication", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
          status: 200,
          headers: { "Content-Type": "text/calendar" },
        }),
    );

    const result = await fetchCalendarData({
      calendarUrl: "http://radicale:5232/wydv/calendar/",
      username: "wydv",
      password: "test-password",
      fetcher,
    });

    expect(result).toBe("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
    expect(fetcher).toHaveBeenCalledWith(
      "http://radicale:5232/wydv/calendar/",
      {
        headers: {
          Accept: "text/calendar",
          Authorization: `Basic ${btoa("wydv:test-password")}`,
          "User-Agent": "Brigade-Management-System/1.0",
        },
      },
    );
  });
});
