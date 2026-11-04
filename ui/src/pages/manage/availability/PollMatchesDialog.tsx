import { Box, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link as MuiLink, Stack, Typography } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import { Button } from '../../../components/Button'
import { getRoundMatches } from '../../../api/sectionAvailabilityApi'
import type { Team } from '../../../api/teamApi'
import { DateTile } from '../../../components/DateTile'
import { DAY_PART_LABEL } from '../../../utils/dayPart'
import { formatMatchDateTime, matchLabel, squadPollHref, squadPollTitle } from './pollHelpers'
import type { PollItem } from './pollItem'

// docs/specs/082: a match in the dialog is a same-tab link to its match page - underlined so it reads as
// a link, with a visible focus ring - and the dialog closes as the navigation starts.
const matchLinkSx: SxProps<Theme> = {
  display: 'block',
  color: 'primary.main',
  borderRadius: 0.5,
  '&:hover': { color: 'primary.dark' },
  '&:focus-visible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', outlineOffset: 2 },
}

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="poll-matches-title">
      <DialogTitle id="poll-matches-title">Matches</DialogTitle>
      <DialogContent>
        {item.kind === 'GROUP' ? (
          <GroupMatches clubId={clubId} round={item.round} open={open} onClose={onClose} />
        ) : (
          <MatchRow
            date={item.poll.matchDate}
            title={squadPollTitle(item.poll, teamsById)}
            to={squadPollHref(item.poll)}
            caption={formatMatchDateTime(item.poll.matchDate)}
            badge={item.poll.venue ?? 'Venue TBC'}
            onClose={onClose}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button size="compact" variant="secondary" onClick={onClose}>
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
  onClose,
}: {
  clubId: string
  round: Extract<PollItem, { kind: 'GROUP' }>['round']
  open: boolean
  onClose: () => void
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

  // Each match is a row with a date tile; the slot's part of day is a chip beside the match (docs/specs/136, mockup option A).
  const rows = round.brackets.flatMap((bracket) =>
    (matchesQuery.data ?? []).filter((match) => match.windowId === bracket.windowId).map((match) => ({ match, dayPart: bracket.dayPart })),
  )
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No matches in this poll.
      </Typography>
    )
  }
  return (
    <Stack spacing={1.25}>
      {rows.map(({ match, dayPart }) => (
        <MatchRow
          key={`${match.matchId}-${match.teamId}`}
          date={match.matchDate}
          title={matchLabel(match)}
          to={squadPollHref(match)}
          chip={DAY_PART_LABEL[dayPart]}
          caption={formatMatchDateTime(match.matchDate)}
          badge={match.leagueName ?? undefined}
          onClose={onClose}
        />
      ))}
    </Stack>
  )
}

function MatchRow({
  date,
  title,
  to,
  chip,
  caption,
  badge,
  onClose,
}: {
  date: string
  title: string
  to: string
  chip?: string
  caption: string
  badge?: string
  onClose: () => void
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <DateTile date={date} />
      <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <MuiLink component={RouterLink} to={to} variant="body2" fontWeight={600} underline="always" onClick={onClose} sx={matchLinkSx}>
            {title}
          </MuiLink>
          {chip && <Chip size="small" variant="outlined" label={chip} />}
        </Stack>
        {/* The league (or venue) badge sits at the bottom right, on the caption line, so it never competes with the part-of-day chip. */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
          {badge && <Chip size="small" variant="outlined" label={badge} sx={{ flex: 'none', maxWidth: '60%' }} />}
        </Stack>
      </Stack>
    </Box>
  )
}
