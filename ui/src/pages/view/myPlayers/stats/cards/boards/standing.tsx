import { Box, Typography } from '@mui/material'
import { STATS_UI } from '../../../../../../components/StatsCards'
import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStanding, MyStandingLine } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { cellText, minimumUnitWord, standingSampleText } from '../../boards/boardsFormat'
import { DASH, ordinal } from '../../statsFormat'
import { allowsRankings } from '../../statsRankingPolicy'

// docs/specs/147 section 5, boards.standing: the viewer's ordinal place among the players of the leaderboard reach in each line the payload has (runs, average, strike rate, wickets, economy, catches, player of the match), each with the number of players and the sample behind it. Back: the same as a table, with the minimum
// note. A line shows a rank only when the payload has one AND the ranking helper allows it (the server sends no lines when rankings are
// off). Names no other player. Source: lines, resultsCounted, playersInReach.
const ranked = (line: MyStandingLine): boolean => line.rank !== null && allowsRankings()

const rankText = (line: MyStandingLine): string => (ranked(line) ? ordinal(line.rank) : DASH)

// Front tile text: "of 18" when ranked, else why there is no rank. Labels are the payload's; a long one is shortened for the tile only.
const SHORT_LABELS: Record<string, string> = { playerOfTheMatch: 'POTM awards' }
const shortLabel = (line: MyStandingLine): string => SHORT_LABELS[line.key] ?? line.label
function tileNote(line: MyStandingLine): string {
  if (ranked(line)) return `of ${line.playersRanked}`
  return line.belowMinimum ? 'Below minimum' : 'Not ranked'
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
      ? `${ctx.firstName} is ${ordinal(runs.rank)} for runs among ${runs.playersListed} players, with ranks in more figures.`
      : `${ctx.firstName}'s place among the players in each figure.`
  },
  Front: ({ payload: p }) => (
    <Box component="ol" data-testid="standing-lines" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
      {p.lines.map((line) => (
        <Box
          component="li"
          key={line.key}
          data-testid={`standing-${line.key}`}
          title={`${line.label}: ${tileNote(line)}`}
          aria-label={`${line.label}: ${ranked(line) ? ordinal(line.rank) : DASH}, ${tileNote(line)}`}
          sx={{ display: 'grid', alignContent: 'start', justifyItems: 'center', textAlign: 'center', gap: '2px', minWidth: 0, minHeight: 78, p: '6px 2px', borderRadius: '10px', border: `1px solid ${STATS_UI.lineSoft}` }}
        >
          <Typography component="span" aria-hidden sx={{ fontFamily: STATS_UI.display, fontWeight: 700, fontSize: 24, lineHeight: 1, color: ranked(line) ? STATS_UI.gold : STATS_UI.muted }}>
            {rankText(line)}
          </Typography>
          <Typography component="span" aria-hidden sx={{ fontSize: 13, lineHeight: 1.15, fontWeight: 600, color: STATS_UI.cream, overflowWrap: 'anywhere' }}>
            {shortLabel(line)}
          </Typography>
          <Typography component="span" aria-hidden sx={{ fontSize: 12, lineHeight: 1.15, color: STATS_UI.muted }}>
            {tileNote(line)}
          </Typography>
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
