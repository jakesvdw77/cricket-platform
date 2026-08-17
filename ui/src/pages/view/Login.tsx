import { useEffect } from 'react'
import { Container, Typography } from '@mui/material'
import { keycloak } from '../../auth/keycloak'

export default function Login() {
  useEffect(() => {
    keycloak.login({ redirectUri: `${window.location.origin}/admin` })
  }, [])

  return (
    <Container maxWidth="sm" sx={{ py: 5, textAlign: 'center' }}>
      <Typography variant="body1" color="text.secondary">
        Redirecting to login…
      </Typography>
    </Container>
  )
}
