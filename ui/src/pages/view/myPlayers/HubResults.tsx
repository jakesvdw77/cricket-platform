import { useMemo, useRef, useState } from 'react'
import { Alert, Box, ButtonBase, Link, MenuItem, Select, Skeleton, Tab, Tabs, Typography } from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { BottomSheet } from '../../../components/BottomSheet'
import { BrandIcon } from '../../../components/BrandIcon'
import { useMyPlayer } from '../../../api/myPlayersApi'
import { useMyPlayerResults, useMyPlayerResultsFilters, useMyPlayerResultsSummary } from '../../../api/meResultsApi'
import type { MyResultScope, MyResultSummary } from '../../../api/meResultsApi'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { BRAND, blackAlpha, creamAlpha } from '../../../brandTokens'
import { HUB, darkFieldSx, darkMenuProps, hubGoldButton, hubPageHeading } from './hubStyle'
import { CardFoot, HubMilestoneCard, HubResultCard } from './HubResultCard'
import { bigSx, cardSx, kickerSx } from './resultCardStyle'
import { HubResultCarousel } from './HubResultCarousel'
import { HubSectionNav } from './HubSectionNav'
import type { CarouselItem } from './HubResultCarousel'
import { chipFigure, findMilestone, opponentCode, resultDate, resultTone, scopeLabel, scopeQuery, streakLetter, versusText } from './resultsFormat'

// docs/specs/145 (the Results main item, round 4 of the mockups): a Season dropdown always, Team tabs only for a player with more than
// one team, a League filter sheet beside the tabs, then the hero (the season at a glance and the last-five streak), the carousel and
// the All Cards list. Read only; the footer owns Back. The scope lives in the URL (season, team, league), saved per player on this
// device as the fallback; the server pages the rows, the browser never slices them.
const ALL = 'all'

type ScopeName = 'season' | 'team' | 'league'
type SavedScope = Record<ScopeName, string>

function Skeletons() {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }} aria-busy="true" data-testid="hub-results-loading">
      <Skeleton variant="rounded" height={260} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '22px' }} />
      <Skeleton variant="rounded" height={420} sx={{ bgcolor: creamAlpha(0.12), borderRadius: '22px' }} />
    </Box>
  )
}

const chipColours = (tone: ReturnType<typeof resultTone>) =>
  tone === 'win' ? { bgcolor: BRAND.gold, color: BRAND.ink } : tone === 'loss' ? { bgcolor: '#7b3a3a', color: BRAND.cream } : tone === 'tie' ? { bgcolor: BRAND.sand, color: BRAND.ink } : { bgcolor: creamAlpha(0.22), color: BRAND.cream }

