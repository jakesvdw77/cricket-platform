import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FullPageLoader } from '../../components/CricketBallLoader'
import { keycloak, keycloakInitPromise } from '../../auth/keycloak'
import { useClubFromHost } from '../../hooks/useClubFromHost'
import { ClubAddressMissing } from './ClubAddressMissing'

// The "Create Account" path (owner, 2026-11-13): a parent, guardian or adult player has no club yet, so like /login this runs on the root
// domain and every club subdomain. Keycloak shows its registration form (the realm's User registration switch must be on) and
// /post-login then carries the new account on to confirm or ask for its players (docs/specs/119).
// docs/specs/149: on a club address the club is looked up first (a missing club never reaches Keycloak, a failed lookup fails open), and a
// person who already has a session goes straight on to /post-login instead of seeing the registration form (needs /register in
// AUTH_AWARE_PATH_PREFIXES so keycloak-js has checked for a session).
export default function Register() {
  const navigate = useNavigate()
  const { status } = useClubFromHost()
  const proceed = status === 'root' || status === 'found' || status === 'unavailable'

  useEffect(() => {
    if (!proceed) return
    let cancelled = false
    keycloakInitPromise
      .catch(() => false)
      .then(() => {
        if (cancelled) return
        if (keycloak.authenticated) navigate('/post-login', { replace: true })
        else keycloak.register({ redirectUri: `${window.location.origin}/post-login` })
      })
    return () => {
      cancelled = true
    }
  }, [proceed, navigate])

  if (status === 'missing') return <ClubAddressMissing />
  return <FullPageLoader variant="backdrop" message="Taking you to create your account" />
}
