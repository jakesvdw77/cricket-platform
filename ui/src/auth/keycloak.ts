import Keycloak from 'keycloak-js'

// Same client for every club subdomain — redirect_uri always resolves same-origin.
// See docs/specs/002-realm-subdomain-auth.md. Not yet wired into main.tsx: no
// realm exists to authenticate against until the local Keycloak dev container
// from that spec is stood up.
export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://auth.localhost:8180',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'platform-dev',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'platform-web',
})
