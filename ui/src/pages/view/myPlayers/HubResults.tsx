import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, ButtonBase, IconButton, Link, MenuItem, Select, Skeleton, Typography, useMediaQuery, useTheme } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { BottomSheet } from '../../../components/BottomSheet'
import { BrandIcon } from '../../../components/BrandIcon'
import { useMyPlayer } from '../../../api/myPlayersApi'
import { useMyPlayerResults, useMyPlayerResultsFilters, useMyPlayerResultsSummaries, useMyPlayerResultsSummary } from '../../../api/meResultsApi'
import type { MyResultCompetition, MyResultScope, MyResultSummary } from '../../../api/meResultsApi'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { BRAND, blackAlpha, creamAlpha } from '../../../brandTokens'
import { HubPageHeader } from './HubPageHeader'
import { HUB, darkFieldSx, darkMenuProps, hubHeading, hubOutlineButton } from './hubStyle'
import { HubResultCard } from './HubResultCard'
import { bigSx, cardSx, kickerSx } from './resultCardStyle'
import { chipFigure, formSentence, opponentCode, resultTone, scopeLabel, scopeQuery, streakLetter, versusText } from './resultsFormat'

// docs/specs/145 decisions 11 and 14 (rounds 5 and 6 of the mockups): the Season dropdown and a Filters button in the header (the
// equal-size Leagues and Teams chips live in a docked side panel from lg and a dark bottom sheet below it, choices apply as you tap;
// chosen filters show as removable tags; a player with nothing to choose gets a quiet line instead), a Recent Form card, the latest result as a banner and a responsive grid of wide
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

// One group of equal-size chips behind a heading. The panel shows one column, the phone sheet two.
function ChipGroup({ label, chips, columns }: { label: string; chips: ChipSpec[]; columns: 1 | 2 }) {
  return (
    <Box component="section" aria-label={label} sx={{ display: 'grid', gap: 1 }}>
      <Typography component="h3" sx={{ fontFamily: HUB.display, letterSpacing: '0.14em', textTransform: 'uppercase', fontSize: 13, color: HUB.sand, m: 0 }}>{label}</Typography>
      <Box role="group" aria-label={label} sx={{ display: 'grid', gap: 1, minWidth: 0, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
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

// A chosen filter as a removable tag (the round button is 28 px; the tag row is 36 px high).
function FilterTag({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Box
      data-testid="hub-results-tag"
      sx={{ flexShrink: 0, minHeight: 36, pl: 1.75, pr: 0.5, borderRadius: '18px', border: `1px solid ${HUB.gold}`, bgcolor: alpha(HUB.gold, 0.16), color: BRAND.goldLight, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 1, maxWidth: '100%' }}
    >
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Box>
      <IconButton
        aria-label={`Remove ${name}`}
        onClick={onRemove}
        sx={{ width: 28, height: 28, p: 0, bgcolor: blackAlpha(0.3), color: HUB.cream, '&:hover': { bgcolor: blackAlpha(0.45) }, '&.Mui-focusVisible': { outline: `2px solid ${HUB.cream}`, outlineOffset: 2 }, '&::after': { content: '""', position: 'absolute', inset: -8 } }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
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

  const wide = useMediaQuery(useTheme().breakpoints.up('lg'))
  const [open, setOpen] = useState(false)
  const filtersButton = useRef<HTMLButtonElement>(null)
  const panelHeading = useRef<HTMLHeadingElement>(null)
  const ready = Boolean(filters)
  const list = useMyPlayerResults(playerKey, scope, ready)
  const summaryQuery = useMyPlayerResultsSummary(playerKey, scope, ready)
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.rows) ?? [], [list.data])
  const summary = summaryQuery.data

  // The record under each chip: one summary per chip (a handful at most), asked for only while the panel or sheet is open; a chip shows
  // its name alone until its record arrives.
  const leagueChipScopes: MyResultScope[] = [
    { seasonId },
    ...leagueOptions.map((league) => ({ seasonId, leagueId: league.id })),
    ...(hasFriendly ? [{ seasonId, competition: FRIENDLY }] : []),
  ]
  const teamChipScopes: MyResultScope[] = [{ seasonId, leagueId: leagueId || null, competition }, ...teamOptions.map((team) => ({ seasonId, leagueId: leagueId || null, competition, teamId: team.id }))]
  const chipSummaries = useMyPlayerResultsSummaries(playerKey, [...leagueChipScopes, ...teamChipScopes], ready && open)
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

  const leagueCount = leagueOptions.length + (hasFriendly ? 1 : 0)
  const hasChoice = leagueCount > 1 || teamOptions.length > 1
  const activeCount = (leagueId || friendly ? 1 : 0) + (teamId ? 1 : 0)
  const closePanel = () => {
    setOpen(false)
    filtersButton.current?.focus()
  }
  // From lg the panel is not modal, so focus moves to its heading by hand.
  useEffect(() => {
    if (open && wide) panelHeading.current?.focus()
  }, [open, wide])

  const activeTags = (leagueId || friendly || teamId) && (
    <Box data-testid="hub-results-tags" sx={{ display: 'flex', flexWrap: 'nowrap', gap: 1, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
      {(leagueId || friendly) && <FilterTag name={leagueName ?? 'League'} onRemove={() => change({ league: '', competition: '' })} />}
      {teamId && <FilterTag name={teamName ?? 'Team'} onRemove={() => change({ team: '' })} />}
    </Box>
  )

  const quietLine = filters && !hasChoice && leagueCount === 1 && (
    <Typography noWrap data-testid="hub-results-context" sx={{ fontFamily: HUB.display, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 14, color: HUB.sand }}>
      {[leagueOptions[0]?.name ?? 'Friendly', teamOptions[0]?.name].filter(Boolean).join(' · ')}
    </Typography>
  )

  const failed = filtersQuery.isError || list.isError || summaryQuery.isError
  const header = (
    <HubPageHeader
      title="Results"
      context={failed ? undefined : (activeTags || quietLine || undefined)}
      actions={
        <>
        {filters && filters.seasons.length > 0 && (
          <Box sx={{ ...darkFieldSx, minWidth: { xs: 112, sm: 140 } }}>
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
        {filters && hasChoice && (
          <Button
            ref={filtersButton}
            variant="secondary"
            size="compact"
            aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
            aria-haspopup={wide ? undefined : 'dialog'}
            aria-expanded={wide ? open : undefined}
            aria-controls={wide ? 'hub-results-filters-panel' : undefined}
            onClick={() => (open && wide ? closePanel() : setOpen(true))}
            sx={{ ...hubOutlineButton, alignSelf: 'center', minHeight: { xs: 44, md: 32 }, gap: 1, '&::after': { display: 'none' } }}
          >
            {activeCount > 0 && <Box aria-hidden component="span" data-testid="hub-results-filters-dot" sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: HUB.gold }} />}
            Filters
          </Button>
        )}
        </>
      }
    />
  )

  const chipGroups = (columns: 1 | 2) => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <ChipGroup label="Leagues" chips={leagueChips} columns={columns} />
      {teamOptions.length > 0 && <ChipGroup label="Teams" chips={teamChips} columns={columns} />}
    </Box>
  )
  const resetLink = (
    <Link component="button" type="button" underline="always" onClick={clearFilters} sx={{ color: HUB.gold, fontSize: 15, minHeight: 44 }}>
      Reset
    </Link>
  )
  const matchCount = summary?.matches
  const showLabel = matchCount === undefined ? 'Show Results' : `Show ${matchCount} ${matchCount === 1 ? 'match' : 'matches'}`
  const panelOpen = open && wide && hasChoice

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
    <Box data-testid="hub-results" sx={{ display: 'grid', gridTemplateColumns: panelOpen ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)', gap: panelOpen ? 2.5 : 0, alignItems: 'start' }}>
      <Box sx={{ display: 'grid', gap: 1.75, minWidth: 0 }}>
        {header}
        {body}
      </Box>
      {panelOpen && (
        <Box
          component="aside"
          id="hub-results-filters-panel"
          role="complementary"
          aria-label="Filters"
          data-testid="hub-results-panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closePanel()
          }}
          sx={{ position: 'sticky', top: 0, maxHeight: 'calc(100vh - 120px)', overflow: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, borderLeft: `1px solid ${HUB.line}`, bgcolor: blackAlpha(0.2), p: 2, display: 'grid', gap: 2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography ref={panelHeading} component="h2" tabIndex={-1} sx={{ ...hubHeading, outline: 'none' }}>Filters</Typography>
            {resetLink}
          </Box>
          {chipGroups(1)}
          <Button variant="secondary" size="compact" onClick={closePanel} sx={{ ...hubOutlineButton, alignSelf: 'stretch', minHeight: { xs: 44, md: 32 } }}>
            Done
          </Button>
        </Box>
      )}
      <BottomSheet open={open && !wide && hasChoice} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} ariaLabel="Filters" title="Filters" closeLabel="Close Filters" tone="dark">
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>{resetLink}</Box>
          {chipGroups(2)}
          <Button variant="secondary" size="compact" onClick={() => setOpen(false)} sx={{ ...hubOutlineButton, alignSelf: 'stretch', minHeight: 44 }}>
            {showLabel}
          </Button>
        </Box>
      </BottomSheet>
    </Box>
  )
}
