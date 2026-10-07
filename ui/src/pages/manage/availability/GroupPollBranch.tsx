import { useMemo, useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SectionTreeSelect } from '../../../components/SectionTreeSelect'
import { EmptyState } from '../../../components/EmptyState'
import { getFixtureGroups } from '../../../api/sectionAvailabilityApi'
import { listSections } from '../../../api/sectionApi'
import { FixtureGroupCard } from './FixtureGroupCard'
import { invalidateAvailabilityCounters } from '../../../api/availabilitySummaryApi'

// docs/specs/064-unified-availability-polls.md: NewPollPage's Group branch - 063's fixture-group
// review (section picker + one FixtureGroupCard per proposed group) moved here from the removed
// SectionAvailabilityRounds screen with unchanged behaviour. The section is pre-filled from
// ?sectionId=, and the group containing ?matchId= is highlighted, when arriving via MatchFormPage's
// "Open group poll" shortcut.
export function GroupPollBranch({
  clubId,
  initialSectionId,
  matchId,
  onCreated,
}: {
  clubId: string
  initialSectionId?: string | null
  matchId?: string | null
  onCreated: () => void
}) {
  const queryClient = useQueryClient()
  const [sectionId, setSectionId] = useState<string | null>(initialSectionId ?? null)

  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId),
  })

  const fixtureGroupsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-fixture-groups', sectionId],
    queryFn: () => getFixtureGroups(clubId, sectionId as string),
    enabled: Boolean(sectionId),
  })

  const groups = useMemo(() => fixtureGroupsQuery.data ?? [], [fixtureGroupsQuery.data])

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-rounds'] })
    invalidateAvailabilityCounters(queryClient, clubId)
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-fixture-groups'] })
    onCreated()
  }

  return (
    <Stack spacing={2} sx={{ gridColumn: '1 / -1' }}>
      <SectionTreeSelect label="Section" sections={sections ?? []} value={sectionId} onChange={setSectionId} />

      {!sectionId && (
        <EmptyState
          title="Choose a section"
          description="Pick a section to review its upcoming fixtures and choose which ones this poll should cover."
        />
      )}

      {sectionId && fixtureGroupsQuery.isLoading && (
        <Typography variant="body2" color="text.secondary">
          Loading upcoming fixtures…
        </Typography>
      )}

      {sectionId && !fixtureGroupsQuery.isLoading && fixtureGroupsQuery.isError && (
        <EmptyState
          title="Couldn't load upcoming fixtures"
          description="Something went wrong loading this section's upcoming fixtures. Please try again."
        />
      )}

      {sectionId && !fixtureGroupsQuery.isLoading && !fixtureGroupsQuery.isError && groups.length === 0 && (
        <EmptyState title="No upcoming fixtures" description="This section has no upcoming fixtures yet." />
      )}

      {sectionId && groups.length > 0 && (
        <Stack spacing={2}>
          {groups.map((group) => (
            <FixtureGroupCard
              key={`${group.startDate}-${group.endDate}`}
              clubId={clubId}
              sectionId={sectionId}
              group={group}
              highlightMatchId={matchId}
              onCreated={handleCreated}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
}
