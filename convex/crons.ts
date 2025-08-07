import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();


// Schedule at 4am AEST (≈ 18:00 UTC)
crons.daily(
  "nightly reset statuses", // identifier
  { hourUTC: 6, minuteUTC: 21 }, // 18:00 UTC == 04:00 AEST (UTC+10)
  api.availabilityActions.nightlyReset,
  {}
);

// Schedule at 10:00 AM AEST (≈ 00:00 UTC)
crons.daily(
  "morning availability reminder", // identifßier
  { hourUTC: 10, minuteUTC: 40 }, // 00:00 UTC == 10:00 AM AEST (UTC+10)ß
  api.availabilityActions.morningReminder,
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