import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Box, ButtonBase, IconButton, Link, MenuItem, Select, Typography, useMediaQuery, useTheme } from '@mui/material'
import { alpha } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { BottomSheet } from '../../../components/BottomSheet'
import { useMyPlayerResultsSummaries } from '../../../api/meResultsApi'
import type { MyResultCompetition, MyResultFilters, MyResultScope, MyResultSummary } from '../../../api/meResultsApi'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { BRAND, blackAlpha } from '../../../brandTokens'
import { HUB, darkFieldSx, darkMenuProps, hubHeading, hubOutlineButton } from './hubStyle'
import { scopeLabel, scopeQuery } from './resultsFormat'

// docs/specs/147 (Player Hub stats), extracted from HubResults (docs/specs/145 decisions 11 and 14) with no change in behaviour: the
// scope controls every Hub page with a Season and a League then Team choice shares. The Season dropdown and a Filters button go in the
// page header (`actions`), the chosen filters as removable tags or a quiet single-league line under the title (`context`), and the
// equal-size League and Team chips live in a docked side panel from lg (`HubScopePanel`) and a dark bottom sheet below it
// (`HubScopeSheet`). The scope lives in the URL (season, league, team, competition) with the per-player saved value as the fallback;
// a value the player has no data for is dropped. The page keeps its own requests and layout; it reads `scope` from here.
export const ALL_SEASONS = 'all'
const FRIENDLY: MyResultCompetition = 'FRIENDLY'

type ScopeName = 'season' | 'team' | 'league' | 'competition'
type SavedScope = Record<ScopeName, string>

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
function FilterTag({ name, onRemove, testId }: { name: string; onRemove: () => void; testId: string }) {
  return (
    <Box
      data-testid={testId}
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

export interface HubScopeOptions {
  playerKey: string
  // localStorage key of the saved scope, for example `hubResults:filters:<playerKey>`.
  storageKey: string
  // The shared `results/filters` read (Results, My stats and Team stats offer the same options); undefined while it loads.
  filters: MyResultFilters | undefined
  // Prefix of every test id and of the panel id (Results keeps 'hub-results').
  testIdPrefix?: string
  // False on a page whose options are not the player's own results (the Leaderboards reach): the chips then show names alone, because the
  // played and won record under a chip is the player's own results record.
  chipRecords?: boolean
}

export interface HubScope {
  // The chosen scope, ready to send; seasonId etc. are null for All.
  scope: MyResultScope
  seasonValue: string
  seasonId: string | null
  leagueId: string
  teamId: string
  friendly: boolean
  // True when anything other than the default (current season, all leagues, all teams) is chosen.
  narrowed: boolean
  // "Season · League · Team" text for an empty-state sentence or a card's scope label.
  scopeText: string
  // The scope as a query string, to carry onto a link that leaves the page.
  query: string
  hasChoice: boolean
  clearFilters: () => void
  // Set or clear just the league / the team (null clears); a league pick also drops a team that did not play in it.
  setLeague: (leagueId: string | null) => void
  setTeam: (teamId: string | null) => void
  // Header pieces: pass `actions` and `context` to HubPageHeader.
  actions: ReactNode
  context: ReactNode | undefined
  // Panel and sheet state, read by HubScopePanel, HubScopeSheet and the page's own grid.
  panelOpen: boolean
  testIdPrefix: string
  // Internal: the rest of what the panel and the sheet draw. Pages do not read these.
  internal: {
    open: boolean
    wide: boolean
    setOpen: (open: boolean) => void
    closePanel: () => void
    panelHeading: RefObject<HTMLHeadingElement | null>
    resetLink: ReactNode
    chipGroups: (columns: 1 | 2) => ReactNode
  }
}

export function useHubScope({ playerKey, storageKey, filters, testIdPrefix = 'hub-results', chipRecords = true }: HubScopeOptions): HubScope {
  const [search, setSearch] = useSearchParams()
  const [saved, save] = usePersistedListFilters<SavedScope>(storageKey, { season: '', team: '', league: '', competition: '' })

  // URL wins, then the saved value, then the defaults (the current season, all leagues, all teams). A value the player has no data
  // for (a stale saved team, a league with no results that season) is dropped.
  const pick = (name: ScopeName, valid: (value: string) => boolean): string => {
    const value = search.get(name) ?? saved[name]
    return value && valid(value) ? value : ''
  }
  const seasonValue = filters
    ? (() => {
        const chosen = pick('season', (value) => value === ALL_SEASONS || filters.seasons.some((season) => season.id === value))
        return chosen || filters.currentSeasonId || ALL_SEASONS
      })()
    : ''
  const seasonId = seasonValue && seasonValue !== ALL_SEASONS ? seasonValue : null

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

  // The record under each chip: one summary per chip (a handful at most), asked for only while the panel or sheet is open; a chip shows
  // its name alone until its record arrives.
  const leagueChipScopes: MyResultScope[] = [
    { seasonId },
    ...leagueOptions.map((league) => ({ seasonId, leagueId: league.id })),
    ...(hasFriendly ? [{ seasonId, competition: FRIENDLY }] : []),
  ]
  const teamChipScopes: MyResultScope[] = [{ seasonId, leagueId: leagueId || null, competition }, ...teamOptions.map((team) => ({ seasonId, leagueId: leagueId || null, competition, teamId: team.id }))]
  const chipSummaries = useMyPlayerResultsSummaries(playerKey, [...leagueChipScopes, ...teamChipScopes], ready && open && chipRecords)
  const chipSummary = (index: number) => (chipRecords ? chipSummaries[index]?.data : undefined)

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
    <Box data-testid={`${testIdPrefix}-tags`} sx={{ display: 'flex', flexWrap: 'nowrap', gap: 1, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
      {(leagueId || friendly) && <FilterTag testId={`${testIdPrefix}-tag`} name={leagueName ?? 'League'} onRemove={() => change({ league: '', competition: '' })} />}
      {teamId && <FilterTag testId={`${testIdPrefix}-tag`} name={teamName ?? 'Team'} onRemove={() => change({ team: '' })} />}
    </Box>
  )

  const quietLine = filters && !hasChoice && leagueCount === 1 && (
    <Typography noWrap data-testid={`${testIdPrefix}-context`} sx={{ fontFamily: HUB.display, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 14, color: HUB.sand }}>
      {[leagueOptions[0]?.name ?? 'Friendly', teamOptions[0]?.name].filter(Boolean).join(' · ')}
    </Typography>
  )

  const actions = (
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
            <MenuItem value={ALL_SEASONS} sx={{ minHeight: 44 }}>All Seasons</MenuItem>
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
          aria-controls={wide ? `${testIdPrefix}-filters-panel` : undefined}
          onClick={() => (open && wide ? closePanel() : setOpen(true))}
          sx={{ ...hubOutlineButton, alignSelf: 'center', minHeight: { xs: 44, md: 32 }, gap: 1, '&::after': { display: 'none' } }}
        >
          {activeCount > 0 && <Box aria-hidden component="span" data-testid={`${testIdPrefix}-filters-dot`} sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: HUB.gold }} />}
          Filters
        </Button>
      )}
    </>
  )

  const resetLink = (
    <Link component="button" type="button" underline="always" onClick={clearFilters} sx={{ color: HUB.gold, fontSize: 15, minHeight: 44 }}>
      Reset
    </Link>
  )
  const chipGroups = (columns: 1 | 2) => (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <ChipGroup label="Leagues" chips={leagueChips} columns={columns} />
      {teamOptions.length > 0 && <ChipGroup label="Teams" chips={teamChips} columns={columns} />}
    </Box>
  )

  return {
    scope,
    seasonValue,
    seasonId,
    leagueId,
    teamId,
    friendly,
    narrowed,
    scopeText,
    query,
    hasChoice,
    clearFilters,
    setLeague: (id) => pickLeague(id ?? '', ''),
    setTeam: (id) => change({ team: id ?? '' }),
    actions,
    context: activeTags || quietLine || undefined,
    panelOpen: open && wide && hasChoice,
    testIdPrefix,
    internal: { open, wide, setOpen, closePanel, panelHeading, resetLink, chipGroups },
  }
}

