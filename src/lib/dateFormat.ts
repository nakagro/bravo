/**
 * Day, date and time, e.g. "Sat, 3 Oct, 02:15 pm". A tick's time alone is no
 * use once the week has moved on - the day it was done is the point.
 */
export const formatDayTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = date.toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day}, ${time}`;
};

const BRIGADE_TZ = "Australia/Melbourne";
type DateInput = number | string | Date;
const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

/**
 * A date as members read it, e.g. "15 Nov 2026", always on Melbourne time.
 * Use this instead of a bare toLocaleDateString(), which follows the phone's
 * locale and shows 11/15/2026 on a US-set phone.
 */
export const formatDate = (value: DateInput) =>
  toDate(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BRIGADE_TZ,
  });

/** Date and time, e.g. "15 Nov 2026, 2:15 pm", on Melbourne time. */
export const formatDateTime = (value: DateInput) =>
  toDate(value).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: BRIGADE_TZ,
  });
