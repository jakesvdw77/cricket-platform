import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardField } from '../../components/RecordCard'
import { ListToolbar } from '../../components/ListToolbar'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { AvailabilityRespondentAvatars } from '../../components/AvailabilityRespondentAvatars'
import { listOpenPolls } from '../../api/matchAvailabilityApi'
import type { OpenAvailabilityPoll } from '../../api/matchAvailabilityApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'
import { usePersistedListFilters } from '../../hooks/usePersistedListFilters'

// Same "resolve whichever side is null against the club's own team list" join MatchList.tsx's
// sideName / MatchFormPage.tsx's sideDisplayName already use — not a new resolution helper.
function sideDisplayName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

function editToFor(poll: OpenAvailabilityPoll): string {
  const side = poll.teamId === poll.homeTeamId ? 'home' : 'away'
  return `/manage/fixtures/matches/${poll.matchId}/edit?tab=availability&side=${side}`
}

function pollFields(poll: OpenAvailabilityPoll): RecordCardField[] {
  const fields: RecordCardField[] = [{ label: 'Date & time', value: new Date(poll.matchDate).toLocaleString() }]

  if (poll.venue) {
    fields.push({ label: 'Venue', value: poll.venue })
  }

  fields.push(
    {
      label: 'Available',
      value: <AvailabilityRespondentAvatars status="AVAILABLE" respondents={poll.availableRespondents} count={poll.availableCount} />,
    },
    {
      label: 'Unavailable',
      value: (
        <AvailabilityRespondentAvatars status="UNAVAILABLE" respondents={poll.unavailableRespondents} count={poll.unavailableCount} />
      ),
    },
    {
      label: 'Unsure',
      value: <AvailabilityRespondentAvatars status="UNSURE" respondents={poll.unsureRespondents} count={poll.unsureCount} />,
    },
    { label: 'No response', value: poll.noResponseCount },
  )

  return fields
}

// One RecordCard per open poll — mirrors PlayerList/MatchList's own card shape.
function PollCard({ poll, teamsById }: { poll: OpenAvailabilityPoll; teamsById: Map<string, Team> }) {
  const homeTeamName = sideDisplayName(poll.homeTeamId, poll.homeTeamName, teamsById)
  const awayTeamName = sideDisplayName(poll.awayTeamId, poll.awayTeamName, teamsById)
  const title = `${homeTeamName} vs ${awayTeamName}`
  const badgeLabel = poll.teamId === poll.homeTeamId ? 'Home' : 'Away'

  return (
    <RecordCard
      title={title}
      avatar={{ fallback: <EventAvailableOutlinedIcon fontSize="small" />, shape: 'rounded' }}
      badge={{ label: badgeLabel, tone: 'neutral' }}
      fields={pollFields(poll)}
      editLabel="Manage responses"
      editTo={editToFor(poll)}
    />
  )
}

// docs/specs/034-availability-polls-dashboard.md: replaces the /manage/availability stub, a
// club-wide read-summary-plus-navigate list of every currently-open availability poll — no
// RecordFormScreen (this screen has no create action or form of its own, see the spec's own
// dedicated UI Requirements sub-decision, unchanged by 043 below). docs/specs/
// 043-list-toolbar-gold-standard.md deliberately reverses 034's original "no ListToolbar" call —
// this screen now gets a real ListToolbar (Search + Sort by match date), still with no
// createLabel/onCreate/ManageScreenHeader.action. docs/specs/035-section-scoped-access.md's own
// SectionTreeSelect filter now lives in ListToolbar's filters slot, persisted the same way
// PlayerList/TeamDirectory/MatchList's own filters already are.
export default function AvailabilityPollsDashboard() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  // docs/specs/043-list-toolbar-gold-standard.md: Search is client-side only (listOpenPolls is
  // unpaginated, like every other screen in this rollout) — a new, separate, non-persisted
  // useState, never folded into the persisted filters below.
  const [search, setSearch] = useState('')
  // docs/specs/042-match-list-filters-and-search.md's own default-ascending convention — soonest
  // upcoming poll first.
  const [sort, setSort] = useState<'asc' | 'desc'>('asc')
  // docs/specs/035-section-scoped-access.md's existing filter, now persisted the same way
  // MatchList's own filters already are (docs/specs/043-list-toolbar-gold-standard.md).
  const [{ sectionId }, setFilters] = usePersistedListFilters(`availabilityPolls:filters:${clubId}`, {
    sectionId: null as string | null,
  })

  const {
    data: polls,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['managed-club', clubId, 'availability-polls', 'open', sectionId],
    queryFn: () => listOpenPolls(clubId as string, { sectionId: sectionId ?? undefined }),
    enabled: Boolean(clubId),
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

  // docs/specs/043-list-toolbar-gold-standard.md: Search/Sort for the first time on this screen —
  // both client-side, since listOpenPolls is unpaginated like every other screen in this rollout.
  // Search matches on the same resolved home/away team names PollCard's own title already shows
  // (via sideDisplayName, reused here rather than a new resolution helper).
  const visiblePolls = useMemo(() => {
    if (!polls) {
      return []
    }

    const term = search.trim().toLowerCase()
    const filtered = term
      ? polls.filter((poll) => {
          const homeTeamName = sideDisplayName(poll.homeTeamId, poll.homeTeamName, teamsById)
          const awayTeamName = sideDisplayName(poll.awayTeamId, poll.awayTeamName, teamsById)
          return homeTeamName.toLowerCase().includes(term) || awayTeamName.toLowerCase().includes(term)
        })
      : polls

    const sorted = [...filtered].sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())

    return sort === 'desc' ? sorted.reverse() : sorted
  }, [polls, search, sort, teamsById])

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (isLoading) {
    return null
  }

  if (isError || !polls) {
    return (
      <EmptyState
        title="Couldn't load availability polls"
        description="Something went wrong loading your club's open polls. Please try again."
      />
    )
  }

  const hasPolls = polls.length > 0
  const isSearching = search.trim().length > 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Availability Polls" />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by team name"
        sortToggle={{
          value: sort,
          ascLabel: 'Match date, soonest first',
          descLabel: 'Match date, latest first',
          onToggle: () => setSort(sort === 'asc' ? 'desc' : 'asc'),
        }}
        filters={
          <SectionTreeSelect
            label="Section"
            sections={sections ?? []}
            value={sectionId}
            onChange={(value) => setFilters({ sectionId: value })}
            allowClear
          />
        }
      />

      {visiblePolls.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {visiblePolls.map((poll) => (
            <PollCard key={poll.pollId} poll={poll} teamsById={teamsById} />
          ))}
        </Box>
      )}

      {visiblePolls.length === 0 && isSearching && (
        <EmptyState
          title="No matching polls"
          description={`No open polls match "${search.trim()}". Try a different search.`}
        />
      )}

      {!hasPolls && !isSearching && (
        <EmptyState
          title="No open polls"
          description="Open a poll for an upcoming match from its own Availability tab to see it here."
        />
      )}
    </Box>
  )
}
