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

function isLocalOrLanHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa")
  ) {
    return true;
  }

  // RFC1918 private IPv4 ranges
  if (/^10\./.test(host) || /^192\.168\./.test(host)) {
    return true;
  }
  const match172 = /^172\.(\d+)\./.exec(host);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}

export function resolveAppEnvironment(
  convexUrl: string,
  explicitEnv?: string,
): AppEnvironment {
  const normalizedOverride = explicitEnv?.trim().toLowerCase();
  if (
    normalizedOverride === "production" ||
    normalizedOverride === "uat" ||
    normalizedOverride === "dev"
  ) {
    return normalizedOverride;
  }

  if (convexUrl.includes(UAT_DEPLOYMENT)) {
    return "uat";
  }

  if (convexUrl.includes(".convex.cloud")) {
    return "dev";
  }

  if (!convexUrl) {
    return "production";
  }

  try {
    const parsed = new URL(convexUrl);
    // Self-hosted prod is always HTTPS on a public hostname; plain HTTP or
    // local/LAN hosts are local dev sandboxes.
    if (parsed.protocol === "http:" || isLocalOrLanHost(parsed.hostname)) {
      return "dev";
    }
  } catch {
    // Non-URL strings fall through to production.
  }

  return "production";
}

export function getAppEnvironment(): AppEnvironment {
  return resolveAppEnvironment(
    import.meta.env.VITE_CONVEX_URL ?? "",
    import.meta.env.VITE_APP_ENV,
  );
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
