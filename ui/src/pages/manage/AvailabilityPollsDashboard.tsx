import { useEffect, useMemo, useState } from 'react'
import { Box, FormControlLabel, Switch } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ContentControlsLine, SortLink } from '../../components/ContentControlsLine'
import { EmptyState } from '../../components/EmptyState'
import { Button } from '../../components/Button'
import { listClosedPolls, listOpenPolls } from '../../api/matchAvailabilityApi'
import type { OpenAvailabilityPoll } from '../../api/matchAvailabilityApi'
import { listRounds } from '../../api/sectionAvailabilityApi'
import type { SectionAvailabilityRound } from '../../api/sectionAvailabilityApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { PollCard } from './availability/PollCard'
import { AvailabilityFilterBar } from './availability/AvailabilityFilterBar'
import { useAvailabilityHub } from './availability/hubContext'
import { pollCardGridSx } from '../../utils/cardGrid'
import { squadPollTitle } from './availability/pollHelpers'
import { invalidateAvailabilityCounters } from '../../api/availabilitySummaryApi'

// One entry of the merged list - sortDate is the soonest match the poll covers (a squad poll's
// own match, a group poll's firstMatchDate).
type PollListItem =
  | { kind: 'SQUAD'; key: string; sortDate: number; poll: OpenAvailabilityPoll; open: boolean }
  | { kind: 'GROUP'; key: string; sortDate: number; round: SectionAvailabilityRound }

const CLOCK_TICK_MS = 60_000
const CLOSING_SOON_MS = 48 * 60 * 60 * 1000

function closesWithin48Hours(item: PollListItem, now: number): boolean {
  const open = item.kind === 'SQUAD' ? item.open : item.round.open
  const autoClose = item.kind === 'SQUAD' ? item.poll.autoClose : item.round.autoClose
  const closeAt = item.kind === 'SQUAD' ? item.poll.scheduledCloseAt : item.round.scheduledCloseAt
  if (!open || !autoClose || !closeAt) return false
  const time = new Date(closeAt).getTime()
  return time > now && time <= now + CLOSING_SOON_MS
}

