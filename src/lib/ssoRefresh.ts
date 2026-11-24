import { SSO_DOMAIN } from "./brigadeConfig";

/**
 * Shared rules for the cross-project SSO pages (`/sso` and `/sso-refresh.html`).
 *
 * Companion apps under `VITE_SSO_DOMAIN` read BRAVO's `bravo_jwt` cookie. That
 * JWT lives an hour, and only BRAVO holds the refresh token that renews it, so
 * a companion app loads `/sso-refresh.html` in a hidden iframe to renew the
 * cookie without a visible round trip.
 */

/** The `type` of the message `/sso-refresh.html` posts to its parent. */
export const SSO_REFRESH_MESSAGE = "bravo-sso-refresh";

/**
 * Is this a URL we'll hand a member back to, or report to? https on the
 * configured `VITE_SSO_DOMAIN` or any subdomain of it, nothing else. Fails
 * closed (returns false) when `VITE_SSO_DOMAIN` is unset.
 */
export function isTrustedSsoUrl(u: URL, domain = SSO_DOMAIN): boolean {
  const cleanDomain = domain.trim().replace(/^\.+/, "").toLowerCase();
  if (!cleanDomain) return false;
  const host = u.hostname.toLowerCase();
  return (
    u.protocol === "https:" &&
    (host === cleanDomain || host.endsWith(`.${cleanDomain}`))
  );
}

/** `/sso?redirect=`: the full URL to send the member back to, or null. */
export function parseSsoRedirect(
  raw: string | null,
  domain = SSO_DOMAIN,
): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return isTrustedSsoUrl(u, domain) ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * `/sso-refresh.html?origin=`: the parent's origin, used as `postMessage`'s
 * `targetOrigin`. The browser then refuses to deliver the message unless the
 * parent really is that origin, so a page elsewhere that frames us with a
 * lying `?origin=` learns nothing. Anything with a path, query or credentials
 * is rejected rather than trimmed: an origin is all that should ever be sent.
 */
export function parseSsoParentOrigin(
  raw: string | null,
  domain = SSO_DOMAIN,
): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!isTrustedSsoUrl(u, domain) || u.origin !== raw) return null;
    return u.origin;
  } catch {
    return null;
  }
}
