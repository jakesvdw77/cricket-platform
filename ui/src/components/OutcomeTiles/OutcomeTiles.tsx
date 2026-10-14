import { Box, ButtonBase, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { ResultOutcomeType } from '../../api/matchResultApi'

export interface OutcomeTilesProps {
  value: ResultOutcomeType | null
  onChange: (value: ResultOutcomeType) => void
  disabled?: boolean
}

const OUTCOME_TILES: { value: ResultOutcomeType; label: string; hint: string }[] = [
  { value: 'WON', label: 'Won', hint: 'One side won' },
  { value: 'TIE', label: 'Tie', hint: 'Scores level' },
  { value: 'DRAW', label: 'Draw', hint: 'Time ran out' },
  { value: 'NO_RESULT', label: 'No result', hint: 'Not enough play' },
  { value: 'ABANDONED', label: 'Abandoned', hint: 'Weather or ground' },
  { value: 'FORFEIT', label: 'Forfeit', hint: 'A side conceded' },
]

// docs/specs/100-match-results-core.md: the wizard's "How did the match end?" choice - six large tiles, one tap, a radio
// group for assistive technology. Two columns on a phone, three from sm; every tile is at least 56 px high.
export function OutcomeTiles({ value, onChange, disabled = false }: OutcomeTilesProps) {
  return (
    <Box
      role="radiogroup"
      aria-label="How did the match end?"
      sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}
    >
      {OUTCOME_TILES.map((tile) => {
        const selected = value === tile.value
        return (
          <ButtonBase
            key={tile.value}
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(tile.value)}
            sx={(theme) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              textAlign: 'left',
              minHeight: 56,
              px: 1.5,
              py: 1.25,
              borderRadius: 1,
              border: 2,
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
              '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
            })}
          >
            <Typography variant="body2" fontWeight={700} component="span">
              {tile.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="span">
              {tile.hint}
            </Typography>
          </ButtonBase>
        )
      })}
    </Box>
  )
}
