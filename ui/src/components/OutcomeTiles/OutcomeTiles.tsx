import { Typography } from '@mui/material'
import { TileChoiceGroup } from '../TileChoiceGroup'
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
const OPTIONS = OUTCOME_TILES.map((tile) => ({
  value: tile.value,
  content: (
    <>
      <Typography variant="body2" fontWeight={700} component="span">
        {tile.label}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="span">
        {tile.hint}
      </Typography>
    </>
  ),
}))

export function OutcomeTiles({ value, onChange, disabled = false }: OutcomeTilesProps) {
  return (
    <TileChoiceGroup
      label="How did the match end?"
      options={OPTIONS}
      value={value}
      onChange={onChange}
      disabled={disabled}
      columns={{ xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' }}
      tileSx={{ flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', textAlign: 'left', minHeight: 56, py: 1.25 }}
    />
  )
}
