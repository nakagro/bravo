import { secretMatches } from "../labsMember";

// The station kiosk hub's per-site token, KIOSK_HUB_<SITE>_TOKEN, with
// KIOSK_HUB_<SITE>_TOKEN_NEXT accepted during a rotation. Shared by the HTTP
// API (Bearer header) and the live query the hub subscribes to over the
// Convex WebSocket (token argument).

export const KIOSK_SITE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export function kioskTokenEnvName(siteId: string): string {
  return `KIOSK_HUB_${siteId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_TOKEN`;
}

/** Whether `presented` is this site's current or next hub token. */
export async function kioskHubTokenMatches(siteId: string, presented: string | null): Promise<boolean> {
  if (!KIOSK_SITE_ID_RE.test(siteId)) return false;
  const envName = kioskTokenEnvName(siteId);
  // Check both so the comparison takes the same time whichever one matches.
  const [current, next] = await Promise.all([
    secretMatches(presented, process.env[envName]),
    secretMatches(presented, process.env[`${envName}_NEXT`]),
  ]);
  return current || next;
}
