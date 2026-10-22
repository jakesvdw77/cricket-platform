import { useId } from 'react'
import { alpha } from '@mui/material/styles'
import { patternId, useChartPalette } from './chartStyles'
import type { CategoryStyle, PatternKind } from './chartStyles'

// One <pattern>: the tone as stripes / dots on a light tint of itself. Rendered inside an <svg><defs>.
export function ChartPatternDef({ id, color, kind }: { id: string; color: string; kind: PatternKind }) {
  if (kind === 'solid') return null
  const tint = alpha(color, 0.3)
  if (kind === 'dots') {
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill={tint} />
        <circle cx="3" cy="3" r="1.4" fill={color} />
      </pattern>
    )
  }
  const rotation = kind === 'diagonal' ? 45 : kind === 'horizontal' ? 90 : 0
  if (kind === 'cross') {
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill={tint} />
        <rect width="2" height="6" fill={color} />
        <rect width="6" height="2" fill={color} />
      </pattern>
    )
  }
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform={`rotate(${rotation})`}>
      <rect width="6" height="6" fill={tint} />
      <rect width="3" height="6" fill={color} />
    </pattern>
  )
}

// A small legend / tooltip swatch carrying the same pattern as the chart, with its own <defs> (decorative).
export function PatternSwatch({ style, size = 14 }: { style: CategoryStyle; size?: number }) {
  const palette = useChartPalette()
  const id = patternId(useId(), 'swatch')
  const color = palette.tones[style.tone]
  const fill = style.pattern === 'solid' ? color : `url(#${id})`
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden focusable="false" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <ChartPatternDef id={id} color={color} kind={style.pattern} />
      </defs>
      <rect x="0.5" y="0.5" width={size - 1} height={size - 1} rx="2" fill={fill} stroke={style.tone === 'grey' ? palette.axisText : color} strokeWidth="1" strokeDasharray={style.tone === 'grey' ? '2 2' : undefined} />
    </svg>
  )
}
