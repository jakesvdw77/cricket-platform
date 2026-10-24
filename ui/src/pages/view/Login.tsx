import { useEffect } from 'react'
import { FullPageLoader } from '../../components/CricketBallLoader'
import { keycloak } from '../../auth/keycloak'

export default function Login() {
  useEffect(() => {
    keycloak.login({ redirectUri: `${window.location.origin}/post-login` })
  }, [])

  return <FullPageLoader variant="backdrop" message="Taking you to sign in" />
}
