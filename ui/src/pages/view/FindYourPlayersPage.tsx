import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { alpha } from '@mui/material/styles'
import { Alert, Avatar, Box, Checkbox, Skeleton, Typography } from '@mui/material'
import { Button } from '../../components/Button'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined'
import { keycloak } from '../../auth/keycloak'
import { useMyPlayers } from '../../api/myPlayersApi'
import { useConfirmLinks, usePlayerMatches, useRegisterAccount } from '../../api/meApi'
import type { MainAgentMatch, PlayerMatch } from '../../api/meApi'
import { LinkRequestForm } from './LinkRequestForm'
import type { LinkRequestPrefill } from './LinkRequestForm'
import { MyLinkRequests } from './MyLinkRequests'
import { HubBackButton, HubFooterButton, HubFrame } from './myPlayers/HubFrame'
import { HUB, hubGoldButton, hubHeading, hubOutlineButton } from './myPlayers/hubStyle'
import { useClubHome } from './myPlayers/useClubHome'
import { creamAlpha, GOLD_DISC_GRADIENT } from '../../brandTokens'

// docs/specs/119 Part 3: "Find your players", in the dark console frame. Register is idempotent; matches are minimised
// (first name + surname initial, birth year only, masked email for players that have a main agent). Every sub-state has a
// Back, and the footer's Back slot returns to Player Hub (or the club for a manager), so there is never a dead end.
const describe = (p: PlayerMatch) => `${p.firstName} ${p.surnameInitial}.`

function errorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? (error.response?.data as { code?: string } | undefined)?.code : undefined
}

const detail = (p: PlayerMatch) => [p.clubName, p.groupLabel, p.birthYear ? `Born ${p.birthYear}` : null].filter(Boolean).join(' · ')

function PlayerAvatar({ p }: { p: PlayerMatch }) {
  return (
    <Avatar sx={{ width: 40, height: 40, fontFamily: HUB.display, fontSize: 18, fontWeight: 700, color: HUB.ink, background: GOLD_DISC_GRADIENT }}>
      {`${p.firstName[0] ?? ''}${p.surnameInitial[0] ?? ''}`.toUpperCase()}
    </Avatar>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <Typography component="h2" sx={{ ...hubHeading, fontSize: { xs: 24, md: 28 }, color: HUB.cream, lineHeight: 1.1 }}>
      {children}
    </Typography>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" sx={{ color: HUB.muted }}>
      {children}
    </Typography>
  )
}

const bigButton = { minHeight: { xs: 44, sm: 40 }, width: { xs: '100%', sm: 'auto' } }
const darkBox = { border: 1, borderColor: HUB.line, bgcolor: HUB.panelDark, borderRadius: '4px' }

