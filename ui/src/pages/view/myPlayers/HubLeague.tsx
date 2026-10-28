import { Alert, Box, Chip, Skeleton, Typography } from '@mui/material'
import { Button } from '../../../components/Button'
import { useMyPlayerLeague } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HUB, HUB_GROUND } from './hubStyle'
import { LeagueLogo } from './HubLeagueCard'
import { HubLeagueResults, HubLeagueSchedule } from './HubLeagueGames'
import { HubLeagueShare } from './HubLeagueShare'
import { HubLeagueConditions, HubLeagueDetails, HubLeagueFields, HubLeagueSocialLinks, HubLeagueTabBar, HubLeagueTeams, panelId, tabId, tagSx } from './HubLeagueTabs'
import type { LeagueTab } from './leagueFormat'

// docs/specs/123 (League page): one read-only league for the selected player. The tabs share ONE query. Share makes the standard poster in one tap.
// The website and social icons sit top right of the header. No Back here (the footer owns it), no Edit, no link into a fixture.
export interface HubLeagueProps {
  playerKey: string
  leagueId: string
  seasonId?: string
  clubId: string
  clubName: string | null
  tab: LeagueTab
  onTab: (tab: LeagueTab) => void
}

export function HubLeague({ playerKey, leagueId, seasonId, clubName, tab, onTab }: HubLeagueProps) {
  const query = useMyPlayerLeague(playerKey, leagueId, seasonId)
  const dto = query.data

  if (query.isError) {
    return (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => query.refetch()}>Retry</Button>}>
        We could not load this league. Please try again.
      </Alert>
    )
  }
  if (!dto) {
    return (
      <Box sx={{ display: 'grid', gap: 1.5 }} aria-busy="true">
        <Skeleton variant="rounded" height={72} sx={{ bgcolor: creamAlpha(0.12) }} />
        <Skeleton variant="rounded" height={44} sx={{ bgcolor: creamAlpha(0.12) }} />
        <Skeleton variant="rounded" height={160} sx={{ bgcolor: creamAlpha(0.12) }} />
      </Box>
    )
  }

  const myTeams = dto.teams.filter((team) => team.mine)
  return (
    <Box data-testid="hub-league" sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <LeagueLogo logoUrl={dto.league.logoUrl} size={48} />
        <Box sx={{ minWidth: 0, flex: '1 1 160px', display: 'grid', gap: 0.5 }}>
          <Typography component="h2" sx={{ fontFamily: HUB.display, fontWeight: 600, fontSize: 26, lineHeight: 1.1, letterSpacing: '0.06em', textTransform: 'uppercase', color: HUB.sand, overflowWrap: 'anywhere' }}>
            {dto.league.name}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            <Chip size="small" variant="outlined" label={dto.season.name} sx={{ ...tagSx, bgcolor: 'transparent', color: HUB.cream, borderColor: HUB.line }} />
            {myTeams.map((team) => <Chip key={team.id} size="small" label={team.name} sx={tagSx} />)}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto', flexShrink: 0 }}>
          <HubLeagueSocialLinks league={dto.league} />
          <HubLeagueShare dto={dto} clubName={clubName} />
        </Box>
      </Box>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: HUB_GROUND, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 } }}>
        <HubLeagueTabBar value={tab} onChange={onTab} />
      </Box>
      <Box role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} tabIndex={0} sx={{ outline: 'none', '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}>
        {tab === 'details' && <HubLeagueDetails dto={dto} />}
        {tab === 'conditions' && <HubLeagueConditions dto={dto} />}
        {tab === 'teams' && <HubLeagueTeams dto={dto} />}
        {tab === 'schedule' && <HubLeagueSchedule dto={dto} />}
        {tab === 'results' && <HubLeagueResults dto={dto} />}
        {tab === 'fields' && <HubLeagueFields dto={dto} />}
      </Box>
    </Box>
  )
}
