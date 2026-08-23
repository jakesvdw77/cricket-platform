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
//
// Deliberately just /admin, not /login or /post-login too:
// - /login never needs it — Login.tsx fires an explicit keycloak.login() redirect immediately on
//   mount, without waiting for keycloakInitPromise at all, so a resolved session here is never
//   even read.
// - /post-login must NOT run check-sso — every single load of this page already has a real,
//   pending OAuth callback (code+state) to process; that's its entire purpose. Running check-sso's
//   own iframe-based silent-SSO attempt at the same time raced against that real callback exchange
//   and broke it outright (confirmed the hard way: a fresh login landed on a permanently blank
//   page, activateSession() 401ing forever, even though the callback itself was valid) — not just
//   a slowdown like the landing-page case above, an outright regression. /admin, by contrast, is
//   only ever loaded fresh via a direct navigation/refresh/bookmark — never via a pending OAuth
//   callback (Login.tsx's redirectUri points at /post-login, never straight to /admin) — so it's
//   the one path that's actually safe to run check-sso on.
const AUTH_AWARE_PATH_PREFIXES = ['/admin', '/manage']
const needsKeycloakSession = AUTH_AWARE_PATH_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix))

// Fires once, automatically, the first time anything imports this module
// (axiosConfig.ts already does). Callers that need to gate behavior on
// Keycloak having finished processing any pending login redirect should await this.
//
// onLoad: 'check-sso' — restores the session silently on a plain page load/refresh (no pending
// OAuth callback in the URL), rather than requiring a full login() redirect every time.
// Deliberately NOT passing silentCheckSsoRedirectUri: that option switches this into a
// hidden-iframe implementation, which needs Keycloak's own realm-level Security Defenses →
// Headers relaxed to allow being framed cross-origin (X-Frame-Options cleared, CSP's
// frame-ancestors widened) — a real infra dependency that turned out to be unnecessary
// complexity. Omitting it falls back to keycloak-js's other check-sso mode instead: a plain
// top-level redirect-and-back through Keycloak with prompt=none, no iframe involved at all —
// near-instant when a session exists (no login form ever renders), and requires zero Keycloak
// configuration. Confirmed this is exactly what the original single-tenant Cricket Legend app
// already does (ui/src/keycloak.ts there) — same onLoad: 'check-sso', no
// silentCheckSsoRedirectUri, no realm changes ever needed.
//
// checkLoginIframe stays off deliberately — that's a separate, ongoing poll (detects logout
// elsewhere while this tab stays open), not needed to fix a plain refresh, and no reason to add
// more redirect traffic than this problem actually requires.
// No redirectUri here (deliberately, matching the legacy app's own init() call): check-sso's
// plain-redirect round-trip uses this as its return destination, and keycloak-js's own default
// when it's omitted is the current full URL (path included) — exactly what's wanted, so a
// refresh on e.g. /admin/configuration returns there, not to the bare root. Setting it
// unconditionally to origin + '/' was a real bug: it forced every check-sso round-trip back to
// the root page regardless of where the admin actually was. keycloak.logout()'s 3 call sites
// (AdminHome/ManagerHome/PlayerHome) don't pass their own redirectUri either, for the same
// reason the legacy app doesn't — landing back on the current (now-unauthenticated) page after
// logout is the simpler, already-proven-fine behavior, not a gap.
export const keycloakInitPromise = keycloak.init({
  ...(needsKeycloakSession && { onLoad: 'check-sso' }),
  checkLoginIframe: false,
})
