import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, Note } from '../../cardParts'
import { formatCount } from '../../statsFormat'
import { MatchTable, ResultCell } from '../../teamParts'
import { matchBars, newestFirst } from '../../teamKit'

// docs/specs/147 Amendment 3, team.sum-runs-conceded: runs conceded. Front: the figure with the latest three matches as bars (neutral sand). Back: each match in a table,
// newest first, each a link to its Result page. Source: bowling, series.results.
const figure = (p: MyTeamStatsDto): number | null => p.bowling.runsConceded

export const teamSumRunsConceded: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-runs-conceded',
  page: 'team',
  group: 'summary',
  title: () => 'Runs Conceded',
  tag: 'PARTLY',
  needs: ['record', 'bowling', 'series', 'basis'],
  order: 50,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No bowling recorded yet.',
  basis: (p) => ({ counted: p.bowling.coverage.inningsUsable, total: p.bowling.coverage.inningsCounted }),
  state: (p) => (p.record.played === 0 || figure(p) === null ? 'empty' : p.bowling.coverage.inningsUsable < p.bowling.coverage.inningsCounted ? 'partial' : 'ready'),
  partialNote: (p) => `Runs conceded are recorded in ${p.bowling.coverage.inningsUsable} of ${p.bowling.coverage.inningsCounted} innings.`,
  summary: (p) => `${p.teamName}: ${formatCount(figure(p))} runs conceded.`,
  Front: ({ payload: p }) => {
    const rows = matchBars(p, (point) => point.oppRuns)
    return (
      <BigBars
        unit={['run', 'runs']}
        value={formatCount(figure(p))}
        caption="runs conceded"
        total={rows.length}
        alt={`Runs Conceded in the latest matches: ${rows.slice(0, 3).map((row) => `${row.label} ${row.valueLabel}`).join(', ')}.`}
        rows={rows}
      />
    )
  },
  Back: ({ payload: p, ctx }) => (
    <>
      <Cap>Runs conceded in each match</Cap>
      <MatchTable
        label="Runs conceded in each match"
        heads={['Match', 'Runs', 'Wkts', 'Result']}
        points={newestFirst(p)}
        ctx={ctx}
        cells={(point) => [formatCount(point.oppRuns), formatCount(point.oppWickets), <ResultCell key="r" result={point.result} forfeit={point.forfeit} />]}
      />
      <Note>Runs conceded are the opposition innings with a recorded score.</Note>
    </>
  ),
}
