import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import type { ReactNode } from 'react'
import { alpha } from '@mui/material/styles'
import { Alert, Avatar, Box, Button, Checkbox, Skeleton, Typography } from '@mui/material'
import { Button as AppButton } from '../../components/Button'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined'
import { BACKDROP_COLOURS, PageBackdrop } from '../../components/PageBackdrop'
import { keycloak } from '../../auth/keycloak'
import { useConfirmLinks, usePlayerMatches, useRegisterAccount } from '../../api/meApi'
import type { MainAgentMatch, PlayerMatch } from '../../api/meApi'
import { LinkRequestForm } from './LinkRequestForm'
import type { LinkRequestPrefill } from './LinkRequestForm'
import { MyLinkRequests } from './MyLinkRequests'

// docs/specs/119 Part 3: "Find your players". Register is idempotent; matches are minimised
// (first name + surname initial, birth year only, masked email for players that have a main agent).
const describe = (p: PlayerMatch) => `${p.firstName} ${p.surnameInitial}.`

function errorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? (error.response?.data as { code?: string } | undefined)?.code : undefined
}

const detail = (p: PlayerMatch) => [p.clubName, p.groupLabel, p.birthYear ? `Born ${p.birthYear}` : null].filter(Boolean).join(' · ')

function PlayerAvatar({ p }: { p: PlayerMatch }) {
  return (
    <Avatar
      sx={(t) => ({ width: 40, height: 40, fontSize: 15, fontWeight: 600, bgcolor: alpha(t.palette.primary.main, 0.14), color: 'primary.dark' })}
    >
      {`${p.firstName[0] ?? ''}${p.surnameInitial[0] ?? ''}`.toUpperCase()}
    </Avatar>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <PageBackdrop>
      <Box component="header" sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, gap: 1, color: BACKDROP_COLOURS.cream }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="img" src="/favicon.svg" alt="" width={28} height={28} />
          <Typography fontWeight={700} fontSize={16}>
            Cricket Legend
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          sx={{ minHeight: 32, color: BACKDROP_COLOURS.cream, borderColor: BACKDROP_COLOURS.cream, '&:hover': { borderColor: BACKDROP_COLOURS.cream, bgcolor: 'rgba(247,243,232,0.12)' } }}
          onClick={() => keycloak.logout()}
        >
          Sign out
        </Button>
      </Box>
      <Box sx={{ width: '100%', maxWidth: 592, mx: 'auto', px: 2, py: { xs: 2, sm: 4 }, boxSizing: 'border-box' }}>
        <Box
          data-testid="welcome-page"
          sx={{ bgcolor: 'background.paper', color: 'text.primary', borderRadius: 2, boxShadow: 1, p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {children}
        </Box>
      </Box>
    </PageBackdrop>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <Typography variant="h5" component="h1" fontWeight={700} fontSize={22} lineHeight={1.25}>
      {children}
    </Typography>
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
  // docs/specs/119 Part 3 (3B): 'form' is "Ask the club to help" for one matched player, 'sent' the one confirmation shown
  // after every request, 'mine' the requester's own status list.
  const [view, setView] = useState<'main' | 'form' | 'sent' | 'mine'>('main')
  const [prefill, setPrefill] = useState<LinkRequestPrefill | undefined>(undefined)
  const askClub = (p: MainAgentMatch) => {
    setPrefill({ firstName: p.firstName, surnameInitial: p.surnameInitial, clubId: p.clubId, clubName: p.clubName, targetPlayerRef: p.ref })
    setView('form')
  }
  const email = (keycloak.tokenParsed as { email?: string } | undefined)?.email

  useEffect(() => {
    registerMutate()
  }, [registerMutate])

  const failure = register.error ?? matches.error
  const notVerified = failure && (errorCode(failure) === 'EMAIL_NOT_VERIFIED' || (isAxiosError(failure) && failure.response?.status === 403))

  let body
  if (linkedNames) {
    body = (
      <>
        <CheckCircleOutlineIcon color="primary" sx={{ fontSize: 40 }} />
        <Heading>You now manage {linkedNames.join(', ')}</Heading>
        <Typography variant="body2" color="text.secondary">
          My players is coming soon, where you will see and answer availability for them.
        </Typography>
      </>
    )
  } else if (failure) {
    body = (
      <>
        <Heading>Find your players</Heading>
        <Alert severity={notVerified ? 'warning' : 'error'}>
          {notVerified
            ? 'Please verify your email address first. Check your inbox for the verification email, then sign in again.'
            : 'Something went wrong finding your players. Please try again later.'}
        </Alert>
      </>
    )
  } else if (!matches.data) {
    body = (
      <Box aria-busy="true" aria-label="Looking for your players" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="rounded" height={64} />
        <Skeleton variant="rounded" height={64} />
      </Box>
    )
  } else if (view === 'form') {
    body = (
      <>
        <Heading>Ask the club to help</Heading>
        <Typography variant="body2" color="text.secondary">
          Tell the club who you are and which player you manage. A club manager will check it before anyone is linked.
        </Typography>
        <LinkRequestForm prefill={prefill} onSent={() => setView('sent')} onBack={() => setView('main')} />
      </>
    )
  } else if (view === 'sent') {
    body = (
      <>
        <CheckCircleOutlineIcon color="primary" sx={{ fontSize: 40 }} />
        <Heading>Thanks, the club will review this</Heading>
        <Typography variant="body2" color="text.secondary">
          We will show the outcome here, and email you when the club has decided.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <AppButton variant="secondary" size="compact" onClick={() => setView('mine')}>
            See my requests
          </AppButton>
          <AppButton variant="secondary" size="compact" onClick={() => { setPrefill(undefined); setView('main') }}>
            Send another request
          </AppButton>
        </Box>
      </>
    )
  } else if (view === 'mine') {
    body = (
      <>
        <Heading>My requests</Heading>
        <MyLinkRequests />
        <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-start' } }}>
          <AppButton onClick={() => setView('main')} sx={{ minHeight: { xs: 44, sm: 40 }, width: { xs: '100%', sm: 'auto' } }}>
            Back
          </AppButton>
        </Box>
      </>
    )
  } else {
    const { withoutMainAgent: free, withMainAgent: taken } = matches.data
    const all = [...free, ...taken]
    const single = all.length === 1 ? all[0] : null
    const title = all.length === 0 ? 'No player found' : free.length === 0 ? 'Contact the main agent' : single?.adult ? 'Is this you?' : 'Are these your players?'
    const selected = free.filter((p) => !unticked.has(p.ref))
    body = (
      <>
        {all.length === 0 && <SearchOffOutlinedIcon color="primary" sx={{ fontSize: 40 }} />}
        <Heading>{title}</Heading>
        {all.length === 0 ? (
          <>
            <Typography variant="body2" color="text.secondary">
              We could not find a player with {email ?? 'your email address'} at any club. Your club may have a different email on file for you.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tell the club who you are and which player you manage. A club manager will check it before anyone is linked.
            </Typography>
            <LinkRequestForm onSent={() => setView('sent')} />
            <Box>
              <AppButton variant="secondary" size="compact" onClick={() => setView('mine')}>
                My requests
              </AppButton>
            </Box>
          </>
        ) : (
          free.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              We found these on record for {email ?? 'your email address'}. Untick any that are not yours.
            </Typography>
          )
        )}
        {free.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} role="group" aria-label="Players to link">
            {free.map((p) => {
              const on = !unticked.has(p.ref)
              return (
                <Box
                  key={p.ref}
                  component="label"
                  sx={(t) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    minHeight: 64,
                    px: 1.5,
                    py: 1,
                    cursor: 'pointer',
                    border: 1,
                    borderColor: on ? 'primary.main' : 'divider',
                    boxShadow: on ? `inset 0 0 0 1px ${t.palette.primary.main}` : 'none',
                    borderRadius: 2,
                    bgcolor: on ? alpha(t.palette.primary.main, 0.05) : 'background.paper',
                  })}
                >
                  <PlayerAvatar p={p} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} fontSize={15}>
                      {describe(p)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {detail(p)}
                    </Typography>
                  </Box>
                  <Checkbox
                    checked={on}
                    inputProps={{ 'aria-label': describe(p) }}
                    onChange={(_, v) =>
                      setUnticked((prev) => {
                        const next = new Set(prev)
                        if (v) next.delete(p.ref)
                        else next.add(p.ref)
                        return next
                      })
                    }
                  />
                </Box>
              )
            })}
            {confirm.isError && <Alert severity="error">We could not link those players. Please try again.</Alert>}
            <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mt: 1 }}>
              <Button
                variant="contained"
                sx={{ minHeight: { xs: 44, sm: 40 }, width: { xs: '100%', sm: 'auto' } }}
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
          </Box>
        )}
        {taken.length > 0 && (
          <Box
            data-testid="main-agent-block"
            sx={(t) => ({ bgcolor: alpha(t.palette.primary.main, 0.04), border: 1, borderColor: 'divider', borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 })}
          >
            {free.length > 0 && (
              <Typography variant="subtitle1" component="h2" fontWeight={700}>
                Contact the main agent
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              These players already have a main agent. Ask them to add you from their My players screen. We never show the full address.
            </Typography>
            {taken.map((p) => (
              <Box key={p.ref} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PlayerAvatar p={p} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} fontSize={15}>
                    {describe(p)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {detail(p)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Main agent: {p.maskedMainAgentEmail}
                  </Typography>
                </Box>
              </Box>
            ))}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {taken.map((p) => (
                <AppButton key={p.ref} variant="secondary" size="compact" onClick={() => askClub(p)}>
                  {taken.length > 1 ? `Ask the club to help with ${describe(p)}` : 'Ask the club to help'}
                </AppButton>
              ))}
              <AppButton variant="secondary" size="compact" onClick={() => setView('mine')}>
                My requests
              </AppButton>
            </Box>
          </Box>
        )}
      </>
    )
  }

  return <Shell>{body}</Shell>
}