// The docked Filters panel (from lg). Render it beside the page body when `controls.panelOpen`.
export function HubScopePanel({ controls }: { controls: HubScope }) {
  const { internal, testIdPrefix } = controls
  if (!controls.panelOpen) return null
  return (
    <Box
      component="aside"
      id={`${testIdPrefix}-filters-panel`}
      role="complementary"
      aria-label="Filters"
      data-testid={`${testIdPrefix}-panel`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') internal.closePanel()
      }}
      sx={{ position: 'sticky', top: 0, maxHeight: 'calc(100vh - 120px)', overflow: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, borderLeft: `1px solid ${HUB.line}`, bgcolor: blackAlpha(0.2), p: 2, display: 'grid', gap: 2 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography ref={internal.panelHeading} component="h2" tabIndex={-1} sx={{ ...hubHeading, outline: 'none' }}>Filters</Typography>
        {internal.resetLink}
      </Box>
      {internal.chipGroups(1)}
      <Button variant="secondary" size="compact" onClick={internal.closePanel} sx={{ ...hubOutlineButton, alignSelf: 'stretch', minHeight: { xs: 44, md: 32 } }}>
        Done
      </Button>
    </Box>
  )
}

// The dark bottom sheet below lg. `matchCount` is the page's own count for the chosen scope ("Show 7 matches"); omitted it reads "Show Results".
export function HubScopeSheet({ controls, matchCount, noun = 'match', nounPlural = 'matches', fallbackLabel = 'Show Results' }: { controls: HubScope; matchCount?: number; noun?: string; nounPlural?: string; fallbackLabel?: string }) {
  const { internal } = controls
  const label = matchCount === undefined ? fallbackLabel : `Show ${matchCount} ${matchCount === 1 ? noun : nounPlural}`
  return (
    <BottomSheet open={internal.open && !internal.wide && controls.hasChoice} onOpen={() => internal.setOpen(true)} onClose={() => internal.setOpen(false)} ariaLabel="Filters" title="Filters" closeLabel="Close Filters" tone="dark">
      <Box sx={{ display: 'grid', gap: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>{internal.resetLink}</Box>
        {internal.chipGroups(2)}
        <Button variant="secondary" size="compact" onClick={() => internal.setOpen(false)} sx={{ ...hubOutlineButton, alignSelf: 'stretch', minHeight: 44 }}>
          {label}
        </Button>
      </Box>
    </BottomSheet>
  )
}
