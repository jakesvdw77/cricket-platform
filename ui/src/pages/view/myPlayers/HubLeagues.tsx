import { Alert, Box, MenuItem, Select, Skeleton, Typography } from '@mui/material'
import { Button } from '../../../components/Button'
import { BrandIcon } from '../../../components/BrandIcon'
import { useMyPlayerLeagues } from '../../../api/myPlayersApi'
import { creamAlpha } from '../../../brandTokens'
import { HUB, darkFieldSx, darkMenuProps, hubPageHeading } from './hubStyle'
import { HubLeagueCard } from './HubLeagueCard'

// docs/specs/123 (Leagues list): the leagues the selected player's teams play in, a season switcher (the current season by
// default) and one card per league. Read only. The footer owns Back.
export interface HubLeaguesProps {
  playerKey?: string
  // The season from the URL; undefined means the club's current season.
  seasonId?: string
  onSeasonChange: (seasonId: string) => void
  onOpen: (leagueId: string, seasonId: string) => void
}

export function HubLeagues({ playerKey, seasonId, onSeasonChange, onOpen }: HubLeaguesProps) {
  const leagues = useMyPlayerLeagues(playerKey, seasonId)
  const data = leagues.data
  const shownSeason = data?.seasonId ?? seasonId ?? ''
  const seasonName = data?.seasons.find((season) => season.id === shownSeason)?.name

  let body
  if (leagues.isLoading) {
    body = (
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {[0, 1, 2].map((n) => <Skeleton key={n} variant="rounded" height={96} sx={{ bgcolor: creamAlpha(0.12) }} />)}
      </Box>
    )
  } else if (leagues.isError) {
    body = (
      <Alert severity="error" action={<Button variant="secondary" size="compact" onClick={() => leagues.refetch()}>Retry</Button>}>
        We could not load the leagues. Please try again.
      </Alert>
    )
  } else if ((data?.leagues ?? []).length === 0) {
    body = (
      <Box data-testid="hub-leagues-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/cricket-leagues" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>No league available</Typography>
      </Box>
    )
  } else {
    body = (
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        {data?.leagues.map((league) => <HubLeagueCard key={league.id} league={league} seasonName={seasonName} onOpen={() => onOpen(league.id, shownSeason)} />)}
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Typography component="h2" sx={hubPageHeading}>
        Leagues
      </Typography>
      {data && data.seasons.length > 0 && (
        <Box sx={{ ...darkFieldSx, maxWidth: { sm: 320 } }}>
        <Select
          size="small"
          value={shownSeason}
          onChange={(event) => onSeasonChange(event.target.value)}
          inputProps={{ 'aria-label': 'Season' }}
          MenuProps={darkMenuProps}
          fullWidth
          sx={{ minHeight: 44, '& .MuiSelect-select': { minHeight: 44, display: 'flex', alignItems: 'center', boxSizing: 'border-box' } }}
        >
          {data.seasons.map((season) => (
            <MenuItem key={season.id} value={season.id} sx={{ minHeight: 44 }}>
              {season.name}
              {season.current ? ' (current)' : ''}
            </MenuItem>
          ))}
        </Select>
        </Box>
      )}
      {body}
    </Box>
  )
}
