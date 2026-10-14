import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { Button } from '../../../../components/Button'

// docs/specs/101-match-results-our-side-scorecard.md: shown right next to a figure the manager edited away from what the
// scorecard (or the scores) calculate: "Edited. Calculated: 187" with a visible Reset that hands the figure back.
export function CorrectedChip({ calculatedText, onReset, disabled, label }: { calculatedText: string; onReset: () => void; disabled?: boolean; label: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        borderRadius: 1,
        px: 0.75,
        bgcolor: (theme: Theme) => alpha(theme.palette.warning.main, 0.12),
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.dark' }}>
        Edited. Calculated: {calculatedText}
      </Typography>
      <Button
        variant="secondary"
        size="sm"
        aria-label={`Reset ${label} to calculated`}
        onClick={onReset}
        disabled={disabled}
        sx={{ minHeight: { xs: 44, sm: 24 }, py: 0, px: 1, fontSize: 12 }}
      >
        Reset
      </Button>
    </Box>
  )
}
