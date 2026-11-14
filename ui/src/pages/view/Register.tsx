import { useEffect } from 'react'
import { FullPageLoader } from '../../components/CricketBallLoader'
import { keycloak } from '../../auth/keycloak'

// The club-free "Create Account" path (owner, 2026-11-13): a parent, guardian or adult player has no club yet, so like /login this runs on
// the root domain and every club subdomain. Keycloak shows its registration form (the realm's User registration switch must be on) and
// /post-login then carries the new account on to confirm or ask for its players (docs/specs/119).
export default function Register() {
  useEffect(() => {
    keycloak.register({ redirectUri: `${window.location.origin}/post-login` })
  }, [])

  return <FullPageLoader variant="backdrop" message="Taking you to create your account" />
}
