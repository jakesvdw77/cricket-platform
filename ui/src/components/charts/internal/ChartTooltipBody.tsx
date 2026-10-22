// Internal to the chart wrappers (docs/standards/frontend.md four-file rule): not imported outside components/charts, and covered by the
// wrappers' own tests (BarSeriesChart, GroupedBarChart, StackedBarChart, LineSeriesChart) and chartUtils.test.tsx.
import { Box, Typography } from '@mui/material'
import { PatternSwatch } from '../chartPatterns'
import type { PointTooltip } from '../chartUtils'

// The body of a chart tooltip: the point's title and one row per figure, assembled by the page from response fields.
export function ChartTooltipBody({ data }: { data: PointTooltip }) {
  return (
    <Box sx={{ px: 1.25, py: 1, minWidth: 140, maxWidth: 220, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, boxShadow: 3 }} data-testid="chart-tooltip">
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mb: 0.25 }}>{data.title}</Typography>
      {data.rows.map((row) => (
        <Box key={row.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, fontSize: '0.75rem', lineHeight: 1.5 }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {row.style && <PatternSwatch style={row.style} size={10} />}
            {row.label}
          </Box>
          <Box component="span" sx={{ fontWeight: 600 }}>
            {row.value}
          </Box>
        </Box>
      ))}
    </Box>
  )
}

