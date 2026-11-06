import { useMemo } from 'react'
import { Alert, Box, ButtonBase, Link, MenuItem, Select, Skeleton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { BrandIcon } from '../../../components/BrandIcon'
import { useMyPlayer } from '../../../api/myPlayersApi'
import { useMyPlayerResults, useMyPlayerResultsFilters, useMyPlayerResultsSummaries, useMyPlayerResultsSummary } from '../../../api/meResultsApi'
import type { MyResultCompetition, MyResultScope, MyResultSummary } from '../../../api/meResultsApi'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { BRAND, blackAlpha, creamAlpha } from '../../../brandTokens'
import { HUB, darkFieldSx, darkMenuProps, hubOutlineButton, hubPageHeading } from './hubStyle'
import { HubResultCard } from './HubResultCard'
import { bigSx, cardSx, kickerSx } from './resultCardStyle'
import { chipFigure, formSentence, opponentCode, resultTone, scopeLabel, scopeQuery, streakLetter, versusText } from './resultsFormat'

// docs/specs/145 decision 11 (round 5 of the mockups): the Season dropdown in the header, two rows of equal-size filter chips (Leagues,
// then the Teams that played in the chosen league), a Recent Form card, the latest result as a banner and a responsive grid of wide
// result cards. No carousel. Read only; the footer owns Back. The scope lives in the URL (season, league, team, competition), saved
// per player on this device as the fallback; the server pages the rows (Show More), the browser never slices them.
const ALL = 'all'
const FRIENDLY: MyResultCompetition = 'FRIENDLY'

type ScopeName = 'season' | 'team' | 'league' | 'competition'
type SavedScope = Record<ScopeName, string>

function Skeletons() {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }} aria-busy="true" data-testid="hub-results-loading">
      <Skeleton variant="rounded" height={110} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '20px' }} />
      <Skeleton variant="rounded" height={190} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '20px' }} />
      <Skeleton variant="rounded" height={190} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '20px' }} />
    </Box>
  )
}

const chipColours = (tone: ReturnType<typeof resultTone>) =>
  tone === 'win' ? { bgcolor: BRAND.gold, color: BRAND.ink } : tone === 'loss' ? { bgcolor: '#7b3a3a', color: BRAND.cream } : tone === 'tie' ? { bgcolor: BRAND.sand, color: BRAND.ink } : { bgcolor: creamAlpha(0.22), color: BRAND.cream }

interface ChipSpec {
  id: string
  name: string
  selected: boolean
  summary?: MyResultSummary
  onPick: () => void
}

// One row of equal-size chips behind a label column (the label sits above the chips on a phone). Both rows share the column width, so
// they start at the same left edge.
function ChipRow({ label, chips }: { label: string; chips: ChipSpec[] }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '92px minmax(0, 1fr)' }, gap: { xs: 0.75, sm: '8px 10px' }, alignItems: 'center' }}>
      <Typography component="span" sx={{ fontFamily: HUB.display, letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 13, color: HUB.sand }}>{label}</Typography>
      <Box role="group" aria-label={label} sx={{ display: 'grid', gap: 1, minWidth: 0, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(176px, 1fr))' } }}>
        {chips.map((chip) => (
          <ButtonBase
            key={chip.id}
            aria-pressed={chip.selected}
            onClick={chip.onPick}
            sx={{
              height: 54,
              px: 1.75,
              minWidth: 0,
              borderRadius: '16px',
              border: `1px solid ${chip.selected ? HUB.gold : HUB.lineSoft}`,
              bgcolor: chip.selected ? alpha(HUB.gold, 0.18) : blackAlpha(0.25),
              color: chip.selected ? BRAND.goldLight : HUB.cream,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: '1px',
              textAlign: 'left',
              fontSize: 15,
              '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 },
            }}
          >
            <Box component="span" sx={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chip.name}</Box>
            <Box component="small" sx={{ color: HUB.muted, fontSize: 12, whiteSpace: 'nowrap', minHeight: 15 }}>
              {chip.summary ? `${chip.summary.matches} played · ${chip.summary.won} won` : ' '}
            </Box>
          </ButtonBase>
        ))}
      </Box>
    </Box>
  )
}

