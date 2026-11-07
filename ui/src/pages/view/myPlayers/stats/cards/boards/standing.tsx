import { Box, Typography } from '@mui/material'
import { STATS_UI } from '../../../../../../components/StatsCards'
import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStanding, MyStandingLine } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { cellText, minimumUnitWord, standingSampleText } from '../../boards/boardsFormat'
import { DASH, ordinal } from '../../statsFormat'
import { allowsRankings } from '../../statsRankingPolicy'

// docs/specs/147 section 5, boards.standing: the viewer's ordinal place among the players of the leaderboard reach in runs, batting average,
// wickets, economy and catches, each with the number of players and the sample behind it. Back: the same as a table, with the minimum
// note. A line shows a rank only when the payload has one AND the ranking helper allows it (the server sends no lines when rankings are
// off). Names no other player. Source: lines, resultsCounted, playersInReach.
const ranked = (line: MyStandingLine): boolean => line.rank !== null && allowsRankings()

const rankText = (line: MyStandingLine): string => (ranked(line) ? ordinal(line.rank) : DASH)

// "of 24 players", or "of 18 ranked, 24 listed" for a rate where some players are under the minimum.
function ofText(line: MyStandingLine): string {
  if (!ranked(line)) {
    if (line.belowMinimum && line.minimum) return `Below the minimum of ${line.minimum.value} ${minimumUnitWord(line.minimum.unit)}`
    return 'No figure yet'
  }
  return line.playersRanked === line.playersListed ? `of ${line.playersListed} players` : `of ${line.playersRanked} ranked, ${line.playersListed} listed`
}

const valueText = (line: MyStandingLine): string => cellText(line.group, line.key, line.value)

function minimumNote(lines: MyStandingLine[]): string | null {
  const rates = lines.filter((line) => line.minimum)
  if (rates.length === 0) return null
  const needs = rates.map((line) => `${line.label.toLowerCase()} needs ${line.minimum?.value} ${minimumUnitWord(line.minimum?.unit ?? 'INNINGS')}`).join(' and ')
  return `To be ranked, ${needs}. Players below the minimum are listed after the ranked players.`
}

export const boardsStanding: StatsCardDef<MyStanding> = {
  id: 'boards.standing',
  page: 'boards',
  group: 'standing',
  title: (ctx) => `Where ${ctx.firstName} stands`,
  tag: 'HAVE',
  needs: ['lines', 'resultsCounted', 'playersInReach'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No ranking yet.',
  basis: (p) => ({ counted: p.resultsCounted, total: p.resultsCounted }),
  state: (p) => {
    if (!allowsRankings() || p.lines.length === 0) return 'missing'
    if (p.lines.every((line) => line.rank === null && !line.belowMinimum)) return 'empty'
    return p.lines.some((line) => line.rank === null) ? 'partial' : 'ready'
  },
  partialNote: () => 'Some lines have no rank: a rate needs the minimum, and a figure needs a recorded result.',
  summary: (p, ctx) => {
    const runs = p.lines.find((line) => line.key === 'runs')
    return runs && ranked(runs)
      ? `${ctx.firstName} is ${ordinal(runs.rank)} for runs among ${runs.playersListed} players, with ranks in four more figures.`
      : `${ctx.firstName}'s place among the players in runs, average, wickets, economy and catches.`
  },
  Front: ({ payload: p }) => (
    <Box component="ol" data-testid="standing-lines" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: '4px' }}>
      {p.lines.map((line) => (
        <Box component="li" key={line.key} data-testid={`standing-${line.key}`} sx={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Typography component="span" sx={{ fontFamily: STATS_UI.display, fontWeight: 700, fontSize: 22, lineHeight: 1, color: ranked(line) ? STATS_UI.gold : STATS_UI.muted }}>
            {rankText(line)}
          </Typography>
          <Box sx={{ minWidth: 0, display: 'grid', gap: '1px' }}>
            <Typography component="span" sx={{ fontSize: 12, lineHeight: 1.2, fontWeight: 600, color: STATS_UI.cream }}>
              {line.label} · {valueText(line)}
            </Typography>
            <Typography component="span" sx={{ fontSize: 10.5, lineHeight: 1.2, color: STATS_UI.muted }}>
              {ofText(line)}
              {standingSampleText(line.sample, line.key) ? ` · ${standingSampleText(line.sample, line.key)}` : ''}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  ),
  Back: ({ payload: p, ctx }) => {
    const note = minimumNote(p.lines)
    return (
      <>
        <Cap>{ctx.firstName}&apos;s place in each figure</Cap>
        <FaceTable
          label={`${ctx.firstName}'s rank in each figure, with the players and sample behind it`}
          heads={['Figure', 'Rank', 'Players', 'Sample']}
          rows={p.lines.map((line) => ({
            key: line.key,
            cells: [`${line.label} ${valueText(line)}`, rankText(line), String(line.playersListed), standingSampleText(line.sample, line.key) || DASH],
          }))}
        />
        {note && <Note>{note}</Note>}
        <Note>Ties share a rank. {p.playersInReach} players are in this list in all.</Note>
      </>
    )
  },
}
