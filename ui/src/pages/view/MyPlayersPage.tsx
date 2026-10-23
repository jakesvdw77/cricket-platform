import { Alert, Avatar, Box, ButtonBase, Chip, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useMyPlayers } from '../../api/myPlayersApi'
import { useMyInvitations, useMyLinkRequests } from '../../api/meApi'
import { MyLinkRequests } from './MyLinkRequests'
import { HubFooterButton, HubFrame } from './myPlayers/HubFrame'
import { HUB, hubHeading, hubOutlineButton } from './myPlayers/hubStyle'
import { useClubHome } from './myPlayers/useClubHome'

// docs/specs/119 3C: /account is the picker, in the same dark console as the player hub. One tile per player (own record
// first); choosing one opens that player's hub. A person with exactly one player skips the picker.
const playerPath = (key: string) => `/account/players/${key}`

export default function MyPlayersPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const players = useMyPlayers()
  const requests = useMyLinkRequests()
  const clubHome = useClubHome()
  const invitations = useMyInvitations()
  const invitationCount = invitations.data?.length ?? 0
  const list = players.data ?? []

  const legacy = params.get('player')
  if (legacy && list.some((p) => p.key === legacy)) return <Navigate to={playerPath(legacy)} replace />
  // A single player skips the picker, unless an invitation is waiting (it is only reachable from here and the hub menu).
  if (list.length === 1 && !invitations.isLoading && invitationCount === 0) return <Navigate to={playerPath(list[0].key)} replace />

  const open = (requests.data ?? []).some((r) => r.status === 'PENDING' || r.status === 'DECLINED')
  const grid = { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }

  let body
  if (players.isLoading) {
    body = (
      <Box aria-busy="true" aria-label="Loading your players" sx={grid}>
        <Skeleton variant="rounded" height={104} sx={{ bgcolor: 'rgba(247,243,232,.12)' }} />
        <Skeleton variant="rounded" height={104} sx={{ bgcolor: 'rgba(247,243,232,.12)' }} />
      </Box>
    )
  } else if (players.isError) {
    body = <Alert severity="error">Something went wrong loading your players. Please try again later.</Alert>
  } else if (list.length === 0) {
    body = (
      <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2.75, bgcolor: 'rgba(0,0,0,.22)', color: HUB.muted }}>
        <Box component="b" sx={{ display: 'block', color: HUB.cream, fontFamily: HUB.display, fontSize: 24, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, mb: 0.5 }}>
          No players yet
        </Box>
        Once a club links you to a player, they appear here.
      </Box>
    )
  } else {
    body = (
      <Box role="list" aria-label="My players" sx={grid}>
        {list.map((p) => (
          <Box key={p.key} role="listitem" sx={{ display: 'flex' }}>
            <ButtonBase
              onClick={() => navigate(playerPath(p.key))}
              aria-label={`${p.firstName} ${p.lastName}`}
              sx={{
                width: '100%',
                minHeight: 104,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 2,
                p: 2,
                textAlign: 'left',
                bgcolor: 'rgba(0,0,0,.30)',
                border: 1,
                borderColor: HUB.line,
                borderRadius: '4px',
                color: HUB.cream,
                '&:hover': { borderColor: HUB.gold, bgcolor: alpha(HUB.gold, 0.1) },
                '&.Mui-focusVisible': { borderColor: HUB.gold, outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
                '@media (prefers-reduced-motion: no-preference)': { transition: 'background-color .15s, border-color .15s' },
              }}
            >
              <Avatar
                src={p.photoUrl ?? undefined}
                alt=""
                sx={{ width: 72, height: 72, border: `2px solid ${HUB.cream}`, fontFamily: HUB.display, fontWeight: 700, fontSize: 28, color: HUB.ink, background: `radial-gradient(circle at 30% 25%, #f4d676, ${HUB.gold})` }}
              >
                {`${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 26, lineHeight: 1.05, letterSpacing: '.02em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
                  {p.firstName} {p.lastName}
                </Typography>
                {p.self && <Chip size="small" label="You" sx={{ mt: 0.75, height: 20, bgcolor: HUB.gold, color: HUB.ink, fontWeight: 700 }} />}
              </Box>
            </ButtonBase>
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <HubFrame
      title="My Players"
      maxWidth={1320}
      testId="my-players-page"
      footer={clubHome ? <HubFooterButton onClick={() => navigate(clubHome)}>Back to club</HubFooterButton> : undefined}
    >
      {invitationCount > 0 && (
        <ButtonBase
          onClick={() => navigate('/account/invitations')}
          data-testid="invitations-banner"
          sx={{ width: '100%', minHeight: 56, px: 2, border: 1, borderColor: HUB.gold, borderRadius: '4px', bgcolor: alpha(HUB.gold, 0.12), color: HUB.cream, justifyContent: 'space-between', gap: 1, '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
        >
          <Typography fontWeight={600}>{invitationCount === 1 ? '1 invitation waiting for you' : `${invitationCount} invitations waiting for you`}</Typography>
          <Typography sx={{ fontFamily: HUB.display, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: HUB.gold }}>View</Typography>
        </ButtonBase>
      )}
      {body}
      {!players.isLoading && !players.isError && (
        <Box>
          <Button variant="secondary" size="compact" startIcon={<PersonSearchOutlinedIcon />} onClick={() => navigate('/welcome')} sx={hubOutlineButton}>
            Find more players
          </Button>
        </Box>
      )}
      {open && (
        <Box sx={{ display: 'grid', gap: 1.5 }} data-testid="my-requests">
          <Typography component="h2" sx={hubHeading}>
            My requests
          </Typography>
          <MyLinkRequests statuses={['PENDING', 'DECLINED']} dark />
        </Box>
      )}
    </HubFrame>
  )
}
