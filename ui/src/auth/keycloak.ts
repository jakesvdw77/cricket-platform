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

// Fires once, automatically, the first time anything imports this module
// (axiosConfig.ts already does). Callers that need to gate behavior on
// Keycloak having finished processing any pending login redirect should await this.
//
// Deliberately NOT using onLoad: 'check-sso' / silentCheckSsoRedirectUri (silent-check-sso.html
// still exists in ui/public/ for when this is revisited). Both check-sso and the periodic
// checkLoginIframe poll work by embedding a Keycloak-origin iframe in this app — confirmed via
// a live iframe pointed at auth.localhost:8180 that never resolved. Keycloak sends
// X-Frame-Options: SAMEORIGIN by default, and per 002's own design the app (e.g.
// riverside.localhost) and Keycloak (auth.localhost) are always different origins, so that
// iframe is structurally blocked everywhere this ever runs, not just locally — it hung
// keycloakInitPromise forever, breaking every API call in the app. Silent cross-subdomain SSO
// needs a Keycloak realm CSP (frame-ancestors) change before it can work; that's realm
// configuration, not app code, so it's left as a follow-up rather than done here. The explicit
// login()/logout() redirects below are full top-level navigations, not iframes, so they're
// unaffected.
export const keycloakInitPromise = keycloak.init({
  redirectUri: window.location.origin + '/',
  checkLoginIframe: false,
})
