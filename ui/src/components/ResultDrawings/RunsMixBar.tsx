import { Box } from '@mui/material'
import { alpha, keyframes } from '@mui/material/styles'
import { BRAND } from '../../brandTokens'
import { roundedRectPath, runsMixSplit, segmentOffsets, segmentWidths } from './drawingMath'

export interface RunsMixBarProps {
  runs: number
  fours: number
  sixes: number
  // Colours default to the brand tokens (gold for fours, light gold for sixes, faint cream for the rest, cream for the caption).
  foursColour?: string
  sixesColour?: string
  restColour?: string
  textColour?: string
}

const WIDTH = 300
const BAR_Y = 6
const BAR_H = 26
const GAP = 3
const RADIUS = 8

const grow = keyframes`from { transform: scaleX(0); } to { transform: scaleX(1); }`

// docs/specs/145: how a batting score was made, one bar split into runs from fours, from sixes, and ones and twos, with a
// caption. Our own SVG (no chart library). The drawing grows once on load unless the person prefers reduced motion.
export function RunsMixBar({ runs, fours, sixes, foursColour = BRAND.gold, sixesColour = BRAND.goldLight, restColour = alpha(BRAND.cream, 0.3), textColour = alpha(BRAND.cream, 0.66) }: RunsMixBarProps) {
  const mix = runsMixSplit(runs, fours, sixes)
  const parts = [mix.fours, mix.sixes, mix.rest]
  const widths = segmentWidths(parts, WIDTH, GAP)
  const offsets = segmentOffsets(widths, GAP)
  const colours = [foursColour, sixesColour, restColour]
  const visible = parts.map((value, index) => (value > 0 ? index : -1)).filter((index) => index >= 0)
  const caption = [
    fours > 0 ? `${fours} ${fours === 1 ? 'four' : 'fours'} = ${mix.fours}` : null,
    sixes > 0 ? `${sixes} ${sixes === 1 ? 'six' : 'sixes'} = ${mix.sixes}` : null,
    `ones and twos ${mix.rest}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const label = `Runs made: ${mix.fours} in fours, ${mix.sixes} in sixes, ${mix.rest} in ones and twos`
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${WIDTH} 64`}
      role="img"
      aria-label={label}
      data-testid="runs-mix-bar"
      sx={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block', overflow: 'visible' }}
    >
      {visible.map((index, position) => {
        const first = position === 0
        const last = position === visible.length - 1
        return (
          <Box
            component="path"
            key={index}
            d={roundedRectPath(offsets[index], BAR_Y, widths[index], BAR_H, first ? RADIUS : 2, last ? RADIUS : 2)}
            fill={colours[index]}
            sx={{
              transformBox: 'fill-box',
              transformOrigin: 'left center',
              '@media (prefers-reduced-motion: no-preference)': { animation: `${grow} .6s ease-out both` },
            }}
          />
        )
      })}
      <text x="0" y="56" fontSize="13" fill={textColour} aria-hidden>
        {caption}
      </text>
    </Box>
  )
}
