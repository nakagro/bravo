// Client-side "Add to calendar" - builds a minimal RFC 5545 .ics file for an
// event and triggers a download. No backend required.

interface IcsEvent {
  _id: string;
  title: string;
  description?: string;
  location?: string;
  address?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  isAllDay: boolean;
}

// Escape per RFC 5545 (commas, semicolons, backslashes, newlines).
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const stripDate = (date: string) => date.replace(/-/g, "");
const stripTime = (time: string) => time.replace(/:/g, "") + "00";

// Add one day to a YYYY-MM-DD string (all-day DTEND is exclusive in iCal).
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildIcs(event: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WVFB//Events//EN",
    "BEGIN:VEVENT",
    `UID:${event._id}@wvfb`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
  ];

  if (event.isAllDay || !event.startTime) {
    // Floating all-day; DTEND is exclusive
    const end = event.endDate ?? event.startDate;
    lines.push(`DTSTART;VALUE=DATE:${stripDate(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${stripDate(nextDay(end))}`);
  } else {
    // Floating local time (no TZID/Z) - avoids timezone math, matches how the
    // brigade reads the time locally.
    const endDate = event.endDate ?? event.startDate;
    lines.push(`DTSTART:${stripDate(event.startDate)}T${stripTime(event.startTime)}`);
    if (event.endTime) {
      lines.push(`DTEND:${stripDate(endDate)}T${stripTime(event.endTime)}`);
    }
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`);
  // Calendars carry a single LOCATION - join the venue name and address.
  const where = [event.location, event.address].filter(Boolean).join(", ");
  if (where) lines.push(`LOCATION:${escapeText(where)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}

export function downloadEventIcs(event: IcsEvent): void {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "event";
  link.download = `${safeName}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
