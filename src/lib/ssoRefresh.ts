/**
 * Shared rules for the cross-project SSO pages (`/sso` and `/sso-refresh.html`).
 *
 * Labs (labs.grayhux.io) reads BRAVO's `bravo_jwt` cookie. That JWT lives an
 * hour, and only BRAVO holds the refresh token that renews it, so Labs loads
 * `/sso-refresh.html` in a hidden iframe to have BRAVO renew the cookie without
 * a visible round trip. See docs/plans/cross-project-sso-bravo-ghmaps.md.
 */

/** The `type` of the message `/sso-refresh.html` posts to its parent. Labs matches on it. */
export const SSO_REFRESH_MESSAGE = "bravo-sso-refresh";

/**
 * Is this a URL we'll hand a member back to, or report to? https on
 * grayhux.io or any subdomain of it, nothing else. Everything on that domain
 * already receives `bravo_jwt` by virtue of the cookie's scope, so trusting it
 * here grants nothing new.
 */
export function isTrustedSsoUrl(u: URL): boolean {
  return (
    u.protocol === "https:" &&
    (u.hostname === "grayhux.io" || u.hostname.endsWith(".grayhux.io"))
  );
}

/** `/sso?redirect=`: the full URL to send the member back to, or null. */
export function parseSsoRedirect(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return isTrustedSsoUrl(u) ? u.href : null;
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
export function parseSsoParentOrigin(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!isTrustedSsoUrl(u) || u.origin !== raw) return null;
    return u.origin;
  } catch {
    return null;
  }
}
