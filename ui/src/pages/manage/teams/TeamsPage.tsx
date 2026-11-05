import { useMemo, useState } from 'react'
import { Box, Link, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { SortMenu } from '../../../components/ContentControlsLine'
import { AddCard } from '../../../components/AddCard'
import { BrandIcon } from '../../../components/BrandIcon'
import { EmptyState, EmptyStateLink } from '../../../components/EmptyState'
import { ToolbarCard, ToolbarSortButton, ToolbarToggleChip } from '../../../components/ToolbarCard'
import { TeamActionsMenu } from '../../../components/TeamActionsMenu'
import { FilterBar } from '../../../components/FilterBar'
import { HeaderSeasonSelect } from '../../../components/HeaderSeasonSelect'
import { ListViewToggle } from '../../../components/ListViewToggle'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { PageCounters } from '../../../components/PageCounters'
import type { PageCounterItem } from '../../../components/PageCounters'
import { TeamCard } from '../../../components/TeamCard'
import { TeamTable } from '../../../components/TeamTable'
import type { TeamTableRow } from '../../../components/TeamTable'
import { listTeamsForClub, listTeamsForSection } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listSections } from '../../../api/sectionApi'
import type { Section } from '../../../api/sectionApi'
import { listSeasons } from '../../../api/seasonApi'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { useTeamCardData } from '../../../hooks/useTeamCardData'
import { dynamicCardGridSx } from '../../../utils/cardGrid'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { pickDefaultSeasonId } from '../../../utils/defaultSeason'
import { breadcrumbFor } from '../../../utils/sectionBreadcrumb'
import { matchesTeamFocus, teamCounters } from '../../../utils/teamCounters'
import type { TeamFocus } from '../../../utils/teamCounters'

export type TeamsScope = { kind: 'club' } | { kind: 'section'; sectionId: string }

export interface TeamsPageProps {
  clubId?: string
  scope: TeamsScope
}

const FOCUS_LABELS: Record<TeamFocus, string> = {
  active: 'Active Teams',
  'no-captain': 'No Captain',
  empty: 'Empty Squads',
}

const NOT_ON_FILE = '–'