// docs/specs/064-unified-availability-polls.md: the one place every open poll lives. Extends
// docs/specs/034-availability-polls-dashboard.md's squad-poll list (and absorbs 063's group-poll
// list from the removed /manage/section-availability screen) into the standard record-list
// pattern (the header and New poll action live in AvailabilityHubLayout, 073): a RecordCard grid mixing both kinds.
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
    clubId, filters, teams: teamOptions, validTeamId: teamId, teamsLoading, teamsError,
    showGroup, setShowGroup, showSquad, setShowSquad, showClosed, setShowClosed, closingSoon, setClosingSoon,
  } = useAvailabilityHub()
  const { sectionId, leagueId } = filters
  const scopeParams = { leagueId: leagueId ?? undefined, sectionId: sectionId ?? undefined, teamId: teamId ?? undefined }
  // Held until the team list loaded (and not at all if it failed), so the requests carry a validated team.
  const ready = Boolean(clubId) && !teamsLoading && !teamsError
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  // docs/specs/042-match-list-filters-and-search.md's default-ascending convention - soonest
  // covered match first.
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')

  // The clock the 48-hour filter reads. It ticks once a minute, and only while the filter is on, so a poll whose
  // close time passes while the page stays open leaves the list (the lists themselves are not refetched for it).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!closingSoon) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [closingSoon])

  const wantSquad = showSquad
  const wantGroup = showGroup

  const pollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'availability-polls', 'open', { leagueId, sectionId, teamId }],
    queryFn: () => listOpenPolls(clubId as string, scopeParams),
    enabled: ready && wantSquad,
  })

  const roundsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', 'open', { leagueId, sectionId, teamId }],
    queryFn: () => listRounds(clubId as string, { ...scopeParams, open: true }),
    enabled: ready && wantGroup,
  })

  const closedPollsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'availability-polls', 'closed', { leagueId, sectionId, teamId }],
    queryFn: () => listClosedPolls(clubId as string, scopeParams),
    enabled: ready && wantSquad && showClosed,
  })

  const closedRoundsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', 'closed', { leagueId, sectionId, teamId }],
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
    // docs/specs/084: "Close in 48 hours" - the backend's rule (closeAt after now and not after now + 48 h), on
    // open polls only. A poll without a scheduled close (autoClose off) never matches.
    const base = closingSoon ? allItems.filter((item) => closesWithin48Hours(item, now)) : allItems
    const filtered = term
      ? base.filter((item) => {
          const haystack =
            item.kind === 'SQUAD'
              ? squadPollTitle(item.poll, teamsById)
              : `${item.round.description} ${item.round.sectionName}`
          return haystack.toLowerCase().includes(term)
        })
      : base
    const sorted = [...filtered].sort((a, b) => a.sortDate - b.sortDate)
    return sort === 'desc' ? sorted.reverse() : sorted
  }, [allItems, search, sort, teamsById, closingSoon, now])

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
    teamsLoading ||
    (wantSquad && (pollsQuery.isLoading || (showClosed && closedPollsQuery.isLoading))) ||
    (wantGroup && (roundsQuery.isLoading || (showClosed && closedRoundsQuery.isLoading)))
  const isError =
    teamsError ||
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
  const typeLimited = !(showGroup && showSquad)
  const isFiltering = isSearching || typeLimited || closingSoon || sectionId !== null || leagueId !== null || teamId !== null

  // The last type toggle left on cannot be switched off.
  const typeToggles = (
    <>
      <FormControlLabel
        control={<Switch checked={showGroup} disabled={showGroup && !showSquad} onChange={(event) => setShowGroup(event.target.checked)} />}
        label="Group polls"
        sx={{ whiteSpace: 'nowrap', mr: 0 }}
      />
      <FormControlLabel
        control={<Switch checked={showSquad} disabled={showSquad && !showGroup} onChange={(event) => setShowSquad(event.target.checked)} />}
        label="Squad polls"
        sx={{ whiteSpace: 'nowrap', mr: 0 }}
      />
    </>
  )
  const closedToggle = (
    <FormControlLabel
      control={<Switch checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />}
      label="Show closed polls"
      sx={{ whiteSpace: 'nowrap', mr: 0 }}
    />
  )
  const closingSoonToggle = (
    <FormControlLabel
      control={<Switch checked={closingSoon} onChange={(event) => setClosingSoon(event.target.checked)} />}
      label="Closing within 48 h"
      sx={{ whiteSpace: 'nowrap', mr: 0 }}
    />
  )
  const sortLink = <SortLink label={sort === 'asc' ? 'soonest first' : 'latest first'} onToggle={() => setSort(sort === 'asc' ? 'desc' : 'asc')} />

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <AvailabilityFilterBar
        show={{ league: true, section: true, team: true }}
        teams={teamOptions}
        teamId={teamId}
        teamAllLabel={sectionId ? 'All teams in section' : 'All teams'}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by team, opponent or description"
        extraChips={[
          ...(typeLimited
            ? [
                {
                  key: 'type',
                  label: showGroup ? 'Group polls only' : 'Squad polls only',
                  onRemove: () => {
                    setShowGroup(true)
                    setShowSquad(true)
                  },
                },
              ]
            : []),
          ...(closingSoon ? [{ key: 'closing-soon', label: 'Closing within 48 h', onRemove: () => setClosingSoon(false) }] : []),
        ]}
        viewControls={
          <>
            {typeToggles}
            {closedToggle}
            {closingSoonToggle}
            {sortLink}
          </>
        }
        onClearedAll={() => {
          setShowGroup(true)
          setShowSquad(true)
          setClosingSoon(false)
        }}
      />

      <ContentControlsLine
        scope={`Showing ${visibleItems.length} ${showClosed ? '' : 'open '}${visibleItems.length === 1 ? 'poll' : 'polls'}${closingSoon ? ' closing within 48 hours' : ''}`}
        sortAction={sortLink}
        controls={
          <>
            {typeToggles}
            {closedToggle}
          </>
        }
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
              : `No ${pollWord} match the current filters. Try a different type, section, league or team.`
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
