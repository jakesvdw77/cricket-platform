import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, Note } from '../../cardParts'
import { formatCount } from '../../statsFormat'
import { MatchTable, ResultCell } from '../../teamParts'
import { matchBars, newestFirst } from '../../teamKit'

// docs/specs/147 Amendment 3, team.sum-wickets-lost: wickets lost. Front: the figure with the latest three matches as bars (neutral sand). Back: each match in a table,
// newest first, each a link to its Result page. Source: batting, series.results.
const figure = (p: MyTeamStatsDto): number | null => p.batting.wicketsLost

export const teamSumWicketsLost: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-wickets-lost',
  page: 'team',
  group: 'summary',
  title: () => 'Wickets Lost',
  tag: 'PARTLY',
  needs: ['record', 'batting', 'series', 'basis'],
  order: 70,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No innings recorded yet.',
  basis: (p) => ({ counted: p.batting.coverage.inningsUsable, total: p.batting.coverage.inningsCounted }),
  state: (p) => (p.record.played === 0 || figure(p) === null ? 'empty' : p.batting.coverage.inningsUsable < p.batting.coverage.inningsCounted ? 'partial' : 'ready'),
  partialNote: (p) => `Wickets lost are recorded in ${p.batting.coverage.inningsUsable} of ${p.batting.coverage.inningsCounted} innings.`,
  summary: (p) => `${p.teamName}: ${formatCount(figure(p))} wickets lost.`,
  Front: ({ payload: p }) => {
    const rows = matchBars(p, (point) => point.ownWickets)
    return (
      <BigBars
        unit={['wicket', 'wickets']}
        value={formatCount(figure(p))}
        caption="wickets lost"
        total={rows.length}
        alt={`Wickets Lost in the latest matches: ${rows.slice(0, 3).map((row) => `${row.label} ${row.valueLabel}`).join(', ')}.`}
        rows={rows}
      />
    )
  },
  Back: ({ payload: p, ctx }) => (
    <>
      <Cap>Wickets lost in each match</Cap>
      <MatchTable
        label="Wickets lost in each match"
        heads={['Match', 'Wkts', 'Runs', 'Result']}
        points={newestFirst(p)}
        ctx={ctx}
        cells={(point) => [formatCount(point.ownWickets), formatCount(point.ownRuns), <ResultCell key="r" result={point.result} forfeit={point.forfeit} />]}
      />
      <Note>Wickets lost are the team&apos;s own wickets that fell.</Note>
    </>
  ),
}
