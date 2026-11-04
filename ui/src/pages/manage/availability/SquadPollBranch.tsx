import { useMemo, useState } from 'react'
import { Alert, Box, Card, CardContent, Checkbox, Chip, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { DateTimeField } from '../../../components/DateTimeField'
import { EmptyState } from '../../../components/EmptyState'
import { compactFieldsSx } from '../../../utils/filterPanel'
import { createPoll } from '../../../api/matchAvailabilityApi'
import { getFixtureGroups } from '../../../api/sectionAvailabilityApi'
import type { SectionAvailabilityFixtureMatch } from '../../../api/sectionAvailabilityApi'
import { listTeamsForClub } from '../../../api/teamApi'
import { listSections } from '../../../api/sectionApi'
import { NewPollFilters } from './NewPollFilters'
import { sectionIdsUnder } from './sectionScope'
import { DAY_PART_LABEL } from '../../../utils/dayPart'
import { errorDetail } from '../../../utils/errorDetail'
import { fromDatetimeLocal, toDatetimeLocal } from '../../../utils/datetimeLocal'
import { defaultCloseTime, formatDateRange, formatMatchDateTime, matchLabel, validateCloseTime } from './pollHelpers'
import { groupHeadingSx, sectionCardSx } from './groupHeadingSx'
import { CoveredByNote } from './CoveredByNote'
import { invalidateAvailabilityCounters } from '../../../api/availabilitySummaryApi'

// docs/specs/064-unified-availability-polls.md: NewPollPage's Squad branch - one team, one or more
// of its upcoming matches, each ticked match getting its own 032 poll (N createPoll calls).
//
// Which matches are upcoming and already covered? The section's fixture-group endpoint
// (getFixtureGroups for the team's section) already returns exactly that, for either poll kind:
// every upcoming match of any team in the section, with alreadyPolled/existingPollType/Id/Label.
// One request, the same React Query key the Group branch uses, and the server's own coverage
// rule - chosen over listMatches (paginated, no coverage info) + N per-match listPolls calls.
// Rows are that endpoint's matches narrowed to the chosen team.
export function SquadPollBranch({
  clubId,
  onCreated,
}: {
  clubId: string
  onCreated: () => void
}) {
  const queryClient = useQueryClient()
  const [teamId, setTeamId] = useState('')
  const [sectionId, setSectionId] = useState<string | null>(null)
  // Matches the manager unticked - everything uncovered is ticked by default, so tracking the
  // exclusions (reset on team change) avoids re-seeding a selection set whenever data arrives.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  // docs/specs/136: Autoclose is per poll, as on the Group page: the matches whose switch the manager turned off (everything starts on).
  const [manualIds, setManualIds] = useState<Set<string>>(new Set())
  const autoCloseFor = (match: SectionAvailabilityFixtureMatch) => !manualIds.has(match.matchId)
  const toggleAutoClose = (matchId: string) =>
    setManualIds((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  // docs/specs/066: per-match 'Closes at' values the manager edited (datetime-local strings), keyed
  // by matchId; a match without an entry shows its own default (kickoff minus 24h, or 1h).
  const [editedCloseAt, setEditedCloseAt] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<string[]>([])

  // listTeamsForClub is already narrowed server-side to the caller's own section scope (035).
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId),
  })

  // docs/specs/136 (mockup approved 2026-11-04): the page opens already showing the matches without a poll, grouped by team. A manager of
  // one team sees it preselected; a manager of several sees "All My Teams" and may narrow to one.
  const { data: sections } = useQuery({
    queryKey: ['managed-club', clubId, 'sections'],
    queryFn: () => listSections(clubId),
  })
  const allActiveTeams = (teams ?? []).filter((candidate) => candidate.active)
  const inSection = sectionId ? sectionIdsUnder(sections ?? [], sectionId) : null
  // The Section filter narrows the teams (and so the Team select and the matches shown).
  const activeTeams = allActiveTeams.filter((candidate) => !inSection || (candidate.sectionId ? inSection.has(candidate.sectionId) : false))
  const effectiveTeamId = activeTeams.some((candidate) => candidate.id === teamId) ? teamId : activeTeams.length === 1 && allActiveTeams.length === 1 ? activeTeams[0].id : ''
  const targetTeams = effectiveTeamId ? activeTeams.filter((candidate) => candidate.id === effectiveTeamId) : activeTeams
  const sectionIds = Array.from(new Set(targetTeams.map((candidate) => candidate.sectionId).filter((id): id is string => Boolean(id))))

  const fixtureQueries = useQueries({
    queries: sectionIds.map((sectionId) => ({
      queryKey: ['managed-club', clubId, 'section-availability-fixture-groups', sectionId],
      queryFn: () => getFixtureGroups(clubId, sectionId),
    })),
  })
  const fixturesLoading = fixtureQueries.some((query) => query.isLoading)
  const fixturesError = fixtureQueries.some((query) => query.isError)
  const fixtureGroups = fixtureQueries.flatMap((query) => query.data ?? [])

  const teamMatches = useMemo(
    () =>
      targetTeams
        .map((candidate) => ({
          team: candidate,
          matches: fixtureGroups
            .flatMap((group) => group.matches)
            .filter((match) => match.teamId === candidate.id)
            .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()),
        }))
        .filter((entry) => entry.matches.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetTeams.map((candidate) => candidate.id).join(','), fixtureQueries.map((query) => query.dataUpdatedAt).join(',')],
  )
  const matches = useMemo<SectionAvailabilityFixtureMatch[]>(() => teamMatches.flatMap((entry) => entry.matches), [teamMatches])

  const isTicked = (match: SectionAvailabilityFixtureMatch) => !match.alreadyPolled && !excludedIds.has(match.matchId)
  const tickedMatches = matches.filter(isTicked)
  const closeAtFor = (match: SectionAvailabilityFixtureMatch) =>
    editedCloseAt[match.matchId] ?? toDatetimeLocal(defaultCloseTime(match.matchDate).toISOString())
  const closeAtError = (match: SectionAvailabilityFixtureMatch) =>
    validateCloseTime(autoCloseFor(match), closeAtFor(match) ? fromDatetimeLocal(closeAtFor(match)) : null, match.matchDate)
  const hasCloseTimeError = tickedMatches.some((match) => Boolean(closeAtError(match)))

  const createMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        tickedMatches.map((match) =>
          createPoll(clubId, match.matchId, match.teamId, autoCloseFor(match), autoCloseFor(match) && closeAtFor(match) ? fromDatetimeLocal(closeAtFor(match)) : undefined),
        ),
      )
      const failures = results
        .map((result, index) => ({ result, match: tickedMatches[index] }))
        .filter((entry): entry is { result: PromiseRejectedResult; match: SectionAvailabilityFixtureMatch } => entry.result.status === 'rejected')
        .map(({ result, match }) =>
          `${matchLabel(match)}: ${errorDetail(result.reason, 'Something went wrong creating this poll.')}`,
        )
      return failures
    },
    onSuccess: (failures) => {
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-polls'] })
      invalidateAvailabilityCounters(queryClient, clubId)
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'section-availability-fixture-groups'] })
      if (failures.length === 0) {
        onCreated()
      } else {
        // Partial failure: the polls that did open now show as covered after the refetch above.
        setErrors(failures)
      }
    },
  })

  const toggleMatch = (matchId: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) {
        next.delete(matchId)
      } else {
        next.add(matchId)
      }
      return next
    })
  }

  const selectTeam = (nextTeamId: string) => {
    setTeamId(nextTeamId)
    setExcludedIds(new Set())
    setEditedCloseAt({})
    setErrors([])
  }

  const toggleTeam = (entryMatches: SectionAvailabilityFixtureMatch[]) => {
    const open = entryMatches.filter((match) => !match.alreadyPolled)
    const allTicked = open.every((match) => !excludedIds.has(match.matchId))
    setExcludedIds((prev) => {
      const next = new Set(prev)
      open.forEach((match) => (allTicked ? next.add(match.matchId) : next.delete(match.matchId)))
      return next
    })
  }

  const count = tickedMatches.length
  const showHeadings = teamMatches.length > 1 || (!effectiveTeamId && activeTeams.length > 1)

  return (
    <Stack spacing={2} sx={{ gridColumn: '1 / -1' }}>
      <NewPollFilters
        sections={sections ?? []}
        teams={activeTeams}
        sectionId={sectionId}
        teamId={effectiveTeamId}
        onSectionChange={(next) => {
          setSectionId(next)
          selectTeam('')
        }}
        onTeamChange={selectTeam}
        disabled={teamsLoading}
        hint="Matches with no poll yet. Each ticked match gets its own link."
      />

      {fixturesLoading && (
        <Typography variant="body2" color="text.secondary">
          Loading upcoming matches…
        </Typography>
      )}

      {!fixturesLoading && fixturesError && (
        <EmptyState title="Couldn't load upcoming matches" description="Something went wrong loading your matches. Please try again." />
      )}

      {!teamsLoading && !fixturesLoading && !fixturesError && matches.length === 0 && (
        <EmptyState title="No upcoming matches" description="There are no upcoming matches to poll for your teams." />
      )}

      {matches.length > 0 && (
        <Stack spacing={1} sx={{ ...compactFieldsSx }}>
          {teamMatches.map(({ team: entryTeam, matches: entryMatches }) => (
            <Stack key={entryTeam.id} spacing={1} sx={showHeadings ? sectionCardSx : undefined}>
              {showHeadings && (
                <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 1.5 }}>
                  <Typography component="h2" sx={groupHeadingSx}>
                    {entryTeam.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entryMatches.length} {entryMatches.length === 1 ? 'match' : 'matches'}
                  </Typography>
                  <Box sx={{ ml: 'auto' }}>
                    <Button size="compact" variant="secondary" onClick={() => toggleTeam(entryMatches)} aria-label={`Select all matches for ${entryTeam.name}`}>
                      Select All
                    </Button>
                  </Box>
                </Box>
              )}
              {entryMatches.map((match) => (
                <Card key={match.matchId} variant="outlined" sx={{ boxShadow: 0, bgcolor: 'background.paper', opacity: match.alreadyPolled ? 0.6 : 1 }}>
                  {/* docs/specs/136: the same card as a Group fixture group: the date on the left, the league as a badge on the right, the
                      match with its day-part chip, a divider, then the close time with the Autoclose switch on the same row. */}
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, ...compactFieldsSx }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap spacing={1}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {formatDateRange(match.matchDate.slice(0, 10), match.matchDate.slice(0, 10))}
                      </Typography>
                      {match.leagueName && <Chip size="small" variant="outlined" label={match.leagueName} />}
                    </Stack>

                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                      <Checkbox
                        checked={isTicked(match)}
                        disabled={match.alreadyPolled}
                        onChange={() => toggleMatch(match.matchId)}
                        inputProps={{ 'aria-label': `Include ${matchLabel(match)}` }}
                      />
                      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="body2" fontWeight={600}>
                            {matchLabel(match)}
                          </Typography>
                          <Chip size="small" variant="outlined" label={DAY_PART_LABEL[match.dayPart]} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatMatchDateTime(match.matchDate)}
                        </Typography>
                        <CoveredByNote match={match} />
                      </Stack>
                    </Stack>

                    {isTicked(match) && <Divider />}
                    {isTicked(match) && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 2, rowGap: 1, mt: 1.5 }}>
                        {autoCloseFor(match) && (
                          <Box sx={{ width: { xs: '100%', sm: 360 } }}>
                            <DateTimeField
                              label={`Closes At For ${matchLabel(match)}`}
                              value={closeAtFor(match)}
                              onChange={(closeAt) => setEditedCloseAt((prev) => ({ ...prev, [match.matchId]: closeAt }))}
                              error={Boolean(closeAtError(match))}
                              helperText={closeAtError(match) ?? 'Defaults to 24 hours before this match.'}
                            />
                          </Box>
                        )}
                        <FormControlLabel
                          control={<Switch checked={autoCloseFor(match)} onChange={() => toggleAutoClose(match.matchId)} inputProps={{ 'aria-label': `Autoclose ${matchLabel(match)}` }} />}
                          label="Autoclose"
                          sx={{ m: 0, minHeight: 36 }}
                        />
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ))}
        </Stack>
      )}

      {errors.length > 0 && (
        <Alert severity="error">
          {errors.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </Alert>
      )}

      {matches.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="compact" disabled={count === 0 || hasCloseTimeError || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Creating…' : `Create ${count} Poll${count === 1 ? '' : 's'}`}
          </Button>
        </Box>
      )}
    </Stack>
  )
}
