import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { STATS_COLOUR } from '../../../../brandTokens'
import { STATS_TYPE, STATS_UI, fluid } from '../../../../components/StatsCards'
import type { CardCtx } from '../../../../components/StatsCards'
import type { MyTeamResultCode, MyTeamResultPoint } from '../../../../api/meStatsApi'
import { FaceTable, Note } from './cardParts'
import { dayText } from './statsFormat'
import { RESULT_LETTER, RESULT_WORD, matchLabel, resultColour } from './teamKit'

// docs/specs/147 Amendment 3: the few React pieces several Team stats cards share, so a card file holds only its content. None of them knows
// the whole payload and none works out a figure.

// "Won" / "Lost" in the result colour, always as a word beside the colour.
export function ResultCell({ result, forfeit = false }: { result: MyTeamResultCode; forfeit?: boolean }) {
  return (
    <Box component="span" sx={{ color: resultColour(result) === STATS_COLOUR.bar ? STATS_UI.cream : resultColour(result), fontWeight: 700 }}>
      {RESULT_LETTER[result]}
      {forfeit ? '*' : ''}
      <Box component="span" sx={{ fontWeight: 400, ml: '4px', color: STATS_UI.muted }}>{RESULT_WORD[result]}</Box>
    </Box>
  )
}

// A small swatch legend under a result-coloured chart: win green, loss coral, anything else sand.
export function ResultLegend() {
  const item = (colour: string, text: string) => (
    <Box component="span" key={text} sx={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <Box aria-hidden component="span" sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: colour }} />
      {text}
    </Box>
  )
  return (
    <Typography component="div" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: '12px', fontSize: fluid(STATS_TYPE.hint, STATS_TYPE.footerExpanded), lineHeight: 1.3, color: STATS_UI.muted, m: 0 }}>
      {item(STATS_COLOUR.good, 'Won')}
      {item(STATS_COLOUR.bad, 'Lost')}
      {item(STATS_COLOUR.bar, 'Tied or other')}
    </Typography>
  )
}

// The back table of a per-match story: newest first, the match as the first column (a link to its Result page), the latest `limit` only.
export function MatchTable({ label, heads, points, cells, ctx, limit = 8 }: { label: string; heads: string[]; points: MyTeamResultPoint[]; cells: (point: MyTeamResultPoint) => ReactNode[]; ctx: CardCtx; limit?: number }) {
  return (
    <>
      <FaceTable
        label={label}
        heads={heads}
        rows={points.slice(0, limit).map((point, index) => ({
          key: `${point.matchId}-${index}`,
          cells: [matchLabel(point), ...cells(point)],
          href: ctx.resultHref(point.matchId),
          linkName: `Open the match of ${dayText(point.matchDate)}`,
        }))}
      />
      {points.length > limit && <Note>The latest {limit} of {points.length} matches.</Note>}
    </>
  )
}
