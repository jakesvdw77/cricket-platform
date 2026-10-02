import { useState } from 'react'
import { Alert, Box, Card, CardContent, Checkbox, Chip, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { createRound } from '../../../api/sectionAvailabilityApi'
import type { SectionAvailabilityFixtureGroup } from '../../../api/sectionAvailabilityApi'
import { errorDetail } from '../../../utils/errorDetail'
import { DAY_PART_LABEL } from '../../../utils/dayPart'
import {
  computeScheduledCloseAt,
  formatCloseTime,
  formatDateRange,
  formatMatchDateTime,
  matchLabel,
} from './pollHelpers'
import { CoveredByNote } from './CoveredByNote'

// Moved from the deleted SectionAvailabilityRounds.tsx with unchanged behaviour (docs/specs/064-
// unified-availability-polls.md) except that an already-covered match's link now follows
// existingPollType/existingPollId/existingPollLabel (either poll kind can cover a match).
//
// One proposed group per SectionAvailabilityFixtureGroupResolver's own clustering - an editable
// description, an Autoclose toggle with a live-recomputed close-time preview, an
// uncheck-to-exclude match list (an already-polled match can't be checked at all), and the
// group's own "Open poll" action. Owns its own local selection/description/autoClose state,
// initialized from the group prop once.
export function FixtureGroupCard({
  clubId,
  sectionId,
  group,
  highlightMatchId,
  onCreated,
}: {
  clubId: string
  sectionId: string
  group: SectionAvailabilityFixtureGroup
  // ?matchId= from MatchFormPage's shortcut - the group containing it is outlined so the manager
  // lands on the right card; the match itself is already ticked (every uncovered match starts so).
  highlightMatchId?: string | null
  onCreated: () => void
}) {
  const [description, setDescription] = useState(group.suggestedDescription)
  const [autoClose, setAutoClose] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(group.matches.filter((match) => !match.alreadyPolled).map((match) => match.matchId)),
  )

  const createMutation = useMutation({
    mutationFn: () =>
      createRound(clubId, {
        sectionId,
        description: description.trim(),
        matchIds: Array.from(selectedIds),
        autoClose,
      }),
    onSuccess: onCreated,
  })

  const toggleMatch = (matchId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(matchId)) {
        next.delete(matchId)
      } else {
        next.add(matchId)
      }
      return next
    })
  }

  const scheduledCloseAt = autoClose ? computeScheduledCloseAt(group.matches, selectedIds) : null
  const canSubmit = selectedIds.size > 0 && description.trim().length > 0 && !createMutation.isPending
  const highlighted = Boolean(highlightMatchId) && group.matches.some((match) => match.matchId === highlightMatchId)

  return (
    <Card variant="outlined" sx={highlighted ? { borderColor: 'primary.main', borderWidth: 2 } : undefined}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" useFlexGap spacing={1}>
          <Typography variant="subtitle1" fontWeight={600}>
            {formatDateRange(group.startDate, group.endDate)}
          </Typography>
          <Chip size="small" label={`${group.matches.length} fixture${group.matches.length === 1 ? '' : 's'}`} />
        </Stack>

        <Input label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />

        <Stack spacing={0.5}>
          <FormControlLabel
            control={<Switch checked={autoClose} onChange={(event) => setAutoClose(event.target.checked)} />}
            label="Autoclose"
          />
          {autoClose && scheduledCloseAt && (
            <Typography variant="caption" color="text.secondary">
              Automatically closes {formatCloseTime(scheduledCloseAt)} - 24 hours before the earliest selected fixture.
            </Typography>
          )}
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          {group.matches.map((match) => (
            <Stack
              key={match.matchId}
              direction="row"
              alignItems="flex-start"
              spacing={1}
              sx={{ opacity: match.alreadyPolled ? 0.6 : 1 }}
            >
              <Checkbox
                checked={selectedIds.has(match.matchId)}
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
                  {match.leagueName ? ` - ${match.leagueName}` : ''}
                </Typography>
                <CoveredByNote match={match} />
              </Stack>
            </Stack>
          ))}
        </Stack>

        {createMutation.isError && (
          <Alert severity="error">
            {errorDetail(createMutation.error, 'Something went wrong opening this poll. Please try again.')}
          </Alert>
        )}

        <Box>
          <Button disabled={!canSubmit} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Opening…' : `Open poll for ${selectedIds.size} selected fixture${selectedIds.size === 1 ? '' : 's'}`}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}
