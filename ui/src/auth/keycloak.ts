import Keycloak from 'keycloak-js'

// Same client for every club subdomain — redirect_uri always resolves same-origin.
// See docs/specs/002-realm-subdomain-auth.md. Realm/client names are "cricketlegend"
// locally rather than 002's documented "platform-dev"/"platform-web" — see
// docs/specs/005-admin-login.md's Flags for your review, follow-up spec edit still pending.
export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://auth.localhost:8180',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'cricketlegend',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'cricketlegend',
})

// This app ships as a single unsplit bundle (no route-based code-splitting), so this module —
// and the keycloak.init() call below — executes on every page load, including pages that make no
// authenticated call at all (the public marketing landing page, a club's public schedule). Only
// gate check-sso behind paths that actually need a resolved Keycloak session today; every other
// path pays zero extra cost, exactly as before this file started doing anything Keycloak-related
// on page load. Confirmed the hard way: enabling check-sso unconditionally added a real,
// measurable delay to the landing page too, from the iframe below hanging until its own internal
// timeout — broke unrelated, timing-sensitive e2e assertions there.
const AUTH_AWARE_PATH_PREFIXES = ['/admin', '/login', '/post-login']
const needsKeycloakSession = AUTH_AWARE_PATH_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix))

// Fires once, automatically, the first time anything imports this module
// (axiosConfig.ts already does). Callers that need to gate behavior on
// Keycloak having finished processing any pending login redirect should await this.
//
// onLoad: 'check-sso' — restores the session silently on a plain page load/refresh (no pending
// OAuth callback in the URL), rather than requiring a full login() redirect every time. Works by
// embedding an iframe pointed at Keycloak's own /auth endpoint (auth.localhost), which — since
// this app runs on a different origin per club subdomain (002's own design) — needs Keycloak's
// realm-level Security Defenses → Headers to actually allow being framed cross-origin
// (X-Frame-Options cleared, Content-Security-Policy's frame-ancestors widened to this app's
// domains) before it works at all. That's a one-time realm/infra config change, not app code —
// treat it the same as the other manually-provisioned Keycloak setup (016's Phase 0). Without it,
// this iframe just never resolves and keycloakInitPromise hangs — confirmed the hard way once
// already, hence this being turned off before. silentCheckSsoRedirectUri points at a same-origin
// static file (ui/public/silent-check-sso.html) that the Keycloak-origin iframe redirects to once
// it has an answer — that file itself was never the blocked part.
//
// checkLoginIframe stays off deliberately — that's a separate, ongoing poll (detects logout
// elsewhere while this tab stays open), not needed to fix a plain refresh, and no reason to add
// more iframe traffic than this problem actually requires.
export const keycloakInitPromise = keycloak.init({
  ...(needsKeycloakSession && {
    onLoad: 'check-sso',
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  }),
  redirectUri: window.location.origin + '/',
  checkLoginIframe: false,
})
