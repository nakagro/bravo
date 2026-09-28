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
