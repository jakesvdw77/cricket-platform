import { useId } from 'react'
import { Box, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import type { Innings } from '../../../../api/matchResultApi'
import { OversInput } from '../../../../components/OversInput'
import { GridNumberInput } from '../../../../components/ScorecardGrid'
import { ballsToOvers } from '../../../../utils/oversFormat'

export interface InningsSummaryCardProps {
  // Whose innings these figures are ("Irene Villagers 1", "Opposition").
  teamName: string
  // The innings from the draft: the very object the Scores step edits.
  innings: Innings
  ballsPerOver: number
  onChange: (patch: Partial<Innings>) => void
  disabled?: boolean
}

const MAX_WICKETS = 10

// docs/specs/101-match-results-our-side-scorecard.md: the innings the scorecard is checked against, shown at the top of
// Our batting and Our bowling and fielding with its figures editable in place ("Correct score"). It changes the SAME draft
// innings as the Scores step (no copy), so the wickets meter, the totals strips and the not-out fill follow live, and
// Review revalidates the corrected figures when it opens.
export function InningsSummaryCard({ teamName, innings, ballsPerOver, onChange, disabled = false }: InningsSummaryCardProps) {
  const id = useId()
  const summary =
    innings.runs === null
      ? 'No score entered'
      : `${innings.runs} / ${innings.wickets ?? '–'}${innings.balls !== null ? ` in ${ballsToOvers(innings.balls, ballsPerOver)} overs` : ''}`
  const field = (label: string, control: React.ReactNode, htmlFor?: string) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography component="label" htmlFor={htmlFor} variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        {label}
      </Typography>
      {control}
    </Box>
  )
  return (
    <Box
      role="group"
      aria-label={`${teamName} innings`}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 0, overflowWrap: 'anywhere' }}>
          {teamName}: {summary}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <EditOutlinedIcon sx={{ fontSize: 14 }} aria-hidden /> Correct the score here if it was wrong
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, flexWrap: 'wrap' }}>
        {field(
          'Runs',
          <GridNumberInput id={`${id}-runs`} value={innings.runs} onChange={(runs) => onChange({ runs })} ariaLabel={`Runs, ${teamName} innings`} column="innings-runs" disabled={disabled} width={72} />,
          `${id}-runs`,
        )}
        {field(
          'Wickets',
          <GridNumberInput
            id={`${id}-wickets`}
            value={innings.wickets}
            onChange={(wickets) => onChange({ wickets })}
            ariaLabel={`Wickets, ${teamName} innings`}
            column="innings-wickets"
            max={MAX_WICKETS}
            disabled={disabled}
            width={72}
          />,
          `${id}-wickets`,
        )}
        <Box sx={{ width: 120 }}>
          <OversInput label={`Overs, ${teamName} innings`} value={innings.balls ?? null} onChange={(balls) => onChange({ balls })} ballsPerOver={ballsPerOver} disabled={disabled} />
        </Box>
      </Box>
    </Box>
  )
}