// docs/specs/092-teams-gold-standard.md (A): the one body of the Teams page, shared by TeamList (one section, from Club
// Structure) and TeamDirectory (the whole club). A Season pill beside the title (the squads, Players and Matches describe
// that season), five counters computed client-side from the data the cards already load (Active teams, Players in squads,
// Matches this week; No captain and Empty squads as amber quick filters), the shared FilterBar (Section on the club-wide
// list, and name search) and content line (sort, Show inactive, Cards | List). The season, the club-wide Section and the
// view are remembered; the quick filter, search and Show inactive are per visit. Deliberately no pagination - a club's
// teams are a small, bounded list (docs/specs/026-teams.md), fetched whole and filtered client-side.
export function TeamsPage({ clubId, scope }: TeamsPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const sectionScopeId = scope.kind === 'section' ? scope.sectionId : undefined
  const [search, setSearch] = useState('')
  // docs/specs/142: the sort, the quick filter and Show Inactive live in the address, so Back from a team restores them
  // (the season and the club-wide Section are saved per club below).
  const [params, setParams] = useSearchParams()
  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const sortAsc = params.get('sort') !== 'desc'
  const setSort = (next: string) => setParam('sort', next === 'desc' ? 'desc' : null)
  const focusParam = params.get('focus')
  const focus = (Object.keys(FOCUS_LABELS) as TeamFocus[]).find((key) => key === focusParam) ?? null
  const setFocus = (next: TeamFocus | null) => setParam('focus', next)
  const showInactive = params.get('inactive') === '1'
  const setShowInactive = (next: boolean) => setParam('inactive', next ? '1' : null)
  const phone = useMediaQuery(useTheme().breakpoints.down('sm'), { noSsr: true })
  const [view, setView] = useListViewPreference('teamList:view')
  // docs/specs/035: the club-wide Section filter is a backend parameter, saved per club (043); 092 saves the chosen
  // season with it. The section-scoped list is fixed to its section and ignores the saved Section.
  const [{ sectionId: savedSectionId, seasonId: savedSeasonId }, setFilters] = usePersistedListFilters(`teamList:filters:${clubId}`, {
    sectionId: null as string | null,
    seasonId: '',
  })
  const clubSectionId = scope.kind === 'club' ? savedSectionId : null

  const {
    data: teams,
    isLoading,
    isError,
  } = useQuery({
    queryKey: sectionScopeId
      ? ['managed-club', clubId, 'sections', sectionScopeId, 'teams']
      : ['managed-club', clubId, 'teams', clubSectionId],
    queryFn: () =>
      sectionScopeId
        ? listTeamsForSection(clubId as string, sectionScopeId)
        : listTeamsForClub(clubId as string, { sectionId: clubSectionId ?? undefined }),
    enabled: Boolean(clubId),
  })

  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
    enabled: Boolean(clubId),
  })

  const seasonsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'seasons'],
    queryFn: () => listSeasons(clubId as string),
    enabled: Boolean(clubId),
  })
  const seasons = useMemo(() => seasonsQuery.data ?? [], [seasonsQuery.data])
  // The chosen season when it is still one of the club's, else the one containing today (or the latest).
  const seasonId = useMemo(
    () => (seasons.some((season) => season.id === savedSeasonId) ? savedSeasonId : (pickDefaultSeasonId(seasons) ?? '')),
    [seasons, savedSeasonId],
  )

  const allTeams = useMemo(() => teams ?? [], [teams])
  const cardData = useTeamCardData(clubId, allTeams, seasonId || undefined)

  const sectionsById = useMemo(() => {
    const map = new Map<string, Section>()
    ;(sections ?? []).forEach((section) => map.set(section.id, section))
    return map
  }, [sections])
  const scopeSection = sectionScopeId ? sectionsById.get(sectionScopeId) : undefined
  const breadcrumb = scopeSection ? breadcrumbFor(scopeSection, sectionsById) : []
  const sectionNameFor = (id: string) => sectionsById.get(id)?.name ?? 'Unknown section'

  // The counters describe the shown teams: after the Section filter and Show inactive, before search and the quick filter.
  const shownTeams = useMemo(() => (showInactive ? allTeams : allTeams.filter((team) => team.active)), [allTeams, showInactive])
  const counters = useMemo(() => teamCounters(shownTeams, cardData), [shownTeams, cardData])

  const visibleTeams = useMemo(() => {
    const term = search.trim().toLowerCase()
    const byFocus = focus ? shownTeams.filter((team) => matchesTeamFocus(team, cardData[team.id], focus)) : shownTeams
    const filtered = term ? byFocus.filter((team) => team.name.toLowerCase().includes(term)) : byFocus
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    return sortAsc ? sorted : sorted.reverse()
  }, [shownTeams, cardData, search, focus, sortAsc])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !teams) {
    return (
      <EmptyState
        title="Couldn't load teams"
        description={scope.kind === 'section' ? "Something went wrong loading this section's teams. Please try again." : "Something went wrong loading your club's teams. Please try again."}
      />
    )
  }

  const hasTeams = teams.length > 0
  const isSearching = search.trim().length > 0
  const toggleFocus = (next: TeamFocus) => setFocus(focus === next ? null : next)

  // docs/specs/057: the ?from=section marker tells the team page / form to route Back to this section-scoped list rather
  // than the club-wide directory (the default). 092: the chosen season travels to the team page. 142: every link out carries
  // returnTo with the label "Teams", so Back restores this view (docs/specs/127).
  const origin = currentOrigin(location)
  const teamPath = (sectionId: string, teamId: string) => `/manage/sections/${sectionId}/teams/${teamId}`
  const viewPath = (sectionId: string, teamId: string) => {
    const params = new URLSearchParams()
    if (scope.kind === 'section') params.set('from', 'section')
    if (seasonId) params.set('seasonId', seasonId)
    const query = params.toString()
    return `${teamPath(sectionId, teamId)}${query ? `?${query}` : ''}`
  }
  const viewTo = (sectionId: string, teamId: string) => withReturnTo(viewPath(sectionId, teamId), origin, 'Teams')
  const editPath = (sectionId: string, teamId: string) => `${teamPath(sectionId, teamId)}/edit${scope.kind === 'section' ? '?from=section' : ''}`
  // docs/specs/116: the chosen season travels to the team statistics page (empty = All seasons).
  const statsPath = (teamId: string) => `/manage/teams/${teamId}/stats?seasonId=${encodeURIComponent(seasonId)}`
  const statsTo = (teamId: string) => withReturnTo(statsPath(teamId), origin, 'Teams')
  const menuFor = (team: Team) => (
    <TeamActionsMenu
      teamName={team.name}
      openTo={viewPath(team.sectionId, team.id)}
      editTo={editPath(team.sectionId, team.id)}
      statsTo={statsPath(team.id)}
    />
  )

  const figure = (value: number) => (counters.loaded ? value : NOT_ON_FILE)
  const attention = (id: TeamFocus, value: number): PageCounterItem => ({
    id,
    value: figure(value),
    label: FOCUS_LABELS[id],
    shortLabel: id === 'empty' ? 'Empty' : undefined,
    tone: counters.loaded && value > 0 ? 'warning' : 'default',
    kind: 'filter',
    active: focus === id,
    hint: 'Tap to filter',
    onSelect: counters.loaded || focus === id ? () => toggleFocus(id) : undefined,
  })
  const counterItems: PageCounterItem[] = [
    {
      id: 'active',
      value: counters.active,
      label: FOCUS_LABELS.active,
      shortLabel: 'Active',
      kind: 'filter',
      active: focus === 'active',
      hint: 'Tap to filter',
      onSelect: () => toggleFocus('active'),
    },
    { id: 'players', value: figure(counters.players), label: 'Players In Squads', shortLabel: 'Players' },
    { id: 'this-week', value: figure(counters.matchesThisWeek), label: 'Matches This Week', shortLabel: 'This Week' },
    attention('no-captain', counters.noCaptain),
    attention('empty', counters.emptySquads),
  ]

  const emptyDescription = (() => {
    if (isSearching) return `No teams match "${search.trim()}". Try a different search.`
    if (focus) return `No teams match ${FOCUS_LABELS[focus].toLowerCase()}.`
    return 'Every team here is inactive. Turn on Show Inactive to see them.'
  })()
  const sortOptions = [
    { value: 'asc', label: 'Name, A to Z' },
    { value: 'desc', label: 'Name, Z to A' },
  ]
  const sortValue = sortAsc ? 'asc' : 'desc'

  // docs/specs/142 and page-anatomy section 3: one flat toolbar, desktop order: Section (club list), search, Show Inactive, Sort, then Cards | List
  // last. A phone: Filters and search on the row; the toggle, the quick filter, the switch and Sort in the sheet.
  const bar = (
    <FilterBar
      bare
      inCard
      viewControlsInline
      density="compact"
      {...(scope.kind === 'club'
        ? { sections: sections ?? [], sectionId: clubSectionId, onSectionChange: (next: string | null) => setFilters({ sectionId: next }) }
        : {})}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by name"
      extraChips={focus ? [{ key: 'focus', label: FOCUS_LABELS[focus], onRemove: () => setFocus(null) }] : []}
      secondaryControls={(placement) =>
        placement === 'row' ? (
          <ToolbarToggleChip pressed={showInactive} onChange={setShowInactive} label="Show Inactive" />
        ) : (
          <CompactSwitch checked={showInactive} onChange={setShowInactive} label="Show Inactive" />
        )
      }
      viewControls={
        phone ? (
          <>
            <Box sx={{ width: '100%' }}>
              <ListViewToggle value={view} onChange={setView} fullWidth />
            </Box>
            {focus && (
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 36 }}>
                <Typography variant="body2" color="text.secondary">
                  Quick filter: <b>{FOCUS_LABELS[focus]}</b>
                </Typography>
                <Link component="button" type="button" underline="hover" onClick={() => setFocus(null)} sx={{ fontWeight: 700, fontSize: '0.875rem' }}>
                  Clear
                </Link>
              </Box>
            )}
            <SortMenu value={sortValue} options={sortOptions.map((option) => ({ ...option, linkLabel: option.label }))} onChange={setSort} />
          </>
        ) : (
          <>
            <ToolbarSortButton value={sortValue} onChange={setSort} options={sortOptions} />
            <ListViewToggle value={view} onChange={setView} variant="toolbar" />
          </>
        )
      }
      onClearAll={() => {
        if (scope.kind === 'club') setFilters({ sectionId: null })
        setFocus(null)
      }}
    />
  )

  const addTo = sectionScopeId ? `/manage/sections/${sectionScopeId}/teams/new` : '/manage/teams/new'
  const openCreate = () => navigate(withReturnTo(addTo, origin, 'Teams'))
  const icon = <BrandIcon name="nav/teams" size={48} padding={4} />
  const emptyState =
    visibleTeams.length > 0 ? null : !hasTeams ? (
      <EmptyState
        icon={icon}
        title="No teams yet"
        description={scope.kind === 'section' ? "Add this section's first team to get started." : "Add your club's first team to get started."}
        action={<EmptyStateLink onClick={openCreate}>Add New Team</EmptyStateLink>}
      />
    ) : (
      <EmptyState icon={icon} title="No matching teams" description={emptyDescription} />
    )
  // List view: the bar is fused into the table's card in every state. Cards view: a standalone toolbar card.
  const fused = view === 'list'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      <ManageScreenHeader
        title="Teams"
        backTo={scope.kind === 'section' ? '/manage/sections' : undefined}
        backLabel={scope.kind === 'section' ? 'Back to Club Structure' : undefined}
        // docs/specs/092: the season the squads, Players and Matches describe; there is no "All seasons" here.
        titleAdornment={
          seasons.length > 0 ? (
            <HeaderSeasonSelect
              seasons={seasons.map((season) => ({ id: season.id, name: season.label }))}
              value={seasonId || null}
              onChange={(next) => setFilters({ seasonId: next ?? '' })}
              showAll={false}
            />
          ) : undefined
        }
        // The section scope is a plain sub-header path, not part of the title (docs/specs/142).
        subtitle={scopeSection ? [...breadcrumb, scopeSection.name].join(' › ') : undefined}
        // ONE filled button on the title row (page-anatomy section 1); the owner's wording is Add New ... (2026-11-05).
        action={<Button size="compact" onClick={openCreate}>Add New Team</Button>}
      />

      <PageCounters density="compact" items={counterItems} />

      {!fused && <ToolbarCard>{bar}</ToolbarCard>}

      {fused && (
        <TeamTable
          toolbar={bar}
          empty={emptyState}
          rows={visibleTeams.map(
            (team): TeamTableRow => ({
              team,
              sectionName: sectionNameFor(team.sectionId),
              playerCount: cardData[team.id]?.playerCount ?? 0,
              matchCount: cardData[team.id]?.matchCount ?? 0,
              captainName: cardData[team.id]?.captainName ?? null,
              loaded: cardData[team.id]?.loaded ?? false,
              to: viewTo(team.sectionId, team.id),
              statsTo: statsTo(team.id),
              actions: menuFor(team),
            }),
          )}
        />
      )}

      {!fused && emptyState}

      {!fused && visibleTeams.length > 0 && (
        <Box sx={dynamicCardGridSx}>
          {visibleTeams.map((team) => {
            const data = cardData[team.id]
            return (
              <TeamCard
                key={team.id}
                team={team}
                sectionName={sectionNameFor(team.sectionId)}
                captainName={data?.captainName}
                managerName={data?.managerName}
                coachName={data?.coachName}
                playerCount={data?.playerCount ?? 0}
                matchCount={data?.matchCount ?? 0}
                sponsors={data?.sponsors ?? []}
                viewTo={viewTo(team.sectionId, team.id)}
                statsTo={statsTo(team.id)}
                menu={menuFor(team)}
              />
            )
          })}
          {/* The grid ends with a dashed Add card (same action as the title-row button); with no cards it is not shown. */}
          <AddCard label="Add New Team" onClick={openCreate} testId="add-team-card" />
        </Box>
      )}
    </Box>
  )
}
