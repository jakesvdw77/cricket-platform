import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { LineChart } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { againstText, battingBasis, truncatedNote } from '../../cardKit'
import { dayText, formatDecimal, scoreText } from '../../statsFormat'

// docs/specs/147 section 5, mine.innings: runs in every innings in date order, guide lines at the server's values (30 and 50, scaled by age
// band), the running average, a hollow dot for a not out; every dot opens that match. Back: the same as a table. The guides draw reference
// lines only, they never change a counted figure. Source: series.battingInnings, series.battingTrend, guides.
const SHOWN_ROWS = 10

export const mineInnings: StatsCardDef<MyStatsDto> = {
  id: 'mine.innings',
  page: 'mine',
  group: 'batting',
  title: () => 'Innings by innings',
  tag: 'HAVE',
  needs: ['series', 'guides', 'basis'],
  order: 20,
  whenMissing: 'hide',
  emptyText: 'Not enough innings yet.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    if (p.series.battingInnings.filter((innings) => innings.runs !== null).length === 0) return 'empty'
    return p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: truncatedNote,
  summary: (p, ctx) => `A graph of ${ctx.firstName}'s runs in each of the last ${p.series.battingInnings.length} innings, with a running average.`,
  Front: ({ payload: p, ctx }) => {
    const innings = p.series.battingInnings.filter((entry) => entry.runs !== null)
    const trend = p.series.battingTrend
    const first = innings[0]
    const last = innings[innings.length - 1]
    const summary = p.series.battingSummary
    return (
      <>
        <LineChart
          alt={`${ctx.firstName}'s runs in each of ${innings.length} innings, from ${dayText(first?.matchDate)} to ${dayText(last?.matchDate)}. The table on the back has every value.`}
          points={innings.map((entry, index) => ({
            key: `${entry.matchId}-${index}`,
            value: entry.runs ?? 0,
            notOut: entry.notOut,
            href: ctx.resultHref(entry.matchId),
            name: `${scoreText(entry.runs, false)}${entry.notOut ? ' not out' : ''} ${againstText(entry.opponentName)}, ${dayText(entry.matchDate)}`,
          }))}
          average={innings.map((entry) => trend.find((point) => point.matchId === entry.matchId)?.average ?? null)}
          guides={[
            { value: p.guides.low, label: String(p.guides.low) },
            { value: p.guides.high, label: String(p.guides.high) },
          ]}
          startLabel={dayText(first?.matchDate)}
          endLabel={dayText(last?.matchDate)}
        />
        <Note>
          Dots are runs in each innings, the blue line is the running average, a hollow dot is not out. Guide lines at {p.guides.low} and {p.guides.high}. Tap a dot to open that match.
        </Note>
        {summary.inningsTotal > summary.shown && <Note>Showing the latest {summary.shown} of {summary.inningsTotal} innings.</Note>}
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const innings = [...p.series.battingInnings].filter((entry) => entry.runs !== null).reverse()
    const trend = p.series.battingTrend
    return (
      <>
        <Cap>The same, as a table</Cap>
        <FaceTable
          label="Runs in each innings"
          heads={['Date and opponent', 'Runs', 'Average after']}
          rows={innings.slice(0, SHOWN_ROWS).map((entry, index) => ({
            key: `${entry.matchId}-${index}`,
            cells: [`${dayText(entry.matchDate)} ${entry.opponentName ? `v ${entry.opponentName}` : ''}`.trim(), scoreText(entry.runs, entry.notOut), formatDecimal(trend.find((point) => point.matchId === entry.matchId)?.average)],
            href: ctx.resultHref(entry.matchId),
            linkName: `Open the match of ${dayText(entry.matchDate)}`,
          }))}
        />
        {innings.length > SHOWN_ROWS && <Note>The latest {SHOWN_ROWS} of {innings.length} innings. Open Results for the rest.</Note>}
      </>
    )
  },
}
