import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { Button } from '../Button'
import { WeatherBadge } from '../WeatherBadge'
import type { WeatherSummary } from '../../utils/weather/wmo'

export interface MatchWeatherDialogProps {
  open: boolean
  onClose: () => void
  // "Irene Villagers 1 v Brits" and when and where, shown above the forecast.
  title: string
  subtitle?: string
  summary: WeatherSummary | null | undefined
}

// docs/specs/137 (owner, 2026-11-05): the Show Weather Forecast item of a match menu opens this small modal: the match, the one-line forecast
// for the match hours and the plain-language lines (the same words the weather badge shows in its tooltip, here readable on a phone and on
// touch screens). Nothing is rendered without a forecast.
export function MatchWeatherDialog({ open, onClose, title, subtitle, summary }: MatchWeatherDialogProps) {
  if (!summary) return null
  const lines = summary.lines ?? []
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="match-weather-title">
      <DialogTitle id="match-weather-title">Weather Forecast</DialogTitle>
      <DialogContent>
        <Typography variant="body2" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ mb: 1.5 }}>
          <WeatherBadge summary={summary} variant="full" testId="match-weather-dialog-badge" />
        </Box>
        {lines.length > 0 && (
          <Box component="ul" aria-label="Forecast for the match hours" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
            {lines.map((line) => (
              <Box component="li" key={line} data-testid="match-weather-dialog-line" sx={{ py: 0.75, borderTop: 1, borderColor: 'divider', fontSize: 14 }}>
                {line}
              </Box>
            ))}
          </Box>
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
