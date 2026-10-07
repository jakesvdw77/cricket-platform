import { useMemo, useState } from 'react'
import { Box, FormControlLabel, MenuItem, Stack, Switch } from '@mui/material'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { listClosedPolls, listOpenPolls } from '../../api/matchAvailabilityApi'
import type { OpenAvailabilityPoll } from '../../api/matchAvailabilityApi'
import { listRounds } from '../../api/sectionAvailabilityApi'
import type { SectionAvailabilityRound } from '../../api/sectionAvailabilityApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'
import { PollCard } from './availability/PollCard'
import { pollCardGridSx } from '../../utils/cardGrid'
import { squadPollTitle } from './availability/pollHelpers'
import { invalidateAvailabilityCounters } from '../../api/availabilitySummaryApi'

type PollTypeFilter = 'ALL' | 'SQUAD' | 'GROUP'

// One entry of the merged list - sortDate is the soonest match the poll covers (a squad poll's
// own match, a group poll's firstMatchDate).
type PollListItem =
  | { kind: 'SQUAD'; key: string; sortDate: number; poll: OpenAvailabilityPoll; open: boolean }
  | { kind: 'GROUP'; key: string; sortDate: number; round: SectionAvailabilityRound }

// docs/specs/064-unified-availability-polls.md: the one place every open poll lives. Extends
// docs/specs/034-availability-polls-dashboard.md's squad-poll list (and absorbs 063's group-poll
// list from the removed /manage/section-availability screen) into the standard record-list
// pattern (the header and New poll action live in AvailabilityHubLayout, 073): ListToolbar (search, sort toggle, Type
// and Section filters) and a RecordCard grid mixing both kinds. The two open-poll queries are
// merged client-side - open polls are bounded to what is live right now, as 034 already reasoned
// (spec's Non-goals: no union endpoint). Type and Section persist via usePersistedListFilters
// (docs/specs/043); search stays its own non-persisted useState. The 'Show closed polls' switch
// (mirroring MatchList's 'Show past matches') also fetches closed polls into the same list; it is
// never persisted, only preset by a ?showClosed=true link (the 'covered by' links).
export default function AvailabilityPollsDashboard() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const [showClosed, setShowClosed] = useState(() => searchParams.get('showClosed') === 'true')
  // docs/specs/042-match-list-filters-and-search.md's default-ascending convention - soonest
  // covered match first.
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')
  const [{ sectionId, type }, setFilters] = usePersistedListFilters(`availabilityPolls:filters:${clubId}`, {
    sectionId: null as string | null,
    type: 'ALL' as PollTypeFilter,
  })

  const wantSquad = type !== 'GROUP'
  const wantGroup = type !== 'SQUAD'

  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'availability-polls', 'open', sectionId],
    queryFn: () => listOpenPolls(clubId as string, { sectionId: sectionId ?? undefined }),
    enabled: Boolean(clubId) && wantSquad,
  })

  const roundsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', 'open', sectionId],
    queryFn: () => listRounds(clubId as string, { sectionId: sectionId ?? undefined, open: true }),
    enabled: Boolean(clubId) && wantGroup,
  })

  const closedPollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'availability-polls', 'closed', sectionId],
    queryFn: () => listClosedPolls(clubId as string, { sectionId: sectionId ?? undefined }),
    enabled: Boolean(clubId) && wantSquad && showClosed,
  })

  const closedRoundsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', 'closed', sectionId],
    queryFn: () => listRounds(clubId as string, { sectionId: sectionId ?? undefined, open: false }),
    enabled: Boolean(clubId) && wantGroup && showClosed,
  })

  const { data: teams } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId as string),
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

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  const isLoading =
    (wantSquad && (pollsQuery.isLoading || (showClosed && closedPollsQuery.isLoading))) ||
    (wantGroup && (roundsQuery.isLoading || (showClosed && closedRoundsQuery.isLoading)))
  const isError =
    (wantSquad && (pollsQuery.isError || (showClosed && closedPollsQuery.isError))) ||
    (wantGroup && (roundsQuery.isError || (showClosed && closedRoundsQuery.isError)))

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
  const pollWord = showClosed ? 'polls' : 'open polls'
  const isFiltering = isSearching || type !== 'ALL' || sectionId !== null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by team, opponent or description"
        sortToggle={{
          value: sort,
          ascLabel: 'Match date, soonest first',
          descLabel: 'Match date, latest first',
          onToggle: () => setSort(sort === 'asc' ? 'desc' : 'asc'),
        }}
        filters={
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Input
              select
              label="Type"
              value={type}
              onChange={(event) => setFilters({ type: event.target.value as PollTypeFilter })}
            >
              <MenuItem value="ALL">All polls</MenuItem>
              <MenuItem value="SQUAD">Squad polls</MenuItem>
              <MenuItem value="GROUP">Group polls</MenuItem>
            </Input>
            <SectionTreeSelect
              label="Section"
              sections={sections ?? []}
              value={sectionId}
              onChange={(value) => setFilters({ sectionId: value })}
              allowClear
            />
            <FormControlLabel
              control={<Switch checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />}
              label="Show closed polls"
              sx={{ whiteSpace: 'nowrap', mr: 0 }}
            />
          </Stack>
        }
        filtersMinWidth={180}
      />

      {visibleItems.length > 0 && (
        <Box sx={pollCardGridSx}>
          {visibleItems.map((item) =>
            item.kind === 'SQUAD' ? (
              <PollCard
                key={item.key}
                clubId={clubId}
                item={{ kind: 'SQUAD', poll: item.poll }}
                open={item.open}
                teamsById={teamsById}
                onChanged={invalidatePolls}
              />
            ) : (
              <PollCard
                key={item.key}
                clubId={clubId}
                item={{ kind: 'GROUP', round: item.round }}
                teamsById={teamsById}
                onChanged={invalidatePolls}
              />
            ),
          )}
        </Box>
      )}

      {visibleItems.length === 0 && isFiltering && (
        <EmptyState
          title="No matching polls"
          description={
            isSearching
              ? `No ${pollWord} match "${search.trim()}". Try a different search.`
              : `No ${pollWord} match the current filters. Try a different type or section.`
          }
        />
      )}

      {visibleItems.length === 0 && !isFiltering && (
        <EmptyState
          title={showClosed ? 'No polls' : 'No open polls'}
          description="Open a squad poll for one team's match, or a group poll for a whole section's fixtures."
          action={<Button onClick={() => navigate('/manage/availability/new')}>New poll</Button>}
        />
      )}
    </Box>
  )
}
