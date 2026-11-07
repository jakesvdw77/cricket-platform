import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { battingBasis, truncatedNote } from '../../cardKit'
import { DASH, formatDecimal, positionLabel } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 5, mine.positions: where the batter bats. Positions 1 and 2 are one group, Opener, then 3 to 11 each (the
// server groups them: battingPositionGroups). Front: runs scored in each as bars. Back: the table. Source: battingPositionGroups, batting.
export const minePositions: StatsCardDef<MyStatsDto> = {
  id: 'mine.positions',
  page: 'mine',
  group: 'batting',
  title: () => 'Where The Batter Bats',
  tag: 'PARTLY',
  needs: ['battingPositionGroups', 'batting', 'basis'],
  order: 40,
  whenMissing: 'notCaptured',
  emptyText: 'Not enough innings yet.',
  missingText: 'Batting position is not recorded for these innings.',
  basis: (p) => ({ counted: p.battingPositionGroups.reduce((sum, group) => sum + group.innings, 0), total: p.batting.innings }),
  state: (p) => {
    if (p.batting.innings === 0) return 'empty'
    if (p.battingPositionGroups.length === 0) return 'missing'
    return p.battingPositionGroups.reduce((sum, group) => sum + group.innings, 0) < p.batting.innings || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) => {
    const recorded = p.battingPositionGroups.reduce((sum, group) => sum + group.innings, 0)
    return recorded < p.batting.innings ? `Batting position is recorded for ${recorded} of ${p.batting.innings} innings.` : truncatedNote(p)
  },
  summary: (p, ctx) => `${ctx.firstName}'s runs by batting position: ${p.battingPositionGroups.map((group) => `${positionLabel(group)} ${group.runs}`).join(', ')}.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <HorizontalBars
        alt={`${ctx.firstName}'s runs by batting position: ${p.battingPositionGroups.map((group) => `${positionLabel(group)} ${group.runs}`).join(', ')}.`}
        rows={p.battingPositionGroups.map((group) => ({ key: group.key, label: positionLabel(group), value: group.runs, valueLabel: String(group.runs) }))}
      />
      <Note>Runs scored at each batting position; the openers are positions 1 and 2 together. Flip for the table.</Note>
    </>
  ),
  Back: ({ payload: p }) => (
    <>
      <Cap>Batting position</Cap>
      <FaceTable
        label="Batting position, innings, runs, not outs, dismissals, average and highest score"
        heads={['Position', 'Inns', 'Runs', 'Not out', 'Out', 'Avg', 'High']}
        rows={p.battingPositionGroups.map((group) => ({
          key: group.key,
          cells: [positionLabel(group), String(group.innings), String(group.runs), String(group.notOuts), String(group.dismissals), formatDecimal(group.average), group.highest === null ? DASH : String(group.highest)],
        }))}
      />
    </>
  ),
}
