import { Alert, Avatar, Box, ButtonBase, Skeleton, Typography, useMediaQuery, useTheme } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { MyLinkRequests } from './MyLinkRequests'
import { useMyPlayer, useMyPlayerPolls, useMyPlayers } from '../../api/myPlayersApi'
import { HubFooterButton, HubFrame } from './myPlayers/HubFrame'
import { MyPlayerEditForm } from './myPlayers/MyPlayerEditForm'
import { HubProfile } from './myPlayers/HubProfile'
import { MyPlayerPolls } from './myPlayers/MyPlayerPolls'
import { HUB, hubHeading, hubOutlineButton } from './myPlayers/hubStyle'

// docs/specs/119 3C: the player hub (/account/players/:key/:section). A console style menu (right-aligned condensed bars,
// gold when selected) beside a player card and the chosen section. Schedule and Stats are selectable but locked until the
// club shares that data with linked accounts. An unknown section means Availability.
const SECTIONS = ['availability', 'profile', 'schedule', 'stats', 'requests'] as const
type Section = (typeof SECTIONS)[number]
const LABEL: Record<Section, string> = { availability: 'Availability', profile: 'Profile', schedule: 'Schedule', stats: 'Stats', requests: 'Link requests' }
const SOON: Partial<Record<Section, string>> = {
  schedule: 'Upcoming matches and training for this player will show here once the club shares them with linked accounts.',
  stats: "Personal bests, form and season progress. Figures come from the club's published results and are never ranked against other players.",
}

// The old separate details route now lives in the Profile section.
export function LegacyDetailsRedirect() {
  const { key } = useParams<{ key: string }>()
  return <Navigate to={`/account/players/${key}/profile`} replace />
}

function Pill({ children, dashed }: { children: string; dashed?: boolean }) {
  return (
    <Box component="span" sx={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', px: '9px', py: '3px', borderRadius: 999, border: `1px ${dashed ? 'dashed' : 'solid'} currentColor`, textTransform: 'none' }}>
      {children}
    </Box>
  )
}

const barSx = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 1.5,
  textAlign: 'right',
  fontFamily: HUB.display,
  fontWeight: 600,
  fontSize: { xs: 22, md: 28 },
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: HUB.cream,
  bgcolor: 'rgba(0,0,0,.22)',
  borderTop: `1px solid ${HUB.line}`,
  px: { xs: 2.25, md: 2.75 },
  py: { xs: 1.75, md: 2.5 },
  minHeight: { xs: 56, md: 64 },
  '&:hover': { bgcolor: alpha(HUB.gold, 0.1) },
  '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: -2 },
  '@media (prefers-reduced-motion: no-preference)': { transition: 'background-color .15s, color .15s' },
} as const

