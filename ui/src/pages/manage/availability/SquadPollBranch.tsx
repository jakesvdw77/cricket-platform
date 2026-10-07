import { useMemo, useState } from 'react'
import { Alert, Box, Checkbox, FormControlLabel, MenuItem, Stack, Switch, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { createPoll } from '../../../api/matchAvailabilityApi'
import { getFixtureGroups } from '../../../api/sectionAvailabilityApi'
import type { SectionAvailabilityFixtureMatch } from '../../../api/sectionAvailabilityApi'
import { listTeamsForClub } from '../../../api/teamApi'
import { errorDetail } from '../../../utils/errorDetail'
import { fromDatetimeLocal, toDatetimeLocal } from '../../../utils/datetimeLocal'
import { defaultCloseTime, formatMatchDateTime, matchLabel, validateCloseTime } from './pollHelpers'
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
  // Matches the manager unticked - everything uncovered is ticked by default, so tracking the
  // exclusions (reset on team change) avoids re-seeding a selection set whenever data arrives.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [autoClose, setAutoClose] = useState(true)
  // docs/specs/066: per-match 'Closes at' values the manager edited (datetime-local strings), keyed
  // by matchId; a match without an entry shows its own default (kickoff minus 24h, or 1h).
  const [editedCloseAt, setEditedCloseAt] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<string[]>([])

  // listTeamsForClub is already narrowed server-side to the caller's own section scope (035).
  const { data: teams, isLoading: teamsLoading } = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId),
  })

  const team = (teams ?? []).find((candidate) => candidate.id === teamId)

  const fixturesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-fixture-groups', team?.sectionId],
    queryFn: () => getFixtureGroups(clubId, team?.sectionId as string),
    enabled: Boolean(team),
  })

  const matches = useMemo<SectionAvailabilityFixtureMatch[]>(
    () =>
      (fixturesQuery.data ?? [])
        .flatMap((group) => group.matches)
        .filter((match) => match.teamId === teamId)
        .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()),
    [fixturesQuery.data, teamId],
  )

  const isTicked = (match: SectionAvailabilityFixtureMatch) => !match.alreadyPolled && !excludedIds.has(match.matchId)
  const tickedMatches = matches.filter(isTicked)
  const closeAtFor = (match: SectionAvailabilityFixtureMatch) =>
    editedCloseAt[match.matchId] ?? toDatetimeLocal(defaultCloseTime(match.matchDate).toISOString())
  const closeAtError = (match: SectionAvailabilityFixtureMatch) =>
    validateCloseTime(autoClose, closeAtFor(match) ? fromDatetimeLocal(closeAtFor(match)) : null, match.matchDate)
  const hasCloseTimeError = tickedMatches.some((match) => Boolean(closeAtError(match)))

  const createMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        tickedMatches.map((match) =>
          createPoll(clubId, match.matchId, teamId, autoClose, autoClose && closeAtFor(match) ? fromDatetimeLocal(closeAtFor(match)) : undefined),
        ),
      )
      const failures = results
        .map((result, index) => ({ result, match: tickedMatches[index] }))
        .filter((entry): entry is { result: PromiseRejectedResult; match: SectionAvailabilityFixtureMatch } => entry.result.status === 'rejected')
        .map(({ result, match }) =>
          `${matchLabel(match)}: ${errorDetail(result.reason, 'Something went wrong opening this poll.')}`,
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

  const count = tickedMatches.length

  return (
    <Stack spacing={3} sx={{ gridColumn: '1 / -1' }}>
      <Input select label="Team" value={teamId} onChange={(event) => selectTeam(event.target.value)} disabled={teamsLoading}>
        {(teams ?? [])
          .filter((candidate) => candidate.active)
          .map((candidate) => (
            <MenuItem key={candidate.id} value={candidate.id}>
              {candidate.name}
            </MenuItem>
          ))}
      </Input>

      {!team && (
        <EmptyState title="Choose a team" description="Pick a team to see its upcoming matches and choose which ones to poll." />
      )}

      {team && fixturesQuery.isLoading && (
        <Typography variant="body2" color="text.secondary">
          Loading upcoming matches…
        </Typography>
      )}

      {team && fixturesQuery.isError && (
        <EmptyState title="Couldn't load upcoming matches" description="Something went wrong loading this team's matches. Please try again." />
      )}

      {team && !fixturesQuery.isLoading && !fixturesQuery.isError && matches.length === 0 && (
        <EmptyState title="No upcoming matches" description={`${team.name} has no upcoming matches to poll.`} />
      )}

      {matches.length > 0 && (
        <Stack spacing={1.5}>
          {matches.map((match) => (
            <Stack
              key={match.matchId}
              direction="row"
              alignItems="flex-start"
              spacing={1}
              sx={{ opacity: match.alreadyPolled ? 0.6 : 1 }}
            >
              <Checkbox
                checked={isTicked(match)}
                disabled={match.alreadyPolled}
                onChange={() => toggleMatch(match.matchId)}
                inputProps={{ 'aria-label': `Include ${matchLabel(match)}` }}
              />
              <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  {matchLabel(match)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatMatchDateTime(match.matchDate)}
                  {match.leagueName ? ` - ${match.leagueName}` : ''}
                </Typography>
                {isTicked(match) && autoClose && (
                  <Input
                    label={`Closes at for ${matchLabel(match)}`}
                    type="datetime-local"
                    value={closeAtFor(match)}
                    onChange={(event) => setEditedCloseAt((prev) => ({ ...prev, [match.matchId]: event.target.value }))}
                    error={Boolean(closeAtError(match))}
                    helperText={closeAtError(match)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ mt: 1 }}
                  />
                )}
                <CoveredByNote match={match} />
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}

      {matches.length > 0 && (
        <Stack spacing={0.5}>
          <FormControlLabel
            control={<Switch checked={autoClose} onChange={(event) => setAutoClose(event.target.checked)} />}
            label="Autoclose"
          />
          <Typography variant="caption" color="text.secondary">
            Each poll closes by itself at the time shown (24 hours before its match unless you change it). Switch off to close them manually.
          </Typography>
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
        <Box>
          <Button disabled={count === 0 || hasCloseTimeError || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Opening…' : `Open ${count} poll${count === 1 ? '' : 's'}`}
          </Button>
        </Box>
      )}
    </Stack>
  )
}
