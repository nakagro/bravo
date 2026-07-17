import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    CALDAV_URL: v.string(),
    CALDAV_USERNAME: v.string(),
    CALDAV_PASSWORD: v.string(),
  },
});
