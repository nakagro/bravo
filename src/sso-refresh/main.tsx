/**
 * `/sso-refresh.html`: renew the `bravo_jwt` cookie for Labs, invisibly.
 *
 * Labs (labs.grayhux.io) reads BRAVO's JWT from the `.grayhux.io` cookie, but
 * the JWT lives an hour and only BRAVO holds the refresh token that renews it.
 * Without this page, an expired cookie meant a full-page bounce through `/sso`
 * just to run BRAVO's refresh code. Labs now loads this page in a hidden
 * iframe instead: it boots Convex Auth against the same localStorage the main
 * app uses (same-site, so the frame is not storage-partitioned), forces a
 * refresh, writes the cookie, and tells the parent it's done.
 *
 * Deliberately a separate Vite entry with no router, no PostHog and no app
 * shell, so the iframe costs a Convex client and nothing else. Framing is
 * limited to Labs by the `frame-ancestors` header in vercel.json.
 *
 * The message carries no token - only `{ type, ok }`. The cookie is already
 * written by the time it's sent, so the parent just re-reads it.
 */
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider, useConvexAuth } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { writeSsoCookie } from "../hooks/useSsoCookie";
import { parseSsoParentOrigin, SSO_REFRESH_MESSAGE } from "../lib/ssoRefresh";

const parentOrigin = parseSsoParentOrigin(
  new URLSearchParams(window.location.search).get("origin"),
);

function report(origin: string, ok: boolean) {
  window.parent.postMessage({ type: SSO_REFRESH_MESSAGE, ok }, origin);
}

function Refresher({ origin }: { origin: string }) {
  const { isLoading, fetchAccessToken } = useConvexAuth();
  const started = useRef(false);

  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;

    // Forced, not "use the stored one if it's fresh": the stored JWT may be
    // the same stale token Labs already has, and a forced refresh is one
    // action call. Convex Auth serialises refreshes across tabs and frames
    // with a lock, so a BRAVO tab open alongside can't race this one into
    // reusing a rotated refresh token.
    fetchAccessToken({ forceRefreshToken: true }).then(
      (token) => {
        // null means BRAVO's session is genuinely over (no refresh token, or
        // it was rejected). Clearing the cookie then is what the main app
        // does too. Write first, report second: Labs re-reads the cookie the
        // moment the message lands.
        writeSsoCookie(token);
        report(origin, token !== null);
      },
      // Network failure: say so, but leave the cookie alone. Nothing has
      // been learned about the session.
      () => report(origin, false),
    );
  }, [isLoading, fetchAccessToken, origin]);

  return null;
}

// Only ever useful inside a trusted frame. Opened directly, or framed by a
// page that didn't name a trusted origin, it does nothing at all.
if (parentOrigin && window.parent !== window) {
  const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
  createRoot(document.getElementById("root")!).render(
    <ConvexAuthProvider client={convex}>
      <Refresher origin={parentOrigin} />
    </ConvexAuthProvider>,
  );
}
