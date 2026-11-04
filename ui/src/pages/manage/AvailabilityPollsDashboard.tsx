import { useEffect, useMemo, useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ListViewToggle } from '../../components/ListViewToggle'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AddCard } from '../../components/AddCard'
import { BrandIcon } from '../../components/BrandIcon'
import { EmptyState, EmptyStateLink } from '../../components/EmptyState'
import { SortMenu } from '../../components/ContentControlsLine'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined'
import { ToolbarCard, ToolbarMultiToggle, ToolbarSortButton, ToolbarToggle } from '../../components/ToolbarCard'
import { listClosedPolls, listOpenPolls } from '../../api/matchAvailabilityApi'
import type { OpenAvailabilityPoll } from '../../api/matchAvailabilityApi'
import { listRounds } from '../../api/sectionAvailabilityApi'
import type { SectionAvailabilityRound } from '../../api/sectionAvailabilityApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { PollCard } from './availability/PollCard'
import { PollTable } from './availability/PollTable'
import { PollRowMenu } from './availability/PollRowMenu'
import { AddPollChooserDialog } from './availability/AddPollChooserDialog'
import { useListViewPreference } from '../../hooks/useListViewPreference'
import { AvailabilityFilterBar } from './availability/AvailabilityFilterBar'
import { useAvailabilityHub } from './availability/hubContext'
import { dynamicCardGridSx } from '../../utils/cardGrid'
import { squadPollTitle } from './availability/pollHelpers'
import { groupPollRow, squadPollRow } from './availability/pollPanelRows'
import { invalidateAvailabilityCounters } from '../../api/availabilitySummaryApi'

// One entry of the merged list - sortDate is the soonest match the poll covers (a squad poll's
// own match, a group poll's firstMatchDate).
type PollListItem =
  | { kind: 'SQUAD'; key: string; sortDate: number; poll: OpenAvailabilityPoll; open: boolean }
  | { kind: 'GROUP'; key: string; sortDate: number; round: SectionAvailabilityRound }

