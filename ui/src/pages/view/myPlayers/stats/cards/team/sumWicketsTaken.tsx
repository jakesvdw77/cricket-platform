import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, Note } from '../../cardParts'
import { formatCount } from '../../statsFormat'
import { MatchTable, ResultCell } from '../../teamParts'
import { matchBars, newestFirst } from '../../teamKit'

// docs/specs/147 Amendment 3, team.sum-wickets-taken: wickets taken. Front: the figure with the latest three matches as bars (neutral sand). Back: each match in a table,
// newest first, each a link to its Result page. Source: bowling, series.results.
const figure = (p: MyTeamStatsDto): number | null => p.bowling.wicketsTaken

export const teamSumWicketsTaken: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-wickets-taken',
  page: 'team',
  group: 'summary',
  title: () => 'Wickets Taken',
  tag: 'PARTLY',
  needs: ['record', 'bowling', 'series', 'basis'],
  order: 60,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No bowling recorded yet.',
  basis: (p) => ({ counted: p.bowling.coverage.inningsUsable, total: p.bowling.coverage.inningsCounted }),
  state: (p) => (p.record.played === 0 || figure(p) === null ? 'empty' : p.bowling.coverage.inningsUsable < p.bowling.coverage.inningsCounted ? 'partial' : 'ready'),
  partialNote: (p) => `Wickets are recorded in ${p.bowling.coverage.inningsUsable} of ${p.bowling.coverage.inningsCounted} innings.`,
  summary: (p) => `${p.teamName}: ${formatCount(figure(p))} wickets taken.`,
  Front: ({ payload: p }) => {
    const rows = matchBars(p, (point) => point.oppWickets)
    return (
      <BigBars
        unit={['wicket', 'wickets']}
        value={formatCount(figure(p))}
        caption="wickets taken"
        total={rows.length}
        alt={`Wickets Taken in the latest matches: ${rows.slice(0, 3).map((row) => `${row.label} ${row.valueLabel}`).join(', ')}.`}
        rows={rows}
      />
    )
  },
  Back: ({ payload: p, ctx }) => (
    <>
      <Cap>Wickets taken in each match</Cap>
      <MatchTable
        label="Wickets taken in each match"
        heads={['Match', 'Wkts', 'Conceded', 'Result']}
        points={newestFirst(p)}
        ctx={ctx}
        cells={(point) => [formatCount(point.oppWickets), formatCount(point.oppRuns), <ResultCell key="r" result={point.result} forfeit={point.forfeit} />]}
      />
      <Note>Wickets taken are the opposition wickets that fell.</Note>
    </>
  ),
}
