import { Box, ButtonBase, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BrandIcon } from '../../../components/BrandIcon'
import { LogoAvatar } from '../../../components/LogoAvatar'
import { initialsFromName } from '../../../utils/initials'
import type { MyLeagueSummaryDto } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { ageBand, shortDate } from './leagueFormat'

// docs/specs/123 (Leagues list): one league as a poll-card style button. The whole card opens the league page. Hub-local.
// The Hub's logo: the shared LogoAvatar, so a logo that fails to load (a missing file, a bad URL) falls back to the initials tile, never a
// broken image icon (docs/standards/page-anatomy.md 6a). With a `name` the fallback is its initials; a league (no name) keeps the brand icon.
export function LeagueLogo({ logoUrl, size, name }: { logoUrl: string | null; size: number; name?: string }) {
  if (!logoUrl && !name) return <BrandIcon name="nav/cricket-leagues" size={size} onDark />
  return (
    <LogoAvatar src={logoUrl} size={size} variant="rounded" fontSize={`${Math.round(size * 0.4)}px`} aria-hidden data-testid="hub-logo" sx={{ borderRadius: '4px' }}>
      {name ? initialsFromName(name) : <BrandIcon name="nav/cricket-leagues" size={size} onDark />}
    </LogoAvatar>
  )
}

export function HubLeagueCard({ league, seasonName, onOpen }: { league: MyLeagueSummaryDto; seasonName?: string; onOpen: () => void }) {
  const band = ageBand(league)
  const teams = league.myTeams.map((team) => team.name).join(', ')
  const facts = [band, `${league.teamCount} ${league.teamCount === 1 ? 'team' : 'teams'}`, league.nextMatchDate ? `Next match ${shortDate(league.nextMatchDate)}` : null].filter(Boolean)
  const name = [league.name, seasonName, teams ? `your team ${teams}` : null].filter(Boolean).join(', ')
  return (
    <ButtonBase
      component="article"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={name}
      data-testid="hub-league-card"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        minHeight: 44,
        p: 2,
        textAlign: 'left',
        border: 1,
        borderColor: HUB.line,
        bgcolor: creamAlpha(0.07),
        borderRadius: '4px',
        color: HUB.cream,
        fontFamily: 'inherit',
        '&:hover': { bgcolor: alpha(HUB.gold, 0.12), borderColor: HUB.gold },
        '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
      }}
    >
      <LeagueLogo logoUrl={league.logoUrl} size={48} />
      <Box sx={{ minWidth: 0, display: 'grid', gap: 0.25 }}>
        <Typography component="h3" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 24, lineHeight: 1.1, letterSpacing: '0.04em', textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
          {league.name}
        </Typography>
        <Typography sx={{ fontSize: 15, color: HUB.muted }}>{facts.join(' · ')}</Typography>
        {teams && <Typography sx={{ fontSize: 16, color: HUB.gold, overflowWrap: 'anywhere' }}>{teams}</Typography>}
      </Box>
    </ButtonBase>
  )
}
