import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FullPageLoader } from '../../components/CricketBallLoader'
import { keycloak } from '../../auth/keycloak'

// `?idp=google` skips Keycloak's login page and goes straight to Google (owner, 2026-11-13: Google is also how a new parent, guardian or
// adult player creates an account: the first Google sign-in makes the account, docs/specs/119 Part 2). Only the known provider alias is
// passed on, never the raw query value.
const IDP_ALIASES = ['google']

export default function Login() {
  const [search] = useSearchParams()
  const idp = IDP_ALIASES.find((alias) => alias === search.get('idp'))

  useEffect(() => {
    keycloak.login({ redirectUri: `${window.location.origin}/post-login`, ...(idp ? { idpHint: idp } : {}) })
  }, [idp])

  return <FullPageLoader variant="backdrop" message={idp ? 'Taking you to Google' : 'Taking you to sign in'} />
}
