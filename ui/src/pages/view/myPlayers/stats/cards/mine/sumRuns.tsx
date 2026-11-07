import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable, Note } from '../../cardParts'
import { battingBasis } from '../../cardKit'
import { formatDecimal } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-runs: runs scored. Back: runs in each season (the Season filter is ignored for this block).
// Source: summary.runsScored, batting.innings, bySeason.
export const mineSumRuns: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-runs',
  page: 'mine',
  group: 'summary',
  title: () => 'Runs Scored',
  tag: 'HAVE',
  needs: ['summary', 'batting', 'bySeason', 'basis'],
  order: 40,
  // Summary tile: a compact (15 rem) card, three to a row.
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No innings yet.',
  basis: (p) => battingBasis(p),
  state: (p) => (p.batting.innings === 0 ? 'empty' : 'ready'),
  summary: (p, ctx) => `${ctx.firstName} has scored ${p.summary.runsScored} runs.`,
  Front: ({ payload: p, ctx }) => {
    const seasons = [...p.bySeason].reverse()
    return (
      <BigBars
        unit={['run', 'runs']}
        value={String(p.summary.runsScored)}
        caption={p.summary.runsScored === 1 ? 'run scored' : 'runs scored'}
        total={seasons.length}
        alt={`${ctx.firstName}'s runs in each season: ${seasons.map((season) => `${season.label} ${season.runs}`).join(', ')}.`}
        rows={seasons.map((season) => ({ key: season.seasonId, label: season.label, value: season.runs, valueLabel: String(season.runs) }))}
      />
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Runs in each season</Cap>
      {p.bySeason.length === 0 ? (
        <Note>No seasons to show yet.</Note>
      ) : (
        <FaceTable
          label="Runs, innings and average by season"
          heads={['Season', 'Runs', 'Innings', 'Avg']}
          rows={[...p.bySeason].reverse().map((season) => ({ key: season.seasonId, cells: [season.label, String(season.runs), String(season.innings), formatDecimal(season.average)] }))}
        />
      )}
    </>
  ),
}
