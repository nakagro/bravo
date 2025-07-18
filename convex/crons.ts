import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

// Schedule at 12:30 PM AEST (≈ 02:30 UTC)
const crons = cronJobs();

crons.daily(
  "nightly reset statuses", // identifier
  { hourUTC: 2, minuteUTC: 30 }, // 02:30 UTC == 12:30 PM AEST (UTC+10)
  api.availabilityResetAction.nightlyReset,
  {}
);

// Process status transitions every minute
crons.interval(
  "process status transitions", // identifier
  { minutes: 1 }, // Every minute
  api.availability.processStatusTransitions,
  {}
);

export default crons;