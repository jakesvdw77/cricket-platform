import { Dialog, DialogActions, DialogContent, DialogTitle, Link as MuiLink, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { getRoundMatches } from '../../../api/sectionAvailabilityApi'
import type { Team } from '../../../api/teamApi'
import { formatBracketLabel } from '../../../utils/dayPart'
import { formatMatchDateTime, matchLabel, squadPollHref, squadPollTitle } from './pollHelpers'
import type { PollItem } from './pollItem'

// docs/specs/066: the card's Matches button - a small dialog (not an in-card panel, so the card's
// height never changes on its own) listing the matches a poll covers. A group poll lists every
// covered match under its time slot; a squad poll has exactly one, linking to the match.
export function PollMatchesDialog({
  open,
  onClose,
  clubId,
  item,
  teamsById,
}: {
  open: boolean
  onClose: () => void
  clubId: string
  item: PollItem
  teamsById: Map<string, Team>
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="poll-matches-title">
      <DialogTitle id="poll-matches-title">Matches</DialogTitle>
      <DialogContent>
        {item.kind === 'GROUP' ? (
          <GroupMatches clubId={clubId} round={item.round} open={open} />
        ) : (
          <Stack spacing={0.5}>
            <Typography variant="body2" fontWeight={600}>
              {squadPollTitle(item.poll, teamsById)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatMatchDateTime(item.poll.matchDate)} · {item.poll.venue ?? 'Venue TBC'}
            </Typography>
            <MuiLink component={RouterLink} to={squadPollHref(item.poll)} variant="body2" onClick={onClose}>
              Open match
            </MuiLink>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function GroupMatches({
  clubId,
  round,
  open,
}: {
  clubId: string
  round: Extract<PollItem, { kind: 'GROUP' }>['round']
  open: boolean
}) {
  // Same key the Responses page uses, so the two share one cached request.
  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'section-availability-rounds', round.id, 'matches'],
    queryFn: () => getRoundMatches(clubId, round.id),
    enabled: open,
  })

  if (matchesQuery.isLoading) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading covered matches…
      </Typography>
    )
  }
  if (matchesQuery.isError) {
    return (
      <Typography variant="body2" color="error.main" role="alert">
        Couldn't load this poll's matches. Please try again.
      </Typography>
    )
  }

  return (
    <Stack spacing={2}>
      {round.brackets.map((bracket) => {
        const matches = (matchesQuery.data ?? []).filter((match) => match.windowId === bracket.windowId)
        return (
          <Stack key={bracket.windowId} spacing={0.75}>
            <Typography variant="subtitle2" component="h3" fontWeight={700}>
              {formatBracketLabel(bracket.windowDate, bracket.dayPart, ' · ')}
            </Typography>
            {matches.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No matches in this slot.
              </Typography>
            )}
            {matches.map((match) => (
              <Stack key={`${match.matchId}-${match.teamId}`} spacing={0.25}>
                <Typography variant="body2" fontWeight={600}>
                  {matchLabel(match)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatMatchDateTime(match.matchDate)}
                  {match.leagueName ? ` · ${match.leagueName}` : ''}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )
      })}
    </Stack>
  )
}
