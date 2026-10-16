import { Box, Button as MuiButton, Typography } from '@mui/material'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { PLAYING_CONDITIONS_PDF_NAME } from '../../api/leaguePlayingConditionsApi'
import type { LeaguePlayingConditions } from '../../api/leaguePlayingConditionsApi'
import { resolveEffectiveMaxOversPerBowler } from '../../utils/playingConditions'

export interface PlayingConditionsSummaryProps {
  leagueName: string
  // The season's label; left out when it is not known.
  seasonLabel?: string | null
  // null when none are on file for this league and season.
  conditions: LeaguePlayingConditions | null
  // The overs of the result being looked at; a different figure from the league's maximum gets a plain notice.
  scheduledOvers?: number | null
}

const overs = (value: number): string => String(Math.round(value * 100) / 100)

// docs/specs/104-match-results-import-adaptors.md (the capture wizard's Review step): a compact, read-only view of one
// league and season's playing conditions, headed by which league's rules they are. The blank per-bowler maximum shows as
// "Auto (N)" using the same helper as the league's conditions form.
export function PlayingConditionsSummary({ leagueName, seasonLabel, conditions, scheduledOvers = null }: PlayingConditionsSummaryProps) {
  const structured = conditions !== null && conditions.maxOversPerInnings != null
  const documentUrl = conditions?.documentUrl ?? null
  const leagueOvers = conditions?.maxOversPerInnings ?? null
  const mismatch = scheduledOvers !== null && leagueOvers !== null && scheduledOvers !== leagueOvers

  const perBowler = structured
    ? conditions.maxOversPerBowler != null
      ? String(conditions.maxOversPerBowler)
      : `Auto (${resolveEffectiveMaxOversPerBowler(conditions.maxOversPerInnings, null)})`
    : null

  const rows: Array<[string, string | null]> = structured
    ? [
        ['Max overs per innings', String(conditions.maxOversPerInnings)],
        ['Powerplay overs', conditions.powerplayOvers != null ? String(conditions.powerplayOvers) : null],
        ['Max overs per bowler', perBowler],
        ['Substitutions allowed', conditions.allowSubstitutions ? 'Yes' : 'No'],
      ]
    : []

  return (
    <Box data-testid="playing-conditions-summary" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <Box>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
          {leagueName}
        </Typography>
        {seasonLabel && (
          <Typography variant="body2" color="text.secondary">
            {seasonLabel}
          </Typography>
        )}
      </Box>

      {mismatch && (
        <Box role="note" sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', border: 1, borderColor: 'divider', borderRadius: 2, p: 1.25, bgcolor: 'background.default' }}>
          <InfoOutlinedIcon aria-hidden fontSize="small" sx={{ flex: 'none', color: 'text.secondary' }} />
          <Typography variant="body2">
            This result is {overs(scheduledOvers as number)} overs; this league plays {leagueOvers}.
          </Typography>
        </Box>
      )}

      {!structured && !documentUrl && (
        <Typography variant="body2" color="text.secondary">
          No playing conditions are on file for this league and season.
        </Typography>
      )}

      {structured && (
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 16px' }}>
          {rows.map(([label, value]) => (
            <Box key={label} sx={{ minWidth: 0 }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
                {value ?? 'Not set'}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {structured && conditions.fieldingRestrictionsNotes && (
        <Box>
          <Typography variant="caption" color="text.secondary" component="div">
            Fielding restrictions
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
            {conditions.fieldingRestrictionsNotes}
          </Typography>
        </Box>
      )}

      {structured && conditions.additionalNotes && (
        <Box>
          <Typography variant="caption" color="text.secondary" component="div">
            Additional notes
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
            {conditions.additionalNotes}
          </Typography>
        </Box>
      )}

      {documentUrl && (
        <MuiButton
          variant="outlined"
          startIcon={<DescriptionOutlinedIcon fontSize="small" />}
          component="a"
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          {PLAYING_CONDITIONS_PDF_NAME}
        </MuiButton>
      )}
    </Box>
  )
}
