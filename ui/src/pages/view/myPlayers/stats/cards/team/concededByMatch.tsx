import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { ColumnChart } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, Note } from '../../cardParts'
import { dayText, formatCount } from '../../statsFormat'
import { MatchTable, ResultCell, ResultLegend } from '../../teamParts'
import { RESULT_WORD, newestFirst, resultColour } from '../../teamKit'

// docs/specs/147 Amendment 3, team.conceded-by-match: the runs the team conceded in each of its last six matches as columns (win green, loss
// coral, tie or other sand), each a link to its Result page. Back: the table. Source: series.results.
const RECENT = 6

export const teamConcededByMatch: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.conceded-by-match',
  page: 'team',
  group: 'bowling',
  title: () => 'Runs Conceded By Match',
  tag: 'PARTLY',
  needs: ['series', 'basis'],
  order: 20,
  whenMissing: 'hide',
  emptyText: 'No bowling recorded yet.',
  basis: (p) => ({ counted: p.series.results.filter((point) => point.oppRuns !== null).length, total: p.basis.resultsCounted }),
  state: (p) => {
    const recorded = p.series.results.filter((point) => point.oppRuns !== null).length
    if (recorded === 0) return 'empty'
    return recorded < p.basis.resultsCounted || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) => (p.series.results.some((point) => point.oppRuns === null) ? 'Some results have no opposition score recorded (forfeits and summary results).' : `Covers the newest ${p.basis.historyCap} results only.`),
  summary: (p) => `The runs ${p.teamName} conceded in each of the last matches.`,
  Front: ({ payload: p, ctx }) => {
    const recent = p.series.results.filter((point) => point.oppRuns !== null).slice(-RECENT)
    return (
      <>
        <ColumnChart
          alt={`The runs ${p.teamName} conceded in the last ${recent.length} matches: ${recent.map((point) => `${dayText(point.matchDate)} ${point.oppRuns}, ${RESULT_WORD[point.result]}`).join('; ')}. The table on the back has every value.`}
          columns={recent.map((point, index) => ({
            key: `${point.matchId}-${index}`,
            value: point.oppRuns ?? 0,
            valueLabel: String(point.oppRuns),
            label: dayText(point.matchDate),
            colour: resultColour(point.result),
            href: ctx.resultHref(point.matchId),
            name: `${point.oppRuns} runs conceded, ${RESULT_WORD[point.result]}${point.opponentName ? ` against ${point.opponentName}` : ''}, ${dayText(point.matchDate)}. Open the match.`,
          }))}
        />
        <ResultLegend />
      </>
    )
  },
  Back: ({ payload: p, ctx }) => (
    <>
      <Cap>Runs conceded in each match</Cap>
      <MatchTable
        label="Runs conceded, wickets taken and result in each match"
        heads={['Match', 'Conceded', 'Wkts', 'Result']}
        points={newestFirst(p).filter((point) => point.oppRuns !== null)}
        ctx={ctx}
        cells={(point) => [formatCount(point.oppRuns), formatCount(point.oppWickets), <ResultCell key="r" result={point.result} />]}
      />
      <Note>Wkts is wickets taken.</Note>
    </>
  ),
}
