import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ColumnChart } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, Note } from '../../cardParts'
import { dayText, formatCount } from '../../statsFormat'
import { MatchTable, ResultCell, ResultLegend } from '../../teamParts'
import { RESULT_WORD, newestFirst, resultColour } from '../../teamKit'

// docs/specs/147 Amendment 3, team.totals-by-match: the runs the team scored in each of its last six matches as columns (win green, loss
// coral, tie or other sand), each a link to its Result page. Back: the table, no chart repeated. Source: series.results.
const RECENT = 6

export const teamTotalsByMatch: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.totals-by-match',
  page: 'team',
  group: 'batting',
  title: () => 'Totals By Match',
  tag: 'PARTLY',
  needs: ['series', 'basis'],
  order: 20,
  whenMissing: 'hide',
  emptyText: 'No totals recorded yet.',
  basis: (p) => ({ counted: p.series.results.filter((point) => point.ownRuns !== null).length, total: p.basis.resultsCounted }),
  state: (p) => {
    const recorded = p.series.results.filter((point) => point.ownRuns !== null).length
    if (recorded === 0) return 'empty'
    return recorded < p.basis.resultsCounted || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) => (p.series.results.some((point) => point.ownRuns === null) ? 'Some results have no score recorded (forfeits and summary results).' : `Covers the newest ${p.basis.historyCap} results only.`),
  summary: (p) => `${p.teamName}'s runs in each of the last matches.`,
  Front: ({ payload: p, ctx }) => {
    const recent = p.series.results.filter((point) => point.ownRuns !== null).slice(-RECENT)
    return (
      <>
        <ColumnChart
          alt={`${p.teamName}'s runs in the last ${recent.length} matches: ${recent.map((point) => `${dayText(point.matchDate)} ${point.ownRuns}, ${RESULT_WORD[point.result]}`).join('; ')}. The table on the back has every value.`}
          columns={recent.map((point, index) => ({
            key: `${point.matchId}-${index}`,
            value: point.ownRuns ?? 0,
            valueLabel: String(point.ownRuns),
            label: dayText(point.matchDate),
            colour: resultColour(point.result),
            href: ctx.resultHref(point.matchId),
            name: `${point.ownRuns} runs, ${RESULT_WORD[point.result]}${point.opponentName ? ` against ${point.opponentName}` : ''}, ${dayText(point.matchDate)}. Open the match.`,
          }))}
        />
        <ResultLegend />
      </>
    )
  },
  Back: ({ payload: p, ctx }) => (
    <>
      <Cap>Runs in each match</Cap>
      <MatchTable
        label="Runs, wickets lost and result in each match"
        heads={['Match', 'Runs', 'Wkts', 'Result']}
        points={newestFirst(p).filter((point) => point.ownRuns !== null)}
        ctx={ctx}
        cells={(point) => [formatCount(point.ownRuns), formatCount(point.ownWickets), <ResultCell key="r" result={point.result} />]}
      />
      <Note>Wkts is wickets lost.</Note>
    </>
  ),
}
