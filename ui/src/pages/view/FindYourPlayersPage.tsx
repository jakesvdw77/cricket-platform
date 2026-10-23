import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Alert, Box, Button, Card, CardContent, Checkbox, Container, FormControlLabel, Tooltip, Typography } from '@mui/material'
import { keycloak } from '../../auth/keycloak'
import { useConfirmLinks, usePlayerMatches, useRegisterAccount } from '../../api/meApi'
import type { PlayerMatch } from '../../api/meApi'

// docs/specs/119 Part 3: "Find your players". Register is idempotent; matches are minimised
// (first name + surname initial, birth year only, masked email for players that have a main agent).
const describe = (p: PlayerMatch) => `${p.firstName} ${p.surnameInitial}.`

function errorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? (error.response?.data as { code?: string } | undefined)?.code : undefined
}

function SignOut() {
  return (
    <Box sx={{ mt: 3 }}>
      <Button variant="outlined" size="small" sx={{ minHeight: 32 }} onClick={() => keycloak.logout()}>
        Sign out
      </Button>
    </Box>
  )
}

export default function FindYourPlayersPage() {
  const register = useRegisterAccount()
  const { mutate: registerMutate } = register
  const registered = register.isSuccess
  const matches = usePlayerMatches(registered)
  const confirm = useConfirmLinks()
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const [linkedNames, setLinkedNames] = useState<string[] | null>(null)

  useEffect(() => {
    registerMutate()
  }, [registerMutate])

  const failure = register.error ?? matches.error
  const notVerified = failure && (errorCode(failure) === 'EMAIL_NOT_VERIFIED' || (isAxiosError(failure) && failure.response?.status === 403))

  let body
  if (linkedNames) {
    body = (
      <>
        <Typography variant="h5" component="h1" gutterBottom>
          You now manage {linkedNames.join(', ')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          My players is coming soon, where you will see and answer availability for them.
        </Typography>
      </>
    )
  } else if (failure) {
    body = (
      <>
        <Typography variant="h5" component="h1" gutterBottom>
          Find your players
        </Typography>
        <Alert severity={notVerified ? 'warning' : 'error'}>
          {notVerified
            ? 'Please verify your email address first. Check your inbox for the verification email, then sign in again.'
            : 'Something went wrong finding your players. Please try again later.'}
        </Alert>
      </>
    )
  } else if (!matches.data) {
    body = (
      <Typography variant="body1" color="text.secondary">
        Looking for your players…
      </Typography>
    )
  } else {
    const { withoutMainAgent: free, withMainAgent: taken } = matches.data
    const all = [...free, ...taken]
    const single = all.length === 1 ? all[0] : null
    const title = free.length + taken.length === 0 ? 'No player found' : single?.adult ? 'Is this you?' : 'Are these your players?'
    const selected = free.filter((p) => !unticked.has(p.ref))
    body = (
      <>
        <Typography variant="h5" component="h1" gutterBottom>
          {title}
        </Typography>
        {all.length === 0 && (
          <>
            <Typography variant="body1" color="text.secondary">
              We could not find a player with your email address at any club. Your club may have a different email on file for you.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Requesting a link will be available soon.
            </Typography>
          </>
        )}
        {free.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }} role="group" aria-label="Players to link">
            {free.map((p) => (
              <FormControlLabel
                key={p.ref}
                sx={{ minHeight: 44, alignItems: 'center' }}
                control={
                  <Checkbox
                    checked={!unticked.has(p.ref)}
                    onChange={(_, on) =>
                      setUnticked((prev) => {
                        const next = new Set(prev)
                        if (on) next.delete(p.ref)
                        else next.add(p.ref)
                        return next
                      })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {describe(p)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[p.clubName, p.groupLabel, p.birthYear ? `Born ${p.birthYear}` : null].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                }
              />
            ))}
            {confirm.isError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                We could not link those players. Please try again.
              </Alert>
            )}
            <Button
              variant="contained"
              sx={{ mt: 2, minHeight: 44, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
              disabled={selected.length === 0 || confirm.isPending}
              onClick={() =>
                confirm.mutate(
                  selected.map((p) => p.ref),
                  { onSuccess: () => setLinkedNames(selected.map(describe)) },
                )
              }
            >
              Confirm
            </Button>
          </Box>
        )}
        {taken.length > 0 && (
          <Box sx={{ mt: 3 }} data-testid="main-agent-block">
            <Typography variant="subtitle1" component="h2" fontWeight={600}>
              Contact the main agent
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              These players already have a main agent. Ask them to add you.
            </Typography>
            {taken.map((p) => (
              <Box key={p.ref} sx={{ py: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {describe(p)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {[p.clubName, p.groupLabel, p.birthYear ? `Born ${p.birthYear}` : null].filter(Boolean).join(' · ')}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Main agent: {p.maskedMainAgentEmail}
                </Typography>
              </Box>
            ))}
            <Tooltip title="Available soon">
              <span>
                <Button variant="outlined" size="small" sx={{ minHeight: 32 }} disabled>
                  Ask the club to help
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}
      </>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Card variant="outlined" data-testid="welcome-page">
        <CardContent>
          {body}
          <SignOut />
        </CardContent>
      </Card>
    </Container>
  )
}
