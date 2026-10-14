import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";
import { brigadeCron, type BrigadeTime } from "./brigadeCron";

const crons = cronJobs();

// The Convex cron API only takes fixed UTC times. Anything meant for a time of
// day in Victoria is registered through `at`, which holds that Melbourne time
// through AEST and AEDT alike - see convex/brigadeCron.ts for how. Don't pin a
// local-time job to a UTC hour here: it drifts an hour every daylight saving.
// The interval and hourly jobs further down have no time of day to hold.
const at = (
  identifier: string,
  time: BrigadeTime,
  fn: Parameters<typeof brigadeCron>[3]
) => brigadeCron(crons, identifier, time, fn);

// Daily auth cleanup: purge expired sessions, expired tokens, and orphaned
// tokens, before the other daily jobs
at("auth cleanup", { hour: 3, minute: 0 }, internal.authManagement.scheduledAuthCleanup);

// Clean up expired service account sessions daily
at(
  "cleanup expired service account sessions",
  { hour: 3, minute: 30 },
  internal.serviceAccounts.cleanupExpiredSessions
);

// Delete planned shifts that ended over a week ago. memberStatusHistory already
// records what they did.
at(
  "cleanup old planned shifts",
  { hour: 3, minute: 45 },
  internal.plannedShifts.cleanupOldPlannedShifts
);

// Delete all messages at 4am (before status reset)
at("delete daily messages", { hour: 4, minute: 0 }, internal.messages.deleteAllMessages);

// Close the duty crew week that has just ended and email what was and wasn't
// done. Daily rather than weekly on purpose: the handler catches up on any
// week that has ended, so a missed run closes it the next morning instead of
// leaving it open for good. Tuesday's run is the one that closes.
at(
  "close elapsed duty crew weeks",
  { hour: 4, minute: 15 },
  internal.stationChecks.closeElapsedWeeks
);

at("nightly reset statuses", { hour: 4, minute: 30 }, api.availabilityActions.nightlyReset);

at(
  "morning availability reminder",
  { hour: 10, minute: 0 },
  api.availabilityActions.morningReminder
);

// Nudge the outgoing duty crew at 4pm on the Monday, the last day of the
// Tuesday-to-Monday duty week, if checks are still outstanding.
at(
  "duty crew week closing reminder",
  { hour: 16, minute: 0, dayOfWeek: 1 },
  internal.dutyCrewReminders.sendWeekClosingReminder
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

// Clean up expired notifications every hour
crons.hourly(
  "cleanup expired notifications", // identifier
  { minuteUTC: 0 }, // Run at the top of every hour
  internal.notificationHistory.cleanupExpiredNotifications,
  {}
);

export default crons;