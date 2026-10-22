import { Box } from '@mui/material'
import { PatternSwatch } from '../chartPatterns'
import { useChartPalette } from '../chartStyles'
import type { CategoryStyle, ChartTone } from '../chartStyles'

export type LineMarkerShape = 'circle' | 'square' | 'diamond' | 'triangle'

export interface ChartLegendItem {
  key: string
  label: string
  // a filled, patterned swatch (bars, slices)
  style?: CategoryStyle
  // a line swatch (line charts, reference lines); `marker` adds the point shape
  line?: { tone: ChartTone; dashed?: boolean; marker?: LineMarkerShape }
}

function LineSwatch({ line }: { line: NonNullable<ChartLegendItem['line']> }) {
  const palette = useChartPalette()
  const color = line.tone === 'grey' ? palette.text : palette.tones[line.tone]
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden focusable="false" style={{ flex: 'none', display: 'block' }}>
      <line x1="0" y1="6" x2="22" y2="6" stroke={color} strokeWidth="2" strokeDasharray={line.dashed ? '5 3' : undefined} />
      {line.marker && <MarkerShape shape={line.marker} cx={11} cy={6} color={color} fill={palette.paper} />}
    </svg>
  )
}

// A point marker; the shape (never the colour alone) tells the series apart.
export function MarkerShape({ shape, cx, cy, color, fill, size = 4 }: { shape: LineMarkerShape; cx: number; cy: number; color: string; fill: string; size?: number }) {
  const common = { fill, stroke: color, strokeWidth: 2 }
  if (shape === 'square') return <rect x={cx - size} y={cy - size} width={size * 2} height={size * 2} {...common} />
  if (shape === 'diamond') return <polygon points={`${cx},${cy - size - 1} ${cx + size + 1},${cy} ${cx},${cy + size + 1} ${cx - size - 1},${cy}`} {...common} />
  if (shape === 'triangle') return <polygon points={`${cx},${cy - size - 1} ${cx + size + 1},${cy + size} ${cx - size - 1},${cy + size}`} {...common} />
  return <circle cx={cx} cy={cy} r={size} {...common} />
}

export interface ChartLegendProps {
  items: ChartLegendItem[]
  // the legend's accessible name ("Extras types")
  label?: string
}

// docs/specs/117-stats-dashboard.md: a text legend with a patterned swatch per entry, so the legend never relies on colour alone.
// Library-free and decorative for the chart, the table alternative carries the values.
export function ChartLegend({ items, label }: ChartLegendProps) {
  return (
    <Box component="ul" aria-label={label} data-testid="chart-legend" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '0.75rem', color: 'text.secondary' }}>
      {items.map((item) => (
        <Box component="li" key={item.key} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.625 }}>
          {item.style && <PatternSwatch style={item.style} />}
          {item.line && <LineSwatch line={item.line} />}
          {item.label}
        </Box>
      ))}
    </Box>
  )
}
