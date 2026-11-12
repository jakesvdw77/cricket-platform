import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import { BRAND, STATS_COLOUR } from '../../brandTokens'
import { useFaceTabIndex } from '../FlipCard'
import { fluid } from '../StatsCards/statsCardStyle'
import { donutArcs } from './statsMath'

export interface DonutSlice {
  key: string
  label: string
  value: number
  // A colour override; omitted, the tonal ramp is used, largest slice first (spec 147 colour rule).
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
export function Donut({ slices, alt, centre, centreCaption, size = 120 }: DonutProps) {
  const tabIndex = useFaceTabIndex()
  // The hole text is sized in viewBox units; the drawing is `size` px on a card and up to 280 px expanded (the scale variable).
  const px = Math.min(size, 120)
  const unit = 120 / px
  const c = 60
  const arcs = donutArcs(slices.map((slice) => slice.value), c, c, 56, 36)
  // The ramp goes by size, not by position: the largest slice gets the first (strongest) shade; ties keep their order.
  const rank = slices.map((slice, index) => slices.filter((other, otherIndex) => other.value > slice.value || (other.value === slice.value && otherIndex < index)).length)
  const shown = slices.map((slice, index) => ({ slice, arc: arcs[index], colour: slice.colour ?? STATS_COLOUR.ramp[rank[index] % STATS_COLOUR.ramp.length] }))
  return (
    <Box data-testid="donut" sx={{ display: 'flex', alignItems: 'center', columnGap: fluid(12, 32), rowGap: 1, flexWrap: 'wrap', minWidth: 0 }}>
      <Box component="svg" viewBox="0 0 120 120" role="group" aria-label={alt} sx={{ width: `calc(${px}px + ${280 - px}px * (var(--stats-scale, 1) - 1) / 0.6)`, height: `calc(${px}px + ${280 - px}px * (var(--stats-scale, 1) - 1) / 0.6)`, flexShrink: 0, '& a': { outline: 'none' }, '& a:focus-visible path': { stroke: BRAND.cream, strokeWidth: 2 } }}>
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
          <text x={c} y={centreCaption ? c + unit : c + 7 * unit} textAnchor="middle" fontSize={20 * unit} fontWeight="700" fill={BRAND.cream} aria-hidden>
            {centre}
          </text>
        )}
        {centre && centreCaption && (
          <text x={c} y={c + 15 * unit} textAnchor="middle" fontSize={11 * unit} fill={alpha(BRAND.cream, 0.66)} aria-hidden>
            {centreCaption}
          </text>
        )}
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: fluid(2, 8), fontSize: fluid(13, 16), minWidth: 0 }}>
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
