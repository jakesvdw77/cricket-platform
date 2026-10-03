import { Box, Divider, Stack, Typography } from '@mui/material'
import type { SelectionRow } from './matchCardHelpers'

export interface SelectionBlockProps {
  rows: SelectionRow[]
}

// docs/specs/069-match-card-redesign.md: how many players are picked for each of the club's teams
// in a match, out of the league's playing XI size. The bar mirrors SlotSummary's (rounded track,
// solid fill); with no league (playingXiSize null) a row is just "N picked" with no bar.
export function SelectionBlock({ rows }: SelectionBlockProps) {
  return (
    <Stack spacing={1.5} data-testid="selection-block">
      <Divider />
      <Typography variant="subtitle2" component="h4" fontWeight={700}>
        Selection
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Neither side is one of your teams, so there is nobody to pick.
        </Typography>
      ) : (
        rows.map((row, index) => <SelectionRowView key={`${index}-${row.teamName}`} row={row} />)
      )}
    </Stack>
  )
}

function SelectionRowView({ row }: { row: SelectionRow }) {
  const { teamName, picked, playingXiSize } = row
  if (playingXiSize === null) {
    return (
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {teamName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {picked} picked
        </Typography>
      </Stack>
    )
  }

  const complete = picked >= playingXiSize
  const percent = playingXiSize > 0 ? Math.min(100, (picked / playingXiSize) * 100) : 0
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {teamName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {picked} of {playingXiSize} picked
        </Typography>
      </Stack>
      <Box
        role="progressbar"
        aria-label={`${teamName} selection`}
        aria-valuemin={0}
        aria-valuemax={playingXiSize}
        aria-valuenow={Math.min(picked, playingXiSize)}
        aria-valuetext={`${picked} of ${playingXiSize} picked`}
        sx={{ height: 10, borderRadius: 6, overflow: 'hidden', bgcolor: 'grey.400' }}
      >
        <Box data-testid="selection-bar-fill" sx={{ width: `${percent}%`, height: '100%', bgcolor: 'primary.main' }} />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {complete ? 'squad complete' : `${picked} picked · ${playingXiSize - picked} to go`}
      </Typography>
    </Stack>
  )
}
