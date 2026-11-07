import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { nOfM } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.catches-by-fielder: the catches taken by each fielder (the top five and Others, neutral sand bars).
// Back: every fielder with catches, stumpings and run-outs. Full names stay inside the Hub. Source: fielding.byFielder, fielding.others.
const SHOWN = 5

export const teamCatchesByFielder: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.catches-by-fielder',
  page: 'team',
  group: 'fielding',
  title: () => 'Catches By Fielder',
  tag: 'PARTLY',
  needs: ['fielding', 'basis'],
  order: 20,
  whenMissing: 'notCaptured',
  emptyText: 'No catches yet.',
  missingText: 'Fielding is not recorded for these results.',
  basis: (p) => ({ counted: p.fielding.coverage.recorded, total: p.fielding.coverage.counted }),
  state: (p) => {
    if (p.fielding.coverage.counted === 0 || p.fielding.catches === 0) return p.fielding.coverage.counted > 0 && p.fielding.coverage.recorded === 0 ? 'missing' : 'empty'
    return p.fielding.coverage.recorded < p.fielding.coverage.counted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Fielding is recorded in ${nOfM(p.fielding.coverage.recorded, p.fielding.coverage.counted)} innings.`,
  summary: (p) => `The catches each of ${p.teamName}'s fielders took.`,
  Front: ({ payload: p }) => {
    const catchers = [...p.fielding.byFielder].filter((fielder) => fielder.catches > 0).sort((a, b) => b.catches - a.catches)
    const top = catchers.slice(0, SHOWN)
    const rest = catchers.slice(SHOWN).reduce((sum, fielder) => sum + fielder.catches, 0)
    const rows = [
      ...top.map((fielder) => ({ key: fielder.name, label: fielder.name, value: fielder.catches, valueLabel: String(fielder.catches) })),
      ...(rest > 0 ? [{ key: 'others', label: 'Others', value: rest, valueLabel: String(rest) }] : []),
    ]
    return (
      <HorizontalBars
        alt={`Catches by fielder: ${rows.map((row) => `${row.label} ${row.valueLabel}`).join(', ')}.`}
        rows={rows}
      />
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Fielding by player</Cap>
      <FaceTable
        label="Catches, stumpings and run-outs by fielder"
        heads={['Fielder', 'Catches', 'Stumpings', 'Run-outs', 'Total']}
        rows={[
          ...[...p.fielding.byFielder].sort((a, b) => b.total - a.total).map((fielder) => ({ key: fielder.name, cells: [fielder.name, String(fielder.catches), String(fielder.stumpings), String(fielder.runOuts), String(fielder.total)] })),
        ]}
      />
      {p.fielding.others > 0 && <Note>The table lists the top eight fielders; {p.fielding.others} more dismissals came from the rest of the squad.</Note>}
    </>
  ),
}
