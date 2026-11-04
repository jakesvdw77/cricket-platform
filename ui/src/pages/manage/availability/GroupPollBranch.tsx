import { useState } from 'react'
import { Stack, Typography } from '@mui/material'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '../../../components/EmptyState'
import { listTeamsForClub } from '../../../api/teamApi'
import { NewPollFilters } from './NewPollFilters'
import { sectionIdsUnder } from './sectionScope'
import { getFixtureGroups } from '../../../api/sectionAvailabilityApi'
import { listSections } from '../../../api/sectionApi'
import { groupHeadingSx, sectionCardSx } from './groupHeadingSx'
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
  const [pickedSectionId, setSectionId] = useState<string | null>(initialSectionId ?? null)
  const [teamId, setTeamId] = useState('')

  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId),
  })

  const { data: teams } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId),
  })

  // docs/specs/136: the section is preselected when the manager can see one section only (and from ?sectionId=, the hub's filter).
  const activeSections = (sections ?? []).filter((section) => section.active)
  const sectionId = pickedSectionId ?? (activeSections.length === 1 ? activeSections[0].id : null)
  const inSection = sectionId ? sectionIdsUnder(sections ?? [], sectionId) : null
  const teamOptions = (teams ?? []).filter((team) => team.active && (!inSection || (team.sectionId ? inSection.has(team.sectionId) : false)))
  const effectiveTeamId = teamOptions.some((team) => team.id === teamId) ? teamId : ''

  // docs/specs/136 (mockup approved 2026-11-04): the page opens already showing the fixtures with no poll, grouped by section. One
  // section (or ?sectionId=) means that section; several means "All Sections", a heading each, and the select narrows it.
  const targetSections = inSection ? activeSections.filter((section) => inSection.has(section.id)) : activeSections
  const fixtureQueries = useQueries({
    queries: targetSections.map((section) => ({
      queryKey: ['managed-club', clubId, 'section-availability-fixture-groups', section.id],
      queryFn: () => getFixtureGroups(clubId, section.id),
    })),
  })
  const isLoading = fixtureQueries.some((query) => query.isLoading)
  const isError = fixtureQueries.some((query) => query.isError)

  // Soonest first, with groups whose every fixture is already in a poll last (they are collapsed to a line).
  const sectionGroups = targetSections
    .map((section, index) => {
      const covered = (group: { matches: { alreadyPolled: boolean }[] }) => group.matches.length > 0 && group.matches.every((match) => match.alreadyPolled)
      const groups = [...(fixtureQueries[index]?.data ?? [])]
        .filter((group) => !effectiveTeamId || group.matches.some((match) => match.teamId === effectiveTeamId))
        .sort(
        (a, b) => Number(covered(a)) - Number(covered(b)) || new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )
      return { section, groups }
    })
    .filter((entry) => entry.groups.length > 0)
  const showHeadings = !sectionId && activeSections.length > 1

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-rounds'] })
    invalidateAvailabilityCounters(queryClient, clubId)
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-fixture-groups'] })
    onCreated()
  }

  return (
    <Stack spacing={2} sx={{ gridColumn: '1 / -1' }}>
      <NewPollFilters
        sections={sections ?? []}
        teams={teamOptions}
        sectionId={sectionId}
        teamId={effectiveTeamId}
        onSectionChange={setSectionId}
        onTeamChange={setTeamId}
        hint="Fixtures with no poll yet. Each card below opens one poll with one link."
      />

      {isLoading && (
        <Typography variant="body2" color="text.secondary">
          Loading upcoming fixtures…
        </Typography>
      )}

      {!isLoading && isError && (
        <EmptyState title="Couldn't load upcoming fixtures" description="Something went wrong loading the upcoming fixtures. Please try again." />
      )}

      {sections && !isLoading && !isError && sectionGroups.length === 0 && (
        <EmptyState title="No upcoming fixtures" description="There are no upcoming fixtures to poll yet." />
      )}

      {sectionGroups.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" component="h2" fontWeight={700}>
            Upcoming Fixtures
          </Typography>
          {sectionGroups.map(({ section, groups }) => (
            <Stack key={section.id} spacing={1.5} sx={showHeadings ? sectionCardSx : undefined}>
              {showHeadings && (
                <Typography component="h3" sx={groupHeadingSx}>
                  {section.name}
                </Typography>
              )}
              {groups.map((group) => (
                <FixtureGroupCard
                  key={`${section.id}-${group.startDate}-${group.endDate}`}
                  clubId={clubId}
                  sectionId={section.id}
                  group={group}
                  highlightMatchId={matchId}
                  onCreated={handleCreated}
                />
              ))}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
