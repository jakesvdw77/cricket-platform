import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { BRAND, STATS_SERIES } from '../../brandTokens'
import { useFaceTabIndex } from '../FlipCard'
import { donutArcs } from './statsMath'

export interface DonutSlice {
  key: string
  label: string
  value: number
  // A colour from the stats tones; omitted, the series order is used.
  colour?: string
  // The drill this slice opens.
  href?: string
}

export interface DonutProps {
  slices: DonutSlice[]
  // The text alternative (the card's back repeats it as text).
  alt: string
  // The big figure and its caption in the hole ("12", "dismissals").
  centre?: string
  centreCaption?: string
  size?: number
}

// docs/specs/147: a donut of counts (how a batter gets out, how a bowler takes wickets), our own SVG. A slice is a link only when it has a
// drill; a zero slice is not drawn. The legend below is real text so colour is never the only cue.
export function Donut({ slices, alt, centre, centreCaption, size = 150 }: DonutProps) {
  const tabIndex = useFaceTabIndex()
  const c = 60
  const arcs = donutArcs(slices.map((slice) => slice.value), c, c, 56, 36)
  const shown = slices.map((slice, index) => ({ slice, arc: arcs[index], colour: slice.colour ?? STATS_SERIES[index % STATS_SERIES.length] }))
  return (
    <Box data-testid="donut" sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
      <Box component="svg" viewBox="0 0 120 120" role="group" aria-label={alt} sx={{ width: size, height: size, flexShrink: 0, '& a': { outline: 'none' }, '& a:focus-visible path': { stroke: BRAND.cream, strokeWidth: 3 } }}>
        <title>{alt}</title>
        {shown.length === 0 || shown.every((s) => s.arc === null) ? <circle cx={c} cy={c} r={46} fill="none" stroke={alpha(BRAND.cream, 0.2)} strokeWidth={20} /> : null}
        {shown.map(({ slice, arc, colour }) =>
          arc === null ? null : slice.href ? (
            <Link key={slice.key} to={slice.href} aria-label={`${slice.label}: ${slice.value}`} tabIndex={tabIndex} data-testid="donut-slice">
              <path d={arc.path} fill={colour} />
            </Link>
          ) : (
            <path key={slice.key} d={arc.path} fill={colour} data-testid="donut-slice" />
          ),
        )}
        {centre && (
          <text x={c} y={centreCaption ? c + 2 : c + 8} textAnchor="middle" fontSize="26" fontWeight="700" fill={BRAND.cream} aria-hidden>
            {centre}
          </text>
        )}
        {centre && centreCaption && (
          <text x={c} y={c + 16} textAnchor="middle" fontSize="9" fill={alpha(BRAND.cream, 0.66)} aria-hidden>
            {centreCaption}
          </text>
        )}
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5, fontSize: 14, minWidth: 0 }}>
        {shown.filter(({ arc }) => arc !== null).map(({ slice, colour }) => (
          <Box component="li" key={slice.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box aria-hidden component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colour, flexShrink: 0 }} />
            <span>{slice.label}</span>
            <Box component="span" sx={{ ml: 'auto', pl: 1.5, fontWeight: 700 }}>{slice.value}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
