import { Alert, Avatar, Box, ButtonBase, Chip, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useMyPlayers } from '../../api/myPlayersApi'
import { useMyInvitations, useMyLinkRequests } from '../../api/meApi'
import { MyLinkRequests } from './MyLinkRequests'
import { HubFooterButton, HubFrame } from './myPlayers/HubFrame'
import { HUB, hubHeading } from './myPlayers/hubStyle'
import { useClubHome } from './myPlayers/useClubHome'
import { creamAlpha, blackAlpha, GOLD_DISC_GRADIENT } from '../../brandTokens'

// docs/specs/119 3C: /account is the picker, in the same dark console as the player hub. One tile per player (own record
// first); choosing one opens that player's hub. A person with exactly one player skips the picker.
const playerPath = (key: string) => `/account/players/${key}`

// The "Link more players" tile: the same size as a player tile, dashed gold, at the end of the grid.
function LinkMoreTile({ onClick }: { onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      data-testid="link-more-players"
      sx={{
        width: '100%',
        minHeight: 176,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        p: 2.5,
        textAlign: 'center',
        bgcolor: alpha(HUB.gold, 0.06),
        border: 2,
        borderStyle: 'dashed',
        borderColor: alpha(HUB.gold, 0.7),
        borderRadius: '4px',
        color: HUB.gold,
        '&:hover': { borderColor: HUB.gold, bgcolor: alpha(HUB.gold, 0.14) },
        '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
        '@media (prefers-reduced-motion: no-preference)': { transition: 'background-color .15s, border-color .15s' },
      }}
    >
      <PersonAddAlt1OutlinedIcon sx={{ fontSize: 44 }} />
      <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 26, lineHeight: 1.05, letterSpacing: '.04em', textTransform: 'uppercase' }}>Link more players</Typography>
      <Typography sx={{ fontSize: 14, color: HUB.muted }}>Find players you manage</Typography>
    </ButtonBase>
  )
}

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
  const grid = { display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }

  let body
  if (players.isLoading) {
    body = (
      <Box aria-busy="true" aria-label="Loading your players" sx={grid}>
        <Skeleton variant="rounded" height={176} sx={{ bgcolor: creamAlpha(.12) }} />
        <Skeleton variant="rounded" height={176} sx={{ bgcolor: creamAlpha(.12) }} />
      </Box>
    )
  } else if (players.isError) {
    body = <Alert severity="error">Something went wrong loading your players. Please try again later.</Alert>
  } else if (list.length === 0) {
    body = (
      <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2.75, bgcolor: blackAlpha(.22), color: HUB.muted }}>
        <Box component="b" sx={{ display: 'block', color: HUB.cream, fontFamily: HUB.display, fontSize: 24, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, mb: 0.5 }}>
          No players yet
        </Box>
        Once a club links you to a player, they appear here.
      </Box>
    )
  } else {
    body = (
      <Box role="list" aria-label="Player Hub" sx={grid}>
        {list.map((p) => (
          <Box key={p.key} role="listitem" sx={{ display: 'flex' }}>
            <ButtonBase
              onClick={() => navigate(playerPath(p.key))}
              aria-label={`${p.firstName} ${p.lastName}`}
              sx={{
                width: '100%',
                minHeight: 176,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                p: 2.5,
                textAlign: 'center',
                bgcolor: blackAlpha(.30),
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
                sx={{ width: 92, height: 92, border: `3px solid ${HUB.cream}`, fontFamily: HUB.display, fontWeight: 700, fontSize: 34, color: HUB.ink, background: GOLD_DISC_GRADIENT }}
              >
                {`${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0, width: '100%' }}>
                <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 26, lineHeight: 1.05, letterSpacing: '.02em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
                  {p.firstName} {p.lastName}
                </Typography>
                {p.self && <Chip size="small" label="You" sx={{ mt: 0.75, height: 20, bgcolor: HUB.gold, color: HUB.ink, fontWeight: 700 }} />}
              </Box>
            </ButtonBase>
          </Box>
        ))}
        <Box role="listitem" sx={{ display: 'flex' }}>
          <LinkMoreTile onClick={() => navigate('/welcome')} />
        </Box>
      </Box>
    )
  }

  return (
    <HubFrame
      title="Player Hub"
      panel="clear"
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
      {!players.isLoading && !players.isError && list.length === 0 && (
        <Box sx={grid}>
          <LinkMoreTile onClick={() => navigate('/welcome')} />
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
