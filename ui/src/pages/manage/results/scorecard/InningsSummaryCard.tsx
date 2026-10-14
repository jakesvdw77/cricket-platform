import { useState } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import type { Innings } from '../../../../api/matchResultApi'
import { Button } from '../../../../components/Button'
import { Input } from '../../../../components/Input'
import { OversInput } from '../../../../components/OversInput'
import { badgeSx } from '../../../../components/RecordCard'
import { ballsToOvers } from '../../../../utils/oversFormat'
import { CorrectedChip } from './CorrectedChip'
import { figureCorrected } from '../scorecardDraft'
import type { InningsFigure, InningsSuggestion } from '../scorecardDraft'

export interface InningsSummaryCardProps {
  // Whose innings these figures are, for the accessible names ("Irene Villagers 1", "Riverside").
  teamName: string
  // The line's lead-in when it differs from the team name ("Opposition: Riverside").
  title?: string
  // The innings from the draft: the very object the Scores step edits.
  innings: Innings
  ballsPerOver: number
  // What the scorecard adds up to: runs, wickets and balls follow it until the manager types their own figure.
  calculated?: InningsSuggestion
  // The manager types a figure (it becomes theirs, "Edited") and hands it back to the scorecard.
  onEdit: (field: InningsFigure, value: number | null) => void
  onUseCalculated: (field: InningsFigure) => void
  disabled?: boolean
}

const MAX_WICKETS = 10
const FIGURES = ['runs', 'wickets', 'balls'] as const

const toInt = (text: string): number | null => (text.trim() === '' || !/^\d+$/.test(text.trim()) ? null : Number(text.trim()))

// docs/specs/101-match-results-our-side-scorecard.md: the innings the scorecard is checked against, one quiet line at the
// top of Our batting and Our bowling and fielding: "Team: 212 / 6 in 38.4 overs", a Calculated / Edited chip and Edit. Edit
// opens one row of three equal fields (Runs, Wickets, Overs) that change the SAME draft innings as the Scores step. It
// starts open only when a figure was edited or the score cannot be worked out from the scorecard yet.
export function InningsSummaryCard({ teamName, title, innings, ballsPerOver, calculated, onEdit, onUseCalculated, disabled = false }: InningsSummaryCardProps) {
  const correctedFields = FIGURES.filter((field) => calculated?.[field] != null && figureCorrected(innings, field, calculated[field]))
  const derivable = calculated?.runs != null
  const [open, setOpen] = useState(correctedFields.length > 0 || (innings.runs === null && !derivable))
  const follows = derivable && innings.runs !== null && correctedFields.length === 0 && innings.runsCorrected === false
  const summary =
    innings.runs === null
      ? 'No score entered'
      : `${innings.runs} / ${innings.wickets ?? '–'}${innings.balls !== null ? ` in ${ballsToOvers(innings.balls, ballsPerOver)} overs` : ''}`
  const show = (field: InningsFigure, value: number) => (field === 'balls' ? `${ballsToOvers(value, ballsPerOver)} overs` : String(value))

  return (
    <Box
      role="group"
      aria-label={`${teamName} innings`}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', px: 1.5, py: 0.75, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minHeight: 36 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 0, flex: '1 1 auto', overflowWrap: 'anywhere' }}>
          {title ?? teamName}: {summary}
        </Typography>
        {correctedFields.length > 0 ? (
          <Chip size="small" label="Edited" sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.7rem' }} />
        ) : follows ? (
          <Chip size="small" label="Calculated" sx={{ ...badgeSx('neutral'), height: 20, fontSize: '0.7rem' }} />
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-label={open ? `Done editing the ${teamName} innings` : `Edit the ${teamName} innings`}
          onClick={() => setOpen((value) => !value)}
          sx={{ minHeight: { xs: 44, sm: 30 }, ml: 'auto' }}
        >
          {open ? 'Done' : 'Edit'}
        </Button>
      </Box>

      {open && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pb: 0.75 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, 150px)' }, gap: 1.25, alignItems: 'start' }}>
            <Input
              label="Runs"
              value={innings.runs ?? ''}
              onChange={(event) => onEdit('runs', toInt(event.target.value))}
              disabled={disabled}
              inputProps={{ inputMode: 'numeric', 'aria-label': `Runs, ${teamName} innings` }}
            />
            <Input
              label="Wickets"
              value={innings.wickets ?? ''}
              onChange={(event) => {
                const next = toInt(event.target.value)
                onEdit('wickets', next === null ? null : Math.min(next, MAX_WICKETS))
              }}
              disabled={disabled}
              inputProps={{ inputMode: 'numeric', 'aria-label': `Wickets, ${teamName} innings` }}
            />
            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
              <OversInput
                label="Overs"
                ariaLabel={`Overs, ${teamName} innings`}
                value={innings.balls ?? null}
                onChange={(balls) => onEdit('balls', balls)}
                ballsPerOver={ballsPerOver}
                disabled={disabled}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {correctedFields.length > 0 ? (
              correctedFields.map((field) => (
                <CorrectedChip
                  key={field}
                  label={`${field === 'balls' ? 'overs' : field}, ${teamName} innings`}
                  calculatedText={show(field, calculated?.[field] as number)}
                  onReset={() => onUseCalculated(field)}
                  disabled={disabled}
                />
              ))
            ) : follows ? (
              <Typography variant="caption" color="text.secondary">
                Calculated from the scorecard
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Type the score, or fill in the scorecard and it is worked out for you.
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}