function RecentForm({ rows }: { rows: MyResultSummary['lastFive'] }) {
  const streak = [...rows].reverse()
  return (
    <Box component="section" aria-label="Recent Form" data-testid="hub-results-form" sx={{ ...cardSx('neutral'), p: 2, borderRadius: '20px', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ ...kickerSx, fontSize: 14 }}>Recent Form</Typography>
          <Typography data-testid="form-sentence" sx={{ fontSize: 15, mt: 0.75 }}>{formSentence(rows)}</Typography>
        </Box>
        <Box data-testid="form-streak" sx={{ display: 'flex', gap: 1, ml: { sm: 'auto' } }}>
          {streak.map((row) => (
            <Box key={row.matchId} sx={{ textAlign: 'center', width: 50 }}>
              <Box aria-label={`${row.result.toLowerCase().replace('_', ' ')} ${versusText(row)}`} role="img" sx={{ ...chipColours(resultTone(row.result)), width: 46, height: 46, mx: 'auto', borderRadius: '14px', display: 'grid', placeItems: 'center', fontFamily: HUB.display, fontSize: 21, fontWeight: 700 }}>
                {streakLetter(row.result)}
              </Box>
              <Typography sx={{ fontSize: 12, color: HUB.muted, mt: 0.375 }}>{chipFigure(row)}</Typography>
              <Typography sx={{ fontSize: 11, color: HUB.muted, letterSpacing: '0.04em' }}>{opponentCode(row)}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

export function HubResults({ playerKey }: { playerKey: string }) {
  const [search, setSearch] = useSearchParams()
  const [saved, save] = usePersistedListFilters<SavedScope>(`hubResults:filters:${playerKey}`, { season: '', team: '', league: '', competition: '' })
  const player = useMyPlayer(playerKey).data
  const filtersQuery = useMyPlayerResultsFilters(playerKey)
  const filters = filtersQuery.data

  // URL wins, then the saved value, then the defaults (the current season, all leagues, all teams). A value the player has no data
  // for (a stale saved team, a league with no results that season) is dropped.
  const pick = (name: ScopeName, valid: (value: string) => boolean): string => {
    const value = search.get(name) ?? saved[name]
    return value && valid(value) ? value : ''
  }
  const seasonValue = filters
    ? (() => {
        const chosen = pick('season', (value) => value === ALL || filters.seasons.some((season) => season.id === value))
        return chosen || filters.currentSeasonId || ALL
      })()
    : ''
  const seasonId = seasonValue && seasonValue !== ALL ? seasonValue : null

  // The cascade: the combinations of the chosen season give the league chips; those of the chosen league give the team chips.
  const seasonCombos = useMemo(() => (filters?.combos ?? []).filter((combo) => !seasonId || combo.seasonId === seasonId), [filters, seasonId])
  const leagueOptions = useMemo(() => (filters?.leagues ?? []).filter((league) => seasonCombos.some((combo) => combo.leagueId === league.id)), [filters, seasonCombos])
  const hasFriendly = seasonCombos.some((combo) => combo.leagueId === null)
  const leagueId = filters ? pick('league', (value) => leagueOptions.some((league) => league.id === value)) : ''
  const friendly = !leagueId && hasFriendly && (search.get('competition') ?? saved.competition) === FRIENDLY
  const leagueCombos = seasonCombos.filter((combo) => (leagueId ? combo.leagueId === leagueId : friendly ? combo.leagueId === null : true))
  const teamOptions = useMemo(() => (filters?.teams ?? []).filter((team) => leagueCombos.some((combo) => combo.teamId === team.id)), [filters, leagueCombos])
  const teamId = filters ? pick('team', (value) => teamOptions.some((team) => team.id === value)) : ''

  const competition = friendly ? FRIENDLY : null
  const scope: MyResultScope = { seasonId, leagueId: leagueId || null, teamId: teamId || null, competition }

  const current: SavedScope = { season: seasonValue, team: teamId, league: leagueId, competition: friendly ? FRIENDLY : '' }
  const change = (next: Partial<SavedScope>) => {
    const merged = { ...current, ...next }
    save(merged)
    const params = new URLSearchParams(search)
    for (const name of ['season', 'league', 'team', 'competition'] as const) {
      if (merged[name]) params.set(name, merged[name])
      else params.delete(name)
    }
    setSearch(params, { replace: true })
  }
  const clearFilters = () => change({ season: '', team: '', league: '', competition: '' })
  // Choosing a league resets a team that did not play in it.
  const pickLeague = (league: string, comp: string) => {
    const combos = seasonCombos.filter((combo) => (league ? combo.leagueId === league : comp === FRIENDLY ? combo.leagueId === null : true))
    change({ league, competition: comp, team: combos.some((combo) => combo.teamId === teamId) ? teamId : '' })
  }

  const ready = Boolean(filters)
  const list = useMyPlayerResults(playerKey, scope, ready)
  const summaryQuery = useMyPlayerResultsSummary(playerKey, scope, ready)
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.rows) ?? [], [list.data])
  const summary = summaryQuery.data

  // The record under each chip: one summary per chip (a handful at most); a chip shows its name alone until its record arrives.
  const leagueChipScopes: MyResultScope[] = [
    { seasonId },
    ...leagueOptions.map((league) => ({ seasonId, leagueId: league.id })),
    ...(hasFriendly ? [{ seasonId, competition: FRIENDLY }] : []),
  ]
  const teamChipScopes: MyResultScope[] = [{ seasonId, leagueId: leagueId || null, competition }, ...teamOptions.map((team) => ({ seasonId, leagueId: leagueId || null, competition, teamId: team.id }))]
  const chipSummaries = useMyPlayerResultsSummaries(playerKey, [...leagueChipScopes, ...teamChipScopes], ready)
  const chipSummary = (index: number) => chipSummaries[index]?.data

  const leagueChips: ChipSpec[] = [
    { id: 'all-leagues', name: 'All Leagues', selected: !leagueId && !friendly, summary: chipSummary(0), onPick: () => pickLeague('', '') },
    ...leagueOptions.map((league, index) => ({ id: league.id, name: league.name, selected: leagueId === league.id, summary: chipSummary(1 + index), onPick: () => pickLeague(league.id, '') })),
    ...(hasFriendly ? [{ id: FRIENDLY, name: 'Friendly', selected: friendly, summary: chipSummary(1 + leagueOptions.length), onPick: () => pickLeague('', FRIENDLY) }] : []),
  ]
  const teamBase = leagueChipScopes.length
  const teamChips: ChipSpec[] = [
    { id: 'all-teams', name: 'All Teams', selected: !teamId, summary: chipSummary(teamBase), onPick: () => change({ team: '' }) },
    ...teamOptions.map((team, index) => ({ id: team.id, name: team.name, selected: teamId === team.id, summary: chipSummary(teamBase + 1 + index), onPick: () => change({ team: team.id }) })),
  ]

  const seasonName = seasonId ? filters?.seasons.find((season) => season.id === seasonId)?.name : undefined
  const teamName = filters?.teams.find((team) => team.id === teamId)?.name
  const leagueName = friendly ? 'Friendly' : leagueOptions.find((league) => league.id === leagueId)?.name
  const scopeText = scopeLabel({ season: seasonName, team: teamName, league: leagueName }, Boolean(teamId))
  const query = scopeQuery(scope)
  const playerName = player?.firstName ?? 'This Player'
  const narrowed = Boolean(teamId || leagueId || friendly || (seasonId && seasonId !== filters?.currentSeasonId))

  const header = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, minHeight: 44 }}>
      <Typography component="h2" sx={hubPageHeading}>Results</Typography>
      {filters && filters.seasons.length > 0 && (
        <Box sx={{ ...darkFieldSx, minWidth: 140 }}>
          <Select
            size="small"
            value={seasonValue}
            onChange={(event) => change({ season: event.target.value, league: '', team: '', competition: '' })}
            inputProps={{ 'aria-label': 'Season' }}
            MenuProps={darkMenuProps}
            fullWidth
            sx={{ minHeight: 44, '& .MuiSelect-select': { minHeight: 44, display: 'flex', alignItems: 'center', boxSizing: 'border-box', fontFamily: HUB.display, fontSize: 18, letterSpacing: '0.06em' } }}
          >
            {filters.seasons.map((season) => (
              <MenuItem key={season.id} value={season.id} sx={{ minHeight: 44 }}>{season.name}</MenuItem>
            ))}
            <MenuItem value={ALL} sx={{ minHeight: 44 }}>All Seasons</MenuItem>
          </Select>
        </Box>
      )}
    </Box>
  )

  const chipRows = filters && (leagueOptions.length > 0 || hasFriendly) && (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <ChipRow label="Leagues" chips={leagueChips} />
      {teamOptions.length > 0 && <ChipRow label="Teams" chips={teamChips} />}
    </Box>
  )

  const failed = filtersQuery.isError || list.isError || summaryQuery.isError
  let body
  if (failed) {
    body = (
      <Alert
        severity="error"
        action={
          <Button
            variant="secondary"
            size="compact"
            onClick={() => {
              void filtersQuery.refetch()
              void list.refetch()
              void summaryQuery.refetch()
            }}
          >
            Retry
          </Button>
        }
      >
        We could not load the results. Please try again.
      </Alert>
    )
  } else if (!filters || list.isLoading || summaryQuery.isLoading || !summary) {
    body = <Skeletons />
  } else if (rows.length === 0 && narrowed) {
    body = (
      <Box data-testid="hub-results-filtered-empty" sx={{ ...cardSx('neutral'), alignItems: 'center', textAlign: 'center', py: 4, gap: 1.5 }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ ...bigSx, fontSize: 40 }}>No matches for this filter</Typography>
        <Typography sx={{ fontSize: 16, maxWidth: 320, color: HUB.muted }}>{scopeText} has no results shared with the Player Hub.</Typography>
        <Link component="button" type="button" underline="always" onClick={clearFilters} sx={{ color: HUB.gold, fontSize: 16, minHeight: 44 }}>
          Clear Filters
        </Link>
      </Box>
    )
  } else if (rows.length === 0) {
    body = (
      <Box data-testid="hub-results-empty" sx={{ display: 'grid', justifyItems: 'center', gap: 1.5, py: 4, color: HUB.muted, textAlign: 'center' }}>
        <BrandIcon name="nav/match-results" size={64} onDark />
        <Typography sx={{ fontSize: 18 }}>No results yet</Typography>
        <Typography sx={{ fontSize: 15 }}>Finished matches will appear here once the club shares them.</Typography>
      </Box>
    )
  } else {
    body = (
      <Box sx={{ display: 'grid', gap: 1.75, minWidth: 0, opacity: list.isPlaceholderData ? 0.55 : 1 }}>
        {summary.lastFive.length > 0 && <RecentForm rows={summary.lastFive} />}
        <HubResultCard latest playerKey={playerKey} playerName={playerName} row={rows[0]} scopeQuery={query} />
        {rows.length > 1 && (
          <Box data-testid="hub-results-grid" sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fit, minmax(310px, 1fr))' } }}>
            {rows.slice(1).map((row) => (
              <HubResultCard key={row.matchId} playerKey={playerKey} playerName={playerName} row={row} scopeQuery={query} />
            ))}
          </Box>
        )}
        {list.hasNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="secondary" size="compact" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} sx={{ ...hubOutlineButton, alignSelf: 'center' }}>
              {list.isFetchingNextPage ? 'Loading...' : 'Show More'}
            </Button>
          </Box>
        )}
      </Box>
    )
  }

  return (
    <Box data-testid="hub-results" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.75 }}>
      {header}
      {!failed && chipRows}
      {body}
    </Box>
  )
}
