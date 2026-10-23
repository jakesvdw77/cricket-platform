import { Box, Button, Card, CardContent, Container, Typography } from '@mui/material'
import { keycloak } from '../../auth/keycloak'

// docs/specs/119 Part 2: minimal landing for a signed-in person with no resolvable profile.
// Slice 3 replaces this with the real "Find your players" screen.
export default function WelcomePage() {
  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Card variant="outlined" data-testid="welcome-page">
        <CardContent>
          <Typography variant="h5" component="h1" gutterBottom>
            Welcome to Cricket Legend
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You are signed in, but your account is not linked to a club or a player yet. Matching your
            account to your players comes next. If you are a club manager, ask your Club Admin to add you.
          </Typography>
          <Box sx={{ mt: 3 }}>
            <Button variant="outlined" size="small" onClick={() => keycloak.logout()}>
              Sign out
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  )
}
