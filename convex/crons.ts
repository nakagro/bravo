import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Delete all messages at 4am AEST (before status reset)
crons.daily(
  "delete daily messages", // identifier
  { hourUTC: 18, minuteUTC: 0 }, // 18:00 UTC == 04:00 AEST (UTC+10)
  internal.messages.deleteAllMessages,
  {}
);

crons.daily(
  "nightly reset statuses", // identifier
  { hourUTC: 18, minuteUTC: 30 }, // 18:30 UTC == 04:30 AEST (UTC+10)
  api.availabilityActions.nightlyReset,
  {}
);


crons.daily(
  "morning availability reminder", // identifier
  { hourUTC: 0, minuteUTC: 0 }, // 00:00 UTC == 10:00 AM AEST (UTC+10)
  api.availabilityActions.morningReminder,
  {}
);

// Process status transitions every 5 minutes
crons.interval(
  "process status transitions", // identifier
  { minutes: 5 },
  api.availability.processStatusTransitions,
  {}
);

// Clean up expired notifications every hour
crons.hourly(
  "cleanup expired notifications", // identifier
  { minuteUTC: 0 }, // Run at the top of every hour
  internal.notificationHistory.cleanupExpiredNotifications,
  {}
);

export default crons;