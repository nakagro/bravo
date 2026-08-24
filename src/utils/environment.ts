/**
 * Which backend is this build talking to?
 *
 * Derived from VITE_CONVEX_URL, which is baked in at build time - on Vercel it
 * comes from that project's dashboard, not from any env file in this repo.
 *
 * The distinction that matters is UAT vs dev. UAT holds a full unscrubbed clone
 * of production data, so showing it the same quiet amber "DEV" chip as a
 * disposable sandbox is the wrong signal: actions taken there look consequence
 * free but are being performed against real member records.
 */
export type AppEnvironment = "production" | "uat" | "dev";

const UAT_DEPLOYMENT = "precious-magpie-647";

export function getAppEnvironment(): AppEnvironment {
  const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "";

  // Production is the self-hosted VPS - anything not on Convex Cloud.
  if (!convexUrl.includes(".convex.cloud")) {
    return "production";
  }

  if (convexUrl.includes(UAT_DEPLOYMENT)) {
    return "uat";
  }

  return "dev";
}

type BadgeStyle = {
  /** Compact text for an inline chip next to a heading. */
  short: string;
  /** Full text for a banner across the top of a page. */
  long: string;
  /** Tailwind classes for background/text colour. */
  className: string;
};

const BADGE_STYLES: Record<Exclude<AppEnvironment, "production">, BadgeStyle> = {
  // Red rather than the sandbox's amber: there is real member data behind this.
  uat: {
    short: "UAT",
    long: "UAT",
    className: "bg-red-600 text-white",
  },
  dev: {
    short: "DEV",
    long: "DEV ENVIRONMENT",
    className: "bg-amber-500 text-amber-950",
  },
};

export function getEnvironmentBadge(): BadgeStyle | null {
  const environment = getAppEnvironment();
  if (environment === "production") return null;
  return BADGE_STYLES[environment];
}
