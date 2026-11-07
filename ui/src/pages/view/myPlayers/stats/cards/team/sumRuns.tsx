import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, Note } from '../../cardParts'
import { formatCount } from '../../statsFormat'
import { MatchTable, ResultCell } from '../../teamParts'
import { matchBars, newestFirst } from '../../teamKit'

// docs/specs/147 Amendment 3, team.sum-runs: runs scored. Front: the figure with the latest three matches as bars (neutral sand). Back: each match in a table,
// newest first, each a link to its Result page. Source: batting, series.results.
const figure = (p: MyTeamStatsDto): number | null => p.batting.runs

export const teamSumRuns: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-runs',
  page: 'team',
  group: 'summary',
  title: () => 'Runs Scored',
  tag: 'PARTLY',
  needs: ['record', 'batting', 'series', 'basis'],
  order: 40,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No innings recorded yet.',
  basis: (p) => ({ counted: p.batting.coverage.inningsUsable, total: p.batting.coverage.inningsCounted }),
  state: (p) => (p.record.played === 0 || figure(p) === null ? 'empty' : p.batting.coverage.inningsUsable < p.batting.coverage.inningsCounted ? 'partial' : 'ready'),
  partialNote: (p) => `Runs are recorded in ${p.batting.coverage.inningsUsable} of ${p.batting.coverage.inningsCounted} innings.`,
  summary: (p) => `${p.teamName}: ${formatCount(figure(p))} runs scored.`,
  Front: ({ payload: p }) => {
    const rows = matchBars(p, (point) => point.ownRuns)
    return (
      <BigBars
        unit={['run', 'runs']}
        value={formatCount(figure(p))}
        caption="runs scored"
        total={rows.length}
        alt={`Runs Scored in the latest matches: ${rows.slice(0, 3).map((row) => `${row.label} ${row.valueLabel}`).join(', ')}.`}
        rows={rows}
      />
    )
  },
  Back: ({ payload: p, ctx }) => (
    <>
      <Cap>Runs scored in each match</Cap>
      <MatchTable
        label="Runs scored in each match"
        heads={['Match', 'Runs', 'Wkts', 'Result']}
        points={newestFirst(p)}
        ctx={ctx}
        cells={(point) => [formatCount(point.ownRuns), formatCount(point.ownWickets), <ResultCell key="r" result={point.result} forfeit={point.forfeit} />]}
      />
      <Note>Runs are counted from the innings with a recorded score.</Note>
    </>
  ),
}