function Hero({ summary, playerName, seasonName, scope, onSeeMatches }: { summary: MyResultSummary; playerName: string; seasonName: string; scope: string; onSeeMatches: () => void }) {
  const streak = [...summary.lastFive].reverse()
  const tiles: [number, string][] = [
    [summary.matches, 'Matches'],
    [summary.wickets, 'Wickets'],
    [summary.catches, 'Catches'],
  ]
  return (
    <Box component="section" aria-label="Season At A Glance" data-testid="hub-results-hero" data-hub-section="hero" data-hub-label="Season" sx={{ ...cardSx('neutral'), gap: 0, scrollMarginTop: 8 }}>
      <Typography sx={kickerSx}>{playerName} · {seasonName}</Typography>
      <Typography data-testid="hero-runs" sx={{ ...bigSx, fontSize: 118, mt: 1.5, background: `linear-gradient(180deg, ${BRAND.goldLight}, ${BRAND.gold})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', width: 'fit-content' }}>
        {summary.runs}
      </Typography>
      <Typography sx={{ fontSize: 17, lineHeight: 1.35, mt: 1.25 }}>
        <Box component="b" sx={{ color: HUB.gold, fontWeight: 600 }}>runs</Box> for {playerName}, and the team has won{' '}
        <Box component="b" sx={{ color: HUB.gold, fontWeight: 600 }}>{summary.won} of {summary.matches}</Box>.
      </Typography>
      {summary.matches < 4 && <Typography sx={{ color: HUB.muted, fontSize: 14, mt: 0.75 }}>Your story is just starting. More cards appear after each match.</Typography>}
      <Box sx={{ display: 'flex', gap: 1.25, mt: 2 }}>
        {tiles.map(([value, label]) => (
          <Box key={label} data-testid={`hero-tile-${label.toLowerCase()}`} sx={{ flex: 1, border: `1px solid ${HUB.lineSoft}`, borderRadius: '14px', p: '10px 10px 8px', bgcolor: blackAlpha(0.18) }}>
            <Typography component="b" sx={{ ...bigSx, fontSize: 34, display: 'block', lineHeight: 1 }}>{value}</Typography>
            <Typography component="small" sx={{ color: HUB.muted, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</Typography>
          </Box>
        ))}
      </Box>
      {streak.length > 0 && (
        <>
          <Typography sx={{ ...kickerSx, mt: 2.25 }}>Last {streak.length} · {playerName}&apos;s Figures</Typography>
          <Box data-testid="hero-streak" sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            {streak.map((row) => (
              <Box key={row.matchId} sx={{ textAlign: 'center', width: 48 }}>
                <Box aria-label={`${row.result.toLowerCase().replace('_', ' ')} ${versusText(row)}`} role="img" sx={{ ...chipColours(resultTone(row.result)), width: 48, height: 48, borderRadius: '15px', display: 'grid', placeItems: 'center', fontFamily: HUB.display, fontSize: 21, fontWeight: 700 }}>
                  {streakLetter(row.result)}
                </Box>
                <Typography sx={{ fontSize: 12, color: HUB.muted, mt: 0.5 }}>{chipFigure(row)}</Typography>
                <Typography sx={{ fontSize: 11, color: HUB.muted, letterSpacing: '0.04em' }}>{opponentCode(row)}</Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
      <CardFoot scope={scope} next={{ label: 'See Each Match ↓', onClick: onSeeMatches }} />
    </Box>
  )
}

export function HubResults({ playerKey }: { playerKey: string }) {
  const [search, setSearch] = useSearchParams()
  const [saved, save] = usePersistedListFilters<SavedScope>(`hubResults:filters:${playerKey}`, { season: '', team: '', league: '' })
  const player = useMyPlayer(playerKey).data
  const filtersQuery = useMyPlayerResultsFilters(playerKey)
  const filters = filtersQuery.data
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draftLeague, setDraftLeague] = useState('')
  const pageRef = useRef<HTMLDivElement>(null)

  const showTabs = (filters?.teams.length ?? 0) > 1
  const showFilter = showTabs || (filters?.leagues.length ?? 0) > 1

  // URL wins, then the saved value, then the defaults (the current season, all teams, all leagues). A value the player has no data
  // for (a stale saved team) is dropped.
  const pick = (name: ScopeName, valid: (value: string) => boolean): string => {
    const fromUrl = search.get(name)
    const value = fromUrl ?? saved[name]
    return value && valid(value) ? value : ''
  }
  const seasonValue = filters
    ? (() => {
        const chosen = pick('season', (value) => value === ALL || filters.seasons.some((season) => season.id === value))
        return chosen || filters.currentSeasonId || ALL
      })()
    : ''
  const teamId = filters && showTabs ? pick('team', (value) => filters.teams.some((team) => team.id === value)) : ''
  const leagueId = filters ? pick('league', (value) => filters.leagues.some((league) => league.id === value)) : ''
  const scope: MyResultScope = { seasonId: seasonValue && seasonValue !== ALL ? seasonValue : null, teamId: teamId || null, leagueId: leagueId || null }

  const change = (next: Partial<SavedScope>) => {
    const merged = { season: seasonValue, team: teamId, league: leagueId, ...next }
    save(merged)
    const params = new URLSearchParams(search)
    for (const name of ['season', 'team', 'league'] as const) {
      if (merged[name]) params.set(name, merged[name])
      else params.delete(name)
    }
    setSearch(params, { replace: true })
  }

  const ready = Boolean(filters)
  const list = useMyPlayerResults(playerKey, scope, ready)
  const summaryQuery = useMyPlayerResultsSummary(playerKey, scope, ready)
  const draftCount = useMyPlayerResultsSummary(playerKey, { ...scope, leagueId: draftLeague || null }, ready && sheetOpen)
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.rows) ?? [], [list.data])
  const summary = summaryQuery.data

  const seasonName = scope.seasonId ? filters?.seasons.find((season) => season.id === scope.seasonId)?.name : undefined
  const teamName = filters?.teams.find((team) => team.id === teamId)?.name
  const leagueName = filters?.leagues.find((league) => league.id === leagueId)?.name
  const scopeText = scopeLabel({ season: seasonName, team: teamName, league: leagueName }, showTabs)
  const query = scopeQuery(scope)
  const playerName = player?.firstName ?? 'This Player'

  const narrowed = Boolean(teamId || leagueId || (scope.seasonId && scope.seasonId !== filters?.currentSeasonId))
  const clearFilters = () => change({ season: '', team: '', league: '' })

  const header = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, minHeight: 44 }}>
      <Typography component="h2" sx={hubPageHeading}>Results</Typography>
      {filters && filters.seasons.length > 0 && (
        <Box sx={{ ...darkFieldSx, minWidth: 140 }}>
          <Select
            size="small"
            value={seasonValue}
            onChange={(event) => change({ season: event.target.value })}
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

  const tabs = filters && showFilter && (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${HUB.lineSoft}`, pb: 1 }}>
      {showTabs && (
        <Tabs
          value={teamId || ALL}
          onChange={(_, value: string) => change({ team: value === ALL ? '' : value })}
          aria-label="Team"
          variant="scrollable"
          scrollButtons={false}
          sx={{ minHeight: 40, flex: 1, '& .MuiTabs-indicator': { display: 'none' } }}
        >
          {[{ id: ALL, name: 'All' }, ...filters.teams].map((team) => (
            <Tab
              key={team.id}
              value={team.id}
              label={team.name}
              sx={{ minHeight: 40, minWidth: 0, px: 1.75, mr: 1, borderRadius: '20px', border: `1px solid ${HUB.lineSoft}`, fontFamily: HUB.display, fontSize: 16, letterSpacing: '0.06em', textTransform: 'none', color: HUB.cream, '&.Mui-selected': { bgcolor: HUB.gold, color: HUB.ink, borderColor: HUB.gold }, '&.Mui-focusVisible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
            />
          ))}
        </Tabs>
      )}
      <ButtonBase
        aria-label="Filter By League"
        onClick={() => {
          setDraftLeague(leagueId)
          setSheetOpen(true)
        }}
        sx={{ ml: 'auto', width: 44, height: 40, borderRadius: '12px', border: `1px solid ${HUB.lineSoft}`, bgcolor: blackAlpha(0.3), color: HUB.cream, position: 'relative', '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }}
      >
        <FilterListIcon />
        {leagueId && <Box data-testid="league-filter-dot" sx={{ position: 'absolute', top: 6, right: 7, width: 9, height: 9, borderRadius: '50%', bgcolor: HUB.gold }} />}
      </ButtonBase>
    </Box>
  )

  const optionSx = (on: boolean) =>
    ({ minHeight: 44, px: 1.75, borderRadius: '14px', border: `1px solid ${on ? HUB.gold : HUB.lineSoft}`, bgcolor: on ? creamAlpha(0.06) : blackAlpha(0.25), color: on ? BRAND.goldLight : HUB.cream, fontSize: 15, '&:focus-visible': { outline: `2px solid ${HUB.gold}`, outlineOffset: 2 } }) as const
  const draftMatches = draftCount.data?.matches
  const sheet = (
    <BottomSheet open={sheetOpen} onOpen={() => setSheetOpen(true)} onClose={() => setSheetOpen(false)} ariaLabel="Filter Results" title="Filter" closeLabel="Close Filter" tone="dark">
      <Typography component="h3" sx={{ ...kickerSx, fontSize: 14, mt: 1.5, mb: 1 }}>League</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {[{ id: '', name: 'All Leagues' }, ...(filters?.leagues ?? [])].map((league) => (
          <ButtonBase key={league.id || ALL} aria-pressed={draftLeague === league.id} onClick={() => setDraftLeague(league.id)} sx={optionSx(draftLeague === league.id)}>
            {league.name}
          </ButtonBase>
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
        <Button
          size="compact"
          onClick={() => {
            change({ league: draftLeague })
            setSheetOpen(false)
          }}
          sx={{ ...hubGoldButton, flex: 1 }}
        >
          {draftMatches === undefined ? 'Show Matches' : `Show ${draftMatches} ${draftMatches === 1 ? 'Match' : 'Matches'}`}
        </Button>
        <Link component="button" type="button" underline="always" onClick={() => setDraftLeague('')} sx={{ color: HUB.gold, fontSize: 14, minHeight: 44 }}>
          Reset
        </Link>
      </Box>
    </BottomSheet>
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
        <Typography sx={{ fontSize: 16, maxWidth: 260, color: HUB.muted }}>{scopeText} has no results shared with the Player Hub.</Typography>
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
    const milestone = findMilestone(rows)
    const items: CarouselItem[] = rows.flatMap((row): CarouselItem[] => {
      const main: CarouselItem = {
        key: row.matchId,
        label: versusText(row),
        hint: `${resultDate(row.matchDate)} · ${row.result === 'INTERNAL' ? 'Internal Match' : row.result.toLowerCase().replace('_', ' ')}`,
        render: (next) => <HubResultCard playerKey={playerKey} playerName={playerName} row={row} scope={scopeText} scopeQuery={query} next={next} />,
      }
      if (milestone && milestone.row.matchId === row.matchId) {
        return [
          main,
          {
            key: `milestone-${row.matchId}`,
            label: 'Milestone',
            hint: resultDate(row.matchDate),
            render: (next) => <HubMilestoneCard playerKey={playerKey} milestone={milestone} scope={scopeText} scopeQuery={query} next={next} />,
          },
        ]
      }
      return [main]
    })
    body = (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2, maxWidth: { md: 640, lg: 1100 }, width: '100%', minWidth: 0, opacity: list.isPlaceholderData ? 0.55 : 1 }}>
        <HubResultCarousel
          key={`${seasonValue}|${teamId}|${leagueId}`}
          hero={<Hero summary={summary} playerName={playerName} seasonName={seasonName ?? 'All Seasons'} scope={scopeText} onSeeMatches={() => pageRef.current?.querySelector<HTMLElement>('[data-hub-section="cards"]')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })} />}
          items={items}
          hasMore={Boolean(list.hasNextPage)}
          loadingMore={list.isFetchingNextPage}
          onLoadMore={() => void list.fetchNextPage()}
        />
      </Box>
    )
  }

  // The floating section arrows are the last child of a plain block wrapper that also holds the content (a sticky element is confined to its
  // containing block, so it cannot live inside the grid).
  return (
    <Box sx={{ position: 'relative' }}>
      <Box ref={pageRef} data-testid="hub-results" sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
        {header}
        {tabs}
        {body}
        {sheet}
      </Box>
      <HubSectionNav container={pageRef} />
    </Box>
  )
}
