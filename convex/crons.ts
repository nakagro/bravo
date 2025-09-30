import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();



crons.daily(
  "nightly reset statuses", // identifier
  { hourUTC: 18, minuteUTC: 30 }, // 18:00 UTC == 04:00 AEST (UTC+10)
  api.availabilityActions.nightlyReset,
  {}
);


crons.daily(
  "morning availability reminder", // identifier
  { hourUTC: 0, minuteUTC: 0 }, // 00:00 UTC == 10:00 AM AEST (UTC+10)
  api.availabilityActions.morningReminder,
  {}
);

// Process status transitions every minute
crons.interval(
  "process status transitions", // identifier
  { minutes: 5 }, // Every minute
  api.availability.processStatusTransitions,
  {}
);

export default crons;