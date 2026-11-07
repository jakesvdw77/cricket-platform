import { STATS_TYPE, STATS_UI } from '../../../../../../components/StatsCards'
import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { LineChart } from '../../../../../../components/StatsDrawings'
import type { LineChartPoint } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Box, Typography } from '@mui/material'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { Big, Cap, Chips, FaceTable, Note, Split, Tiles } from '../../cardParts'
import { battingBasis } from '../../cardKit'
import { DASH, dayText, formatCount, formatDecimal, plural, scoreText } from '../../statsFormat'

// docs/specs/147 section 5, mine.season: the headline of the season. Front: runs, innings, average, strike rate, highest score, the last
// five scores; innings played, not outs and times dismissed are stated outright (Amendment 2 item 4) and the runs at home and away sit beside the headline
// (no chart: Innings charts the runs; a normal card) (item 6; a home or away side with no innings is a dash and the matches with no venue are the partial note). Back: the rolling average of
// the last five innings with the server's trend sentence. Source: batting, form, rolling, homeAway.
// The rolling average after each innings as chart points (every dot labelled with its average, a link to its match).
const averagePoints = (p: MyStatsDto, ctx: { resultHref: (matchId: string) => string }): LineChartPoint[] =>
  p.rolling.points.flatMap((point, index) =>
    point.average === null
      ? []
      : [{ key: `${point.matchId}-${index}`, value: point.average, valueLabel: formatDecimal(point.average), label: dayText(point.matchDate), href: ctx.resultHref(point.matchId), name: `Average ${formatDecimal(point.average)} after the match of ${dayText(point.matchDate)}. Open the match.` }],
  )

export const mineSeason: StatsCardDef<MyStatsDto> = {
  id: 'mine.season',
  page: 'mine',
  group: 'batting',
  title: () => 'Season in a card',
  tag: 'HAVE',
  needs: ['batting', 'form', 'rolling', 'homeAway', 'basis'],
  order: 10,
  // A normal card (the tall layout is supported but unused for now).
  whenMissing: 'hide',
  emptyText: 'Not enough innings yet.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    if (p.batting.innings === 0) return 'empty'
    return p.batting.coverage.inningsWithBalls < p.batting.coverage.inningsCounted || p.homeAway.unknownFieldMatches > 0 ? 'partial' : 'ready'
  },
  partialNote: (p) =>
    [
      p.batting.coverage.inningsWithBalls < p.batting.coverage.inningsCounted ? `SR from ${p.batting.coverage.inningsWithBalls} of ${p.batting.coverage.inningsCounted} innings.` : '',
      p.homeAway.unknownFieldMatches > 0 ? `${p.homeAway.unknownFieldMatches === 1 ? '1 match has' : `${p.homeAway.unknownFieldMatches} matches have`} no venue.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  summary: (p, ctx) =>
    `${ctx.firstName} has ${p.batting.runs} runs in ${plural(p.batting.innings, 'innings', 'innings')} (${p.batting.notOuts} not out, dismissed ${p.batting.dismissals} times), averaging ${formatDecimal(p.batting.average)}.`,
  Front: ({ payload: p, ctx }) => {
    const best = p.batting.highestScore
    const runsAt = (side: { innings: number; runs: number }) => (side.innings > 0 ? formatCount(side.runs) : DASH)
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, minWidth: 0 }}>
          <Big value={String(p.batting.runs)} caption={`runs in ${plural(p.batting.innings, 'innings', 'innings')}`} />
          <Box sx={{ width: 118, flexShrink: 0 }}>
            <Split
              columns={[
                {
                  key: 'venue',
                  title: 'Runs',
                  rows: [
                    { key: 'home', label: 'Home', swatch: STATS_COLOUR.compareFirst, value: runsAt(p.homeAway.home) },
                    { key: 'away', label: 'Away', swatch: STATS_COLOUR.compareSecond, value: runsAt(p.homeAway.away) },
                  ],
                },
              ]}
            />
          </Box>
        </Box>
        <Tiles
          dense
          min={60}
          items={[
            { key: 'innings', label: 'Innings', value: String(p.batting.innings) },
            { key: 'notouts', label: 'Not Out', value: String(p.batting.notOuts) },
            { key: 'dismissed', label: 'Dismissed', value: String(p.batting.dismissals) },
            { key: 'avg', label: 'Avg', value: formatDecimal(p.batting.average) },
          ]}
        />
        <Typography data-testid="stats-season-line" sx={{ fontSize: STATS_TYPE.body, lineHeight: 1.25, color: STATS_UI.muted, m: 0 }}>
          SR {formatDecimal(p.batting.strikeRate)} · HS {best ? scoreText(best.runs, best.notOut) : DASH}
        </Typography>
        {p.form.batting.length > 0 && (
          <Chips
            large
            lead={`Last ${Math.min(5, p.form.batting.length)}`}
            items={p.form.batting.slice(0, 5).map((entry, index) => ({
              key: `${entry.matchId}-${index}`,
              text: scoreText(entry.runs, entry.notOut),
              tone: 'neutral',
              href: ctx.resultHref(entry.matchId),
              name: `${scoreText(entry.runs, entry.notOut)}, ${dayText(entry.matchDate)}. Open the match.`,
            }))}
          />
        )}
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const { rolling } = p
    const hint = rolling.hint
    const direction = hint?.direction === 'UP' ? 'up from' : hint?.direction === 'DOWN' ? 'down from' : 'level with'
    const sentence =
      hint && hint.recent !== null
        ? `Last ${rolling.span} average ${formatDecimal(hint.recent)}${hint.earlier !== null ? `, ${direction} ${formatDecimal(hint.earlier)} earlier` : ''}. Season average ${formatDecimal(p.batting.average)}.`
        : `Season average ${formatDecimal(p.batting.average)}. The trend needs a few more innings.`
    const latest = [...rolling.points].reverse().slice(0, 5)
    return (
      <>
        <Cap>Average of the last {rolling.span} innings</Cap>
        <LineChart points={averagePoints(p, ctx)} alt={`Rolling average of the last ${rolling.span} innings for ${ctx.firstName}: ${sentence}`} />
        <Note>{sentence}</Note>
        {latest.length > 0 && (
          <FaceTable
            label="Rolling average by innings"
            heads={['Date', `Avg of last ${rolling.span}`]}
            rows={latest.map((point, index) => ({
              key: `${point.matchId}-${index}`,
              cells: [dayText(point.matchDate), formatDecimal(point.average)],
              href: ctx.resultHref(point.matchId),
              linkName: `Open the match of ${dayText(point.matchDate)}`,
            }))}
          />
        )}
      </>
    )
  },
}
