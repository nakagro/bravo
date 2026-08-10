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

// "Living sandbox" simulator - churns member statuses so the cloud dev board
// looks actively used. No-ops on any deployment without SIMULATION_ENABLED=true
// (so this is inert on the live VPS even though the cron ships there).
crons.interval(
  "simulate member availability", // identifier
  { minutes: 12 },
  internal.simulation.tick,
  {}
);

// Daily auth cleanup: purge expired sessions, expired tokens, and orphaned tokens
crons.daily(
  "auth cleanup", // identifier
  { hourUTC: 17, minuteUTC: 0 }, // 17:00 UTC == 03:00 AEST (UTC+10), before other daily jobs
  internal.authManagement.scheduledAuthCleanup,
  {}
);

// Clean up expired notifications every hour
crons.hourly(
  "cleanup expired notifications", // identifier
  { minuteUTC: 0 }, // Run at the top of every hour
  internal.notificationHistory.cleanupExpiredNotifications,
  {}
);

// Clean up expired service account sessions daily
crons.daily(
  "cleanup expired service account sessions",
  { hourUTC: 17, minuteUTC: 30 }, // 17:30 UTC == 03:30 AEST
  internal.serviceAccounts.cleanupExpiredSessions,
  {}
);

export default crons;