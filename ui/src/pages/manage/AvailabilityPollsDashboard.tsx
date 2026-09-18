import { useMemo, useState } from 'react'
import { Box } from '@mui/material'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import { RecordCard } from '../../components/RecordCard'
import type { RecordCardField } from '../../components/RecordCard'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { SectionTreeSelect } from '../../components/SectionTreeSelect'
import { AvailabilityRespondentAvatars } from '../../components/AvailabilityRespondentAvatars'
import { listOpenPolls } from '../../api/matchAvailabilityApi'
import type { OpenAvailabilityPoll } from '../../api/matchAvailabilityApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { listSections } from '../../api/sectionApi'

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
// ListToolbar/RecordFormScreen (this screen has no create action and no form of its own, see the
// spec's own dedicated UI Requirements sub-decision). docs/specs/035-section-scoped-access.md
// layers an optional SectionTreeSelect filter on top, same pattern as PlayerList/TeamDirectory/
// MatchList.
export default function AvailabilityPollsDashboard() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const [sectionId, setSectionId] = useState<string | null>(null)

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <ManageScreenHeader title="Availability Polls" />

      <Box sx={{ maxWidth: 360 }}>
        <SectionTreeSelect
          label="Section"
          sections={sections ?? []}
          value={sectionId}
          onChange={setSectionId}
          allowClear
        />
      </Box>

      {hasPolls && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          }}
        >
          {polls.map((poll) => (
            <PollCard key={poll.pollId} poll={poll} teamsById={teamsById} />
          ))}
        </Box>
      )}

      {!hasPolls && (
        <EmptyState
          title="No open polls"
          description="Open a poll for an upcoming match from its own Availability tab to see it here."
        />
      )}
    </Box>
  )
}
