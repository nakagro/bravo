import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// Every hourUTC below is a fixed UTC time, because that is all the Convex cron
// API accepts - there is no timezone parameter. So the local times named here
// hold during AEST and land an hour later through AEDT (Oct-Apr): the 04:00 job
// runs at 05:00, the 10:00 reminder at 11:00.
//
// That drift is accepted, deliberately (decided 2026-08-28). Removing it means
// firing on a shorter interval and gating on Melbourne local time inside the
// handler, which needs a per-job last-run guard to survive the DST boundaries -
// local 02:00-03:00 does not exist in October and happens twice in April, so a
// naive gate silently skips a day one way and double-fires the other. That is a
// reliability change, and these jobs run while nobody is awake to notice the
// hour. Code that *computes* in brigade time should use convex/lib/dates.ts.

// Delete all messages at 4am local (before status reset)
crons.daily(
  "delete daily messages", // identifier
  { hourUTC: 18, minuteUTC: 0 }, // 04:00 AEST / 05:00 AEDT
  internal.messages.deleteAllMessages,
  {}
);

crons.daily(
  "nightly reset statuses", // identifier
  { hourUTC: 18, minuteUTC: 30 }, // 04:30 AEST / 05:30 AEDT
  api.availabilityActions.nightlyReset,
  {}
);


crons.daily(
  "morning availability reminder", // identifier
  { hourUTC: 0, minuteUTC: 0 }, // 10:00 AEST / 11:00 AEDT - the one members notice
  api.availabilityActions.morningReminder,
  {}
);

// Close the duty crew week that has just ended and email what was and wasn't
// done. Daily rather than weekly on purpose: the handler catches up on any
// week that has ended, so a missed run closes it the next morning instead of
// leaving it open for good.
crons.cron(
  "close elapsed duty crew weeks", // identifier
  "15 18 * * *", // 04:15 AEST / 05:15 AEDT - Monday's run is the one that closes
  internal.stationChecks.closeElapsedWeeks,
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
  { hourUTC: 17, minuteUTC: 0 }, // 03:00 AEST / 04:00 AEDT, before the other daily jobs
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
  { hourUTC: 17, minuteUTC: 30 }, // 03:30 AEST / 04:30 AEDT
  internal.serviceAccounts.cleanupExpiredSessions,
  {}
);

export default crons;