import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { BRAND } from '../../brandTokens'
import { dotCentres, overBlocks } from './drawingMath'

export interface OverBlocksProps {
  // Legal balls bowled in the spell(s) and the match's balls per over (6, or 8 in some leagues).
  balls: number
  ballsPerOver: number
  wickets: number
  maidens: number
  blockColour?: string
  wicketColour?: string
  maidenColour?: string
  textColour?: string
}

const WIDTH = 300
const BLOCK_Y = 8
const BLOCK_H = 26
const DOT_R = 9

// docs/specs/145: a bowling spell as one block per over, then a row of gold dots for the wickets and sand rings for the maidens
// (the scorecard keeps totals, not the over each wicket fell in, so the dots are not placed under an over). Our own SVG, no chart
// library; the text alternative carries every figure.
export function OverBlocks({
  balls,
  ballsPerOver,
  wickets,
  maidens,
  blockColour = alpha(BRAND.cream, 0.22),
  wicketColour = BRAND.gold,
  maidenColour = BRAND.sand,
  textColour = alpha(BRAND.cream, 0.66),
}: OverBlocksProps) {
  const perOver = ballsPerOver > 0 ? ballsPerOver : 6
  const blocks = overBlocks(balls, perOver, WIDTH)
  const wicketCentres = dotCentres(wickets, WIDTH / 2, DOT_R)
  const maidenCentres = dotCentres(maidens, WIDTH / 2 - DOT_R, DOT_R)
  const overs = `${Math.floor(balls / perOver)}${balls % perOver ? `.${balls % perOver}` : ''}`
  const label = `${overs} overs bowled, ${maidens} ${maidens === 1 ? 'maiden' : 'maidens'}, ${wickets} ${wickets === 1 ? 'wicket' : 'wickets'}`
  const rowY = BLOCK_Y + BLOCK_H + 16
  return (
    <Box component="svg" viewBox={`0 0 ${WIDTH} 76`} role="img" aria-label={label} data-testid="over-blocks" sx={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block', overflow: 'visible' }}>
      {blocks.map((block, index) => (
        <g key={index}>
          <rect x={block.x} y={BLOCK_Y} width={block.width} height={BLOCK_H} rx={7} fill={alpha(BRAND.cream, 0.1)} />
          <rect x={block.x} y={BLOCK_Y} width={Math.max(block.width * block.fill, 0)} height={BLOCK_H} rx={7} fill={blockColour} />
        </g>
      ))}
      {wicketCentres.map((cx) => (
        <circle key={`w${cx}`} cx={cx} cy={rowY} r={DOT_R} fill={wicketColour} />
      ))}
      {maidenCentres.map((cx) => (
        <circle key={`m${cx}`} cx={cx + WIDTH / 2} cy={rowY} r={DOT_R - 1.5} fill="none" stroke={maidenColour} strokeWidth={2.5} />
      ))}
      <text x="0" y="70" fontSize="13" fill={textColour} aria-hidden>
        each block is an over{wickets > 0 ? ' · gold = a wicket' : ''}{maidens > 0 ? ' · ring = a maiden' : ''}
      </text>
    </Box>
  )
}