export default function FindYourPlayersPage() {
  const navigate = useNavigate()
  const register = useRegisterAccount()
  const { mutate: registerMutate } = register
  const registered = register.isSuccess
  const matches = usePlayerMatches(registered)
  const confirm = useConfirmLinks()
  const hasPlayers = (useMyPlayers().data?.length ?? 0) > 0
  const clubHome = useClubHome()
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

  // Back from a finished or side view: Player Hub when the person has players, otherwise the previous state.
  const backToPlayersOr = (previous: () => void) => () => (hasPlayers ? navigate('/account') : previous())
  const toMain = () => {
    setPrefill(undefined)
    setView('main')
  }

  let body
  if (linkedNames) {
    body = (
      <>
        <CheckCircleOutlineIcon sx={{ fontSize: 40, color: HUB.gold }} />
        <Heading>You now manage {linkedNames.join(', ')}</Heading>
        <Lead>In Player Hub you can see their details and answer availability for them.</Lead>
        <Box>
          <Button onClick={() => navigate('/account')} sx={{ ...bigButton, ...hubGoldButton }}>
            Go to Player Hub
          </Button>
        </Box>
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
        <Skeleton variant="text" width="60%" height={32} sx={{ bgcolor: creamAlpha(.12) }} />
        <Skeleton variant="rounded" height={64} sx={{ bgcolor: creamAlpha(.12) }} />
        <Skeleton variant="rounded" height={64} sx={{ bgcolor: creamAlpha(.12) }} />
      </Box>
    )
  } else if (view === 'form') {
    body = (
      <>
        <HubBackButton onClick={() => setView('main')} />
        <Heading>Ask the club to help</Heading>
        <Lead>Tell the club who you are and which player you manage. A club manager will check it before anyone is linked.</Lead>
        <LinkRequestForm dark prefill={prefill} onSent={() => setView('sent')} />
      </>
    )
  } else if (view === 'sent') {
    body = (
      <>
        <HubBackButton onClick={backToPlayersOr(toMain)}>{hasPlayers ? 'Back to players' : 'Back'}</HubBackButton>
        <CheckCircleOutlineIcon sx={{ fontSize: 40, color: HUB.gold }} />
        <Heading>Thanks, the club will review this</Heading>
        <Lead>We will show the outcome here, and email you when the club has decided.</Lead>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => setView('mine')}>
            See my requests
          </Button>
          <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={toMain}>
            Send another request
          </Button>
        </Box>
      </>
    )
  } else if (view === 'mine') {
    body = (
      <>
        <HubBackButton onClick={backToPlayersOr(toMain)}>{hasPlayers ? 'Back to players' : 'Back'}</HubBackButton>
        <Heading>My requests</Heading>
        <MyLinkRequests dark />
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
        {all.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SearchOffOutlinedIcon sx={{ fontSize: 36, color: HUB.gold }} />
              <Heading>{title}</Heading>
            </Box>
            <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => setView('mine')}>
              My requests
            </Button>
          </Box>
        ) : (
          <Heading>{title}</Heading>
        )}
        {all.length === 0 ? (
          <>
            <Lead>
              We could not find a player with <Box component="b" sx={{ color: HUB.gold, fontWeight: 600, overflowWrap: 'anywhere' }}>{email ?? 'your email address'}</Box> at any club. Tell the club who you are and which player you manage. A club
              manager will check it before anyone is linked.
            </Lead>
            <LinkRequestForm dark onSent={() => setView('sent')} />
          </>
        ) : (
          free.length > 0 && <Lead>We found these on record for {email ?? 'your email address'}. Untick any that are not yours.</Lead>
        )}
        {free.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} role="group" aria-label="Players to link">
            {free.map((p) => {
              const on = !unticked.has(p.ref)
              return (
                <Box
                  key={p.ref}
                  component="label"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    minHeight: 64,
                    px: 1.5,
                    py: 1,
                    cursor: 'pointer',
                    border: 1,
                    borderColor: on ? HUB.gold : HUB.line,
                    boxShadow: on ? `inset 0 0 0 1px ${HUB.gold}` : 'none',
                    borderRadius: '4px',
                    bgcolor: on ? alpha(HUB.gold, 0.1) : HUB.panelDark,
                    '&:focus-within': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
                  }}
                >
                  <PlayerAvatar p={p} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} fontSize={15}>
                      {describe(p)}
                    </Typography>
                    <Typography variant="caption" display="block" sx={{ color: HUB.muted }}>
                      {detail(p)}
                    </Typography>
                  </Box>
                  <Checkbox
                    checked={on}
                    inputProps={{ 'aria-label': describe(p) }}
                    sx={{ color: HUB.muted, '&.Mui-checked': { color: HUB.gold } }}
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
                sx={{ ...bigButton, ...hubGoldButton }}
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
          <Box data-testid="main-agent-block" sx={{ ...darkBox, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {free.length > 0 && (
              <Typography component="h2" sx={{ ...hubHeading, fontSize: 18 }}>
                Contact the main agent
              </Typography>
            )}
            <Lead>These players already have a main agent. Ask them to add you from their Player Hub screen. We never show the full address.</Lead>
            {taken.map((p) => (
              <Box key={p.ref} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PlayerAvatar p={p} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} fontSize={15}>
                    {describe(p)}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ color: HUB.muted }}>
                    {detail(p)}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ color: HUB.muted }}>
                    Main agent: {p.maskedMainAgentEmail}
                  </Typography>
                </Box>
              </Box>
            ))}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {taken.map((p) => (
                <Button key={p.ref} variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => askClub(p)}>
                  {taken.length > 1 ? `Ask the club to help with ${describe(p)}` : 'Ask the club to help'}
                </Button>
              ))}
              <Button variant="secondary" size="compact" sx={hubOutlineButton} onClick={() => setView('mine')}>
                My requests
              </Button>
            </Box>
          </Box>
        )}
      </>
    )
  }

  const footer = hasPlayers ? (
    <HubFooterButton onClick={() => navigate('/account')}>Back to players</HubFooterButton>
  ) : clubHome ? (
    <HubFooterButton onClick={() => navigate(clubHome)}>Back to club</HubFooterButton>
  ) : undefined

  return (
    <HubFrame title="Find Players" maxWidth={960} testId="welcome-page" footer={footer}>
      {body}
    </HubFrame>
  )
}
