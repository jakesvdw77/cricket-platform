import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { battingBasis } from '../../cardKit'
import { clip, formatDecimal } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-runs: runs scored. Back: runs in each season (the Season filter is ignored for this block).
// Source: summary.runsScored, batting.innings, bySeason.
const SHOWN = 8

export const mineSumRuns: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-runs',
  page: 'mine',
  group: 'summary',
  title: () => 'Runs Scored',
  tag: 'HAVE',
  needs: ['summary', 'batting', 'bySeason', 'basis'],
  order: 40,
  whenMissing: 'hide',
  emptyText: 'No innings yet.',
  basis: (p) => battingBasis(p),
  state: (p) => (p.batting.innings === 0 ? 'empty' : 'ready'),
  summary: (p, ctx) => `${ctx.firstName} has scored ${p.summary.runsScored} runs.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <Big value={String(p.summary.runsScored)} caption={p.summary.runsScored === 1 ? 'run scored' : 'runs scored'} />
      <Note>All the runs {ctx.firstName} has scored in these results. Flip for the runs in each season.</Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const seasons = p.bySeason.slice(-SHOWN)
    return (
      <>
        <Cap>Runs in each season</Cap>
        {p.bySeason.length === 0 ? (
          <Note>No seasons to show yet.</Note>
        ) : (
          <>
            <HorizontalBars
              alt={`${ctx.firstName}'s runs in each season: ${seasons.map((season) => `${season.label} ${season.runs}`).join(', ')}.`}
              rows={seasons.map((season) => ({ key: season.seasonId, label: clip(season.label), value: season.runs, valueLabel: String(season.runs) }))}
            />
            <FaceTable
              label="Runs, innings and average by season"
              heads={['Season', 'Runs', 'Innings', 'Avg']}
              rows={[...p.bySeason].reverse().slice(0, SHOWN).map((season) => ({ key: season.seasonId, cells: [season.label, String(season.runs), String(season.innings), formatDecimal(season.average)] }))}
            />
            {p.bySeason.length > SHOWN && <Note>The latest {SHOWN} of {p.bySeason.length} seasons.</Note>}
          </>
        )}
      </>
    )
  },
}