export default function MyPlayerPage() {
  const { key, section: rawSection, sub } = useParams<{ key: string; section?: string; sub?: string }>()
  const navigate = useNavigate()
  const playerQuery = useMyPlayer(key)
  const player = playerQuery.data
  const polls = useMyPlayerPolls(key)
  const many = (useMyPlayers().data?.length ?? 0) > 1
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
  const section: Section = (SECTIONS as readonly string[]).includes(rawSection ?? '') ? (rawSection as Section) : 'availability'
  const open = polls.data?.length ?? 0
  // /profile/edit replaces the right panel with the dark edit form; on a phone the menu collapses away meanwhile.
  const editing = section === 'profile' && sub === 'edit'
  // Phone: /account/players/:key is the main menu screen and each section is its own full screen. Desktop: that URL means Availability.
  const phoneMenu = phone && !rawSection
  const phoneSection = phone && Boolean(rawSection) && !editing
  const go = (next: Section) => navigate(`/account/players/${key}/${next}`)

  if (!phone && !rawSection && key) return <Navigate to={`/account/players/${key}/availability`} replace />

  let panel
  if (section === 'availability') {
    panel = (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography component="h2" sx={hubHeading}>
          Availability
        </Typography>
        {player && <MyPlayerPolls playerKey={player.key} playerName={player.firstName} />}
      </Box>
    )
  } else if (editing) {
    panel = player && (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography component="h2" sx={hubHeading}>
          Edit profile
        </Typography>
        <MyPlayerEditForm key={player.key} player={player} dark onBack={() => go('profile')} onDone={() => go('profile')} />
      </Box>
    )
  } else if (section === 'profile') {
    panel = player && <HubProfile player={player} />
  } else if (section === 'requests') {
    panel = (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography component="h2" sx={hubHeading}>
          Link requests
        </Typography>
        <MyLinkRequests dark />
        <Button variant="secondary" size="compact" startIcon={<PersonSearchOutlinedIcon />} onClick={() => navigate('/welcome')} sx={hubOutlineButton}>
          Find more players
        </Button>
      </Box>
    )
  } else {
    panel = (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Typography component="h2" sx={hubHeading}>
          {LABEL[section]}
        </Typography>
        <Box sx={{ border: 1, borderStyle: 'dashed', borderColor: HUB.line, borderRadius: '4px', p: 2.75, color: HUB.muted, bgcolor: 'rgba(0,0,0,.22)' }}>
          <Box component="b" sx={{ display: 'block', color: HUB.cream, fontFamily: HUB.display, fontSize: 24, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, mb: 0.5 }}>
            Coming soon
          </Box>
          {SOON[section]}
        </Box>
      </Box>
    )
  }

  const bars = SECTIONS.map((item, index) => {
    const selected = item === section && !phoneMenu
    const locked = item === 'schedule' || item === 'stats'
    return (
      <ButtonBase
        key={item}
        onClick={() => go(item)}
        aria-current={selected ? 'page' : undefined}
        sx={{
          ...barSx,
          ...(phoneMenu && { minHeight: 64, flex: 1, borderRadius: 0 }),
          ...(selected && { color: HUB.gold, bgcolor: alpha(HUB.gold, 0.16) }),
          ...(locked && !selected && { opacity: 0.75 }),
          ...(index === SECTIONS.length - 1 && { borderBottom: `1px solid ${HUB.line}` }),
        }}
      >
        {LABEL[item]}
        {item === 'availability' && open > 0 && <Pill>{`${open} open`}</Pill>}
        {locked && <Pill dashed>Soon</Pill>}
      </ButtonBase>
    )
  })

  const menu =
    editing || phone ? undefined : (
      <Box
        component="nav"
        aria-label="Player sections"
        sx={{ borderRight: `1px solid ${HUB.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'linear-gradient(180deg, transparent, rgba(0,0,0,.18))' }}
      >
        {bars}
      </Box>
    )

  const footer = editing || phoneSection ? undefined : many ? (
    <HubFooterButton onClick={() => navigate('/account')}>Back to players</HubFooterButton>
  ) : (
    <HubFooterButton onClick={() => navigate('/welcome')} icon={<PersonSearchOutlinedIcon sx={{ fontSize: 20 }} />}>
      Find more players
    </HubFooterButton>
  )

  return (
    <HubFrame title={editing ? 'Edit Profile' : 'My Player'} phoneTitle="hidden" menu={menu} footer={footer} testId="my-player-page">
      {playerQuery.isError && <Alert severity="error">We could not load this player. Please try again.</Alert>}
      {!player && !playerQuery.isError && <Skeleton variant="rounded" height={112} sx={{ bgcolor: 'rgba(247,243,232,.12)' }} />}
      {phoneSection && player && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 44 }}>
          <ButtonBase
            onClick={() => navigate(`/account/players/${key}`)}
            aria-label="Back to menu"
            sx={{ width: 44, height: 44, borderRadius: '50%', border: `1px solid ${HUB.line}`, color: HUB.cream, flex: 'none', '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
          >
            <ArrowBackIcon />
          </ButtonBase>
          <Typography component="h1" sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: 28, letterSpacing: '.04em', textTransform: 'uppercase', lineHeight: 1 }}>
            {LABEL[section]}
          </Typography>
          <Typography sx={{ ml: 'auto', color: HUB.muted, fontSize: 14, textAlign: 'right' }}>{player.firstName}</Typography>
        </Box>
      )}
      {player && !editing && !phoneSection && (
        <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar
            src={player.photoUrl ?? undefined}
            alt=""
            sx={{ width: { xs: 60, md: 112 }, height: { xs: 60, md: 112 }, border: `3px solid ${HUB.cream}`, fontFamily: HUB.display, fontWeight: 700, fontSize: { xs: 24, md: 44 }, letterSpacing: '.04em', color: HUB.ink, background: `radial-gradient(circle at 30% 25%, #f4d676, ${HUB.gold})` }}
          >
            {`${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`.toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: '1 1 200px' }}>
            <Typography sx={{ fontFamily: HUB.display, fontWeight: 700, fontSize: { xs: 24, md: 'clamp(26px, 3vw, 36px)' }, lineHeight: 1, letterSpacing: '0.02em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
              {player.firstName} {player.lastName}
            </Typography>
            <Typography fontSize={15} sx={{ color: HUB.muted, mt: 0.75 }}>
              {[player.clubName, player.groupLabel].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          {player.jerseyNumber !== null && (
            <Box sx={{ ml: { md: 'auto' }, textAlign: 'center', fontFamily: HUB.display, fontWeight: 700, border: `1px solid ${HUB.line}`, borderRadius: '4px', px: 2.25, pt: 0.75, pb: 0.5, bgcolor: 'rgba(0,0,0,.25)' }}>
              <Box component="small" sx={{ display: 'block', fontSize: 12, letterSpacing: '.14em', color: HUB.muted, fontWeight: 500 }}>
                JERSEY
              </Box>
              <Box component="span" sx={{ fontSize: 46, lineHeight: 1, color: HUB.gold }}>
                {player.jerseyNumber}
              </Box>
            </Box>
          )}
        </Box>
      )}
      {phoneMenu ? (
        <Box component="nav" aria-label="Player sections" sx={{ display: 'flex', flexDirection: 'column', mx: -2, mb: -2.5, minHeight: 'calc(100vh - 56px - 56px - 150px)' }}>
          {bars}
        </Box>
      ) : (
        panel
      )}
    </HubFrame>
  )
}