// docs/specs/064-unified-availability-polls.md: the one place every open poll lives. Extends
// docs/specs/034-availability-polls-dashboard.md's squad-poll list (and absorbs 063's group-poll
// list from the removed /manage/section-availability screen) into the standard record-list
// pattern (the header and New poll action live in AvailabilityHubLayout, 073): a RecordCard grid mixing both kinds.
// The polls and rounds are those of the hub's season (the default season, no control), sent as seasonId.
// docs/specs/083: the toolbar is the shared FilterBar (League, Section and Team from the hub's shared filters, plus search).
// The poll type is two light toggles (Group polls, Squad polls - both on by default, the last one cannot be
// switched off), the sort order a quiet text link, and 'Show closed polls' a switch (mirroring MatchList's
// 'Show past matches') that also fetches closed polls; they sit on the line above the cards (in the Filters
// sheet on a phone). The type toggles and Show closed live in the hub context, because the layout's counters
// follow them; they are per-visit, never persisted (Show closed is only preset by a ?showClosed=true link,
// the 'covered by' links). The two open-poll queries are merged client-side - open polls are bounded to what
// is live right now, as 034 already reasoned (spec's Non-goals: no union endpoint). Section is the hub's
// shared, persisted filter (replacing 043's per-view key). Search is a non-persisted useState and is
// deliberately not sent to the counters (083 lists only the shared filters, type and Show closed as counter inputs).
export default function AvailabilityPollsDashboard() {
  const {
    clubId, filters, seasonId, seasonsLoading, teams: teamOptions, validTeamId: teamId, teamsLoading, teamsError,
    showGroup, setShowGroup, showSquad, setShowSquad, showClosed, setShowClosed, setPollRows,
  } = useAvailabilityHub()
  const { sectionId, leagueId } = filters
  const scopeParams = { leagueId: leagueId ?? undefined, sectionId: sectionId ?? undefined, teamId: teamId ?? undefined, seasonId }
  // Held until the team list and the season resolved (and not at all if the teams failed), so the requests carry a
  // validated team and the hub's season, and never go out unscoped first.
  const ready = Boolean(clubId) && !teamsLoading && !teamsError && !seasonsLoading
  const [chooserOpen, setChooserOpen] = useState(false)
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  // docs/specs/042-match-list-filters-and-search.md's default-ascending convention - soonest
  // covered match first.
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')
  // docs/specs/090 (A): Cards | List, remembered for this page.
  const [view, setView] = useListViewPreference('pollList:view')

  const wantSquad = showSquad
  const wantGroup = showGroup

  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'availability-polls', 'open', { leagueId, sectionId, teamId, seasonId }],
    queryFn: () => listOpenPolls(clubId as string, scopeParams),
    enabled: ready && wantSquad,
  })

  const roundsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', 'open', { leagueId, sectionId, teamId, seasonId }],
    queryFn: () => listRounds(clubId as string, { ...scopeParams, open: true }),
    enabled: ready && wantGroup,
  })

  const closedPollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'availability-polls', 'closed', { leagueId, sectionId, teamId, seasonId }],
    queryFn: () => listClosedPolls(clubId as string, scopeParams),
    enabled: ready && wantSquad && showClosed,
  })

  const closedRoundsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', 'closed', { leagueId, sectionId, teamId, seasonId }],
    queryFn: () => listRounds(clubId as string, { ...scopeParams, open: false }),
    enabled: ready && wantGroup && showClosed,
  })

  const { data: teams } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teams ?? []).forEach((team) => map.set(team.id, team))
    return map
  }, [teams])

  const allItems = useMemo<PollListItem[]>(() => {
    const squadItems: PollListItem[] = wantSquad
      ? (pollsQuery.data ?? []).map((poll) => ({
          kind: 'SQUAD',
          key: `squad-${poll.pollId}`,
          sortDate: new Date(poll.matchDate).getTime(),
          poll,
          open: true,
        }))
      : []
    const closedSquadItems: PollListItem[] =
      wantSquad && showClosed
        ? (closedPollsQuery.data ?? []).map((poll) => ({
            kind: 'SQUAD',
            key: `squad-${poll.pollId}`,
            sortDate: new Date(poll.matchDate).getTime(),
            poll,
            open: false,
          }))
        : []
    const groupItems: PollListItem[] = wantGroup
      ? (roundsQuery.data ?? []).map((round) => ({
          kind: 'GROUP',
          key: `group-${round.id}`,
          sortDate: new Date(round.firstMatchDate).getTime(),
          round,
        }))
      : []
    const closedGroupItems: PollListItem[] =
      wantGroup && showClosed
        ? (closedRoundsQuery.data ?? []).map((round) => ({
            kind: 'GROUP',
            key: `group-${round.id}`,
            sortDate: new Date(round.firstMatchDate).getTime(),
            round,
          }))
        : []
    return [...squadItems, ...closedSquadItems, ...groupItems, ...closedGroupItems]
  }, [pollsQuery.data, roundsQuery.data, closedPollsQuery.data, closedRoundsQuery.data, wantSquad, wantGroup, showClosed])

  // Search matches team/opponent names (the squad card's own resolved title) and a group poll's
  // description and section name - client-side, as both sources are unpaginated.
  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = term
      ? allItems.filter((item) => {
          const haystack =
            item.kind === 'SQUAD'
              ? squadPollTitle(item.poll, teamsById)
              : `${item.round.description} ${item.round.sectionName}`
          return haystack.toLowerCase().includes(term)
        })
      : allItems
    const sorted = [...filtered].sort((a, b) => a.sortDate - b.sortDate)
    return sort === 'desc' ? sorted.reverse() : sorted
  }, [allItems, search, sort, teamsById])

  const invalidatePolls = () => {
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-polls'] })
    invalidateAvailabilityCounters(queryClient, clubId)
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-rounds'] })
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-fixture-groups'] })
    // A squad poll's open/close/delete also shows on its match's own Availability tab and squad.
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
  }

  const isLoading =
    teamsLoading ||
    seasonsLoading ||
    (wantSquad && (pollsQuery.isLoading || (showClosed && closedPollsQuery.isLoading))) ||
    (wantGroup && (roundsQuery.isLoading || (showClosed && closedRoundsQuery.isLoading)))
  const isError =
    teamsError ||
    (wantSquad && (pollsQuery.isError || (showClosed && closedPollsQuery.isError))) ||
    (wantGroup && (roundsQuery.isError || (showClosed && closedRoundsQuery.isError)))

  // docs/specs/085 (G): hand the polls this page shows (before its search) to the hub, for the polls panel behind the
  // Open polls / Close in 48 hours counters. Registered once everything is loaded; cleared when the page goes.
  const settled = !isLoading && !isError
  const rowFor = (item: PollListItem) => (item.kind === 'SQUAD' ? squadPollRow(item.poll, item.open, teamsById) : groupPollRow(item.round))
  const panelRows = useMemo(
    () => allItems.map((item) => (item.kind === 'SQUAD' ? squadPollRow(item.poll, item.open, teamsById) : groupPollRow(item.round))),
    [allItems, teamsById],
  )
  useEffect(() => {
    setPollRows(settled ? panelRows : null)
    return () => setPollRows(null)
  }, [settled, panelRows, setPollRows])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load availability polls"
        description="Something went wrong loading your club's open polls. Please try again."
      />
    )
  }

  const isSearching = search.trim().length > 0
  const typeLimited = !(showGroup && showSquad)
  const isFiltering = isSearching || typeLimited || sectionId !== null || leagueId !== null || teamId !== null

  const sortOptions = [
    { value: 'asc', label: 'Soonest First', linkLabel: 'Soonest First' },
    { value: 'desc', label: 'Latest First', linkLabel: 'Latest First' },
  ]
  const sortValue = sort
  const onSort = (value: string) => setSort(value === 'desc' ? 'desc' : 'asc')

  // docs/specs/136 and page-anatomy section 3: one flat toolbar, desktop order: the poll-type segmented toggle (the last type left on cannot be
  // switched off) and the Show Closed chip, then Sort, then Cards | List last. A phone: Filters and Search on the row, the rest in the sheet (toggle first).
  const chips = (placement: 'row' | 'sheet') =>
    placement === 'row' ? (
      <>
        <ToolbarMultiToggle
          ariaLabel="Poll types"
          options={[
            { value: 'group', label: 'Group Polls', icon: <ViewListOutlinedIcon sx={{ fontSize: 16 }} /> },
            { value: 'squad', label: 'Squad Polls', icon: <GroupsOutlinedIcon sx={{ fontSize: 16 }} /> },
          ]}
          selected={[...(showGroup ? ['group'] : []), ...(showSquad ? ['squad'] : [])]}
          onChange={(next) => {
            setShowGroup(next.includes('group'))
            setShowSquad(next.includes('squad'))
          }}
        />
        <ToolbarToggle placement="row" checked={showClosed} onChange={setShowClosed} label="Show Closed Polls" />
      </>
    ) : (
      <>
        <ToolbarToggle placement="sheet" checked={showGroup} disabled={showGroup && !showSquad} onChange={setShowGroup} label="Group Polls" />
        <ToolbarToggle placement="sheet" checked={showSquad} disabled={showSquad && !showGroup} onChange={setShowSquad} label="Squad Polls" />
        <ToolbarToggle placement="sheet" checked={showClosed} onChange={setShowClosed} label="Show Closed Polls" />
      </>
    )

  const bar = (
    <AvailabilityFilterBar
      bare
      inCard
      viewControlsInline
      show={{ league: true, section: true, team: true }}
      teams={teamOptions}
      teamId={teamId}
      teamAllLabel={sectionId ? 'All Teams In Section' : 'All Teams'}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search by team, opponent or description"
      secondaryControls={chips}
      viewControls={
        phone ? (
          <>
            <Box sx={{ width: '100%' }}>
              <ListViewToggle value={view} onChange={setView} fullWidth />
            </Box>
            <SortMenu value={sortValue} options={sortOptions} onChange={onSort} />
          </>
        ) : (
          <>
            <ToolbarSortButton value={sortValue} onChange={onSort} options={sortOptions} />
            <ListViewToggle value={view} onChange={setView} variant="toolbar" />
          </>
        )
      }
      onClearedAll={() => {
        setShowGroup(true)
        setShowSquad(true)
      }}
    />
  )

  // Empty states (docs/specs/136, page-anatomy section 5): the section's BrandIcon and, where nothing exists yet, a quick-action Add Poll.
  const addPollAction = <EmptyStateLink onClick={() => setChooserOpen(true)}>Create New Poll</EmptyStateLink>
  const icon = <BrandIcon name="nav/availability-polls" size={48} />
  const emptyState =
    visibleItems.length > 0 ? null : isFiltering ? (
      <EmptyState
        icon={icon}
        title="No matching polls"
        description={
          isSearching
            ? `No ${showClosed ? 'polls' : 'open polls'} match "${search.trim()}". Try a different search.`
            : `No ${showClosed ? 'polls' : 'open polls'} match the current filters. Try a different type, section, league or team.`
        }
      />
    ) : showClosed ? (
      <EmptyState icon={icon} title="No polls" description="No polls match this scope yet." action={addPollAction} />
    ) : (
      <EmptyState
        icon={icon}
        title="No open polls"
        description="Nothing is collecting answers right now. Ask a team or a section about their matches, or turn on Show Closed Polls to review earlier ones."
        action={addPollAction}
      />
    )

  // List view: the bar is fused into the table's card in every state. Cards view: a standalone toolbar card.
  const fused = view === 'list'
  const itemByKey = new Map(visibleItems.map((item) => [item.key, item]))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
      {!fused && <ToolbarCard>{bar}</ToolbarCard>}

      {view === 'list' && (
        <PollTable
          rows={visibleItems.map(rowFor)}
          toolbar={bar}
          empty={emptyState}
          renderActions={(row) => {
            const item = itemByKey.get(row.key)
            if (!item) return null
            return (
              <PollRowMenu
                clubId={clubId}
                item={item.kind === 'SQUAD' ? { kind: 'SQUAD', poll: item.poll } : { kind: 'GROUP', round: item.round }}
                open={item.kind === 'SQUAD' ? item.open : undefined}
                teamsById={teamsById}
                onChanged={invalidatePolls}
              />
            )
          }}
        />
      )}

      {view === 'cards' && emptyState}

      <AddPollChooserDialog open={chooserOpen} onClose={() => setChooserOpen(false)} sectionId={sectionId} />

      {view === 'cards' && (
        <Box sx={dynamicCardGridSx}>
          {visibleItems.map((item) =>
            item.kind === 'SQUAD' ? (
              <PollCard key={item.key} clubId={clubId} item={{ kind: 'SQUAD', poll: item.poll }} open={item.open} teamsById={teamsById} onChanged={invalidatePolls} />
            ) : (
              <PollCard key={item.key} clubId={clubId} item={{ kind: 'GROUP', round: item.round }} teamsById={teamsById} onChanged={invalidatePolls} />
            ),
          )}
          {/* The grid ends with a dashed Add card (same route as Add Poll); with no cards it is not shown (the empty message carries the quick-action button). */}
          {visibleItems.length > 0 && <AddCard label="Create New Poll" onClick={() => setChooserOpen(true)} testId="add-poll-card" />}
        </Box>
      )}
    </Box>
  )
}
