import { useMemo, useState } from 'react'
import { Box, Link, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { CompactSwitch } from '../../../components/CompactSwitch'
import { ContentControlsLine, SortLink } from '../../../components/ContentControlsLine'
import { EmptyState } from '../../../components/EmptyState'
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
import { listSections } from '../../../api/sectionApi'
import type { Section } from '../../../api/sectionApi'
import { listSeasons } from '../../../api/seasonApi'
import { useListViewPreference } from '../../../hooks/useListViewPreference'
import { usePersistedListFilters } from '../../../hooks/usePersistedListFilters'
import { useTeamCardData } from '../../../hooks/useTeamCardData'
import { cardGridSx } from '../../../utils/cardGrid'
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
  active: 'Active teams',
  'no-captain': 'No captain',
  empty: 'Empty squads',
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
  const sectionScopeId = scope.kind === 'section' ? scope.sectionId : undefined
  const [search, setSearch] = useState('')
  const [sortAsc, setSortAsc] = useState(true)
  const [focus, setFocus] = useState<TeamFocus | null>(null)
  const [showInactive, setShowInactive] = useState(false)
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
  const toggleFocus = (next: TeamFocus) => setFocus((current) => (current === next ? null : next))

  // docs/specs/057: the ?from=section marker tells the team page / form to route Back to this section-scoped list rather
  // than the club-wide directory (the default). 092: the chosen season travels to the team page.
  const viewTo = (sectionId: string, teamId: string) => {
    const params = new URLSearchParams()
    if (scope.kind === 'section') params.set('from', 'section')
    if (seasonId) params.set('seasonId', seasonId)
    const query = params.toString()
    return `/manage/sections/${sectionId}/teams/${teamId}${query ? `?${query}` : ''}`
  }
  const editTo = (sectionId: string, teamId: string) =>
    `/manage/sections/${sectionId}/teams/${teamId}/edit${scope.kind === 'section' ? '?from=section' : ''}`

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
    { id: 'players', value: figure(counters.players), label: 'Players in squads', shortLabel: 'Players' },
    { id: 'this-week', value: figure(counters.matchesThisWeek), label: 'Matches this week', shortLabel: 'This week' },
    attention('no-captain', counters.noCaptain),
    attention('empty', counters.emptySquads),
  ]

  const inactiveToggle = <CompactSwitch checked={showInactive} onChange={setShowInactive} label="Show inactive" />
  const sortLink = <SortLink label={sortAsc ? 'Name, A to Z' : 'Name, Z to A'} onToggle={() => setSortAsc((current) => !current)} />

  const emptyTitle = focus || isSearching || hasTeams ? 'No matching teams' : 'No teams yet'
  const emptyDescription = (() => {
    if (!hasTeams) {
      return scope.kind === 'section' ? "Add this section's first team to get started." : "Add your club's first team to get started."
    }
    if (isSearching) {
      return `No teams match "${search.trim()}". Try a different search.`
    }
    if (focus) {
      return `No teams match ${FOCUS_LABELS[focus].toLowerCase()}.`
    }
    return 'Every team here is inactive. Turn on Show inactive to see them.'
  })()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader
        title={scope.kind === 'section' ? (scopeSection ? `Teams — ${[...breadcrumb, scopeSection.name].join(' › ')}` : 'Teams') : 'Teams'}
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
        action={<Button onClick={() => navigate(sectionScopeId ? `/manage/sections/${sectionScopeId}/teams/new` : '/manage/teams/new')}>Add Team</Button>}
      />

      <PageCounters density="compact" items={counterItems} />

      <FilterBar
        density="compact"
        {...(scope.kind === 'club'
          ? { sections: sections ?? [], sectionId: clubSectionId, onSectionChange: (next: string | null) => setFilters({ sectionId: next }) }
          : {})}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name"
        extraChips={focus ? [{ key: 'focus', label: FOCUS_LABELS[focus], onRemove: () => setFocus(null) }] : []}
        viewControls={
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
            {inactiveToggle}
            {sortLink}
          </>
        }
        onClearAll={() => {
          if (scope.kind === 'club') setFilters({ sectionId: null })
          setFocus(null)
        }}
      />

      <ContentControlsLine
        scope={`Showing ${visibleTeams.length} ${visibleTeams.length === 1 ? 'team' : 'teams'}${focus ? ` · ${FOCUS_LABELS[focus]}` : ''}`}
        sortAction={sortLink}
        controls={
          <>
            <ListViewToggle value={view} onChange={setView} />
            {inactiveToggle}
          </>
        }
      />

      {visibleTeams.length > 0 && view === 'list' && (
        <TeamTable
          rows={visibleTeams.map(
            (team): TeamTableRow => ({
              team,
              sectionName: sectionNameFor(team.sectionId),
              playerCount: cardData[team.id]?.playerCount ?? 0,
              matchCount: cardData[team.id]?.matchCount ?? 0,
              captainName: cardData[team.id]?.captainName ?? null,
              loaded: cardData[team.id]?.loaded ?? false,
              to: viewTo(team.sectionId, team.id),
            }),
          )}
        />
      )}

      {visibleTeams.length > 0 && view === 'cards' && (
        <Box sx={cardGridSx}>
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
                editTo={editTo(team.sectionId, team.id)}
              />
            )
          })}
        </Box>
      )}

      {visibleTeams.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}
    </Box>
  )
}
