import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { formatDecimal, formatPercent, positionLabel, need } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.positions: the team's runs by batting position (Opener, then No. 3 to No. 11) as neutral bars of the
// share of team runs. Back: the table. Source: battingPositionGroups, batting.
const SHOWN = 5

export const teamPositions: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.positions',
  page: 'team',
  group: 'batting',
  title: () => 'Runs By Batting Position',
  tag: 'PARTLY',
  needs: ['battingPositionGroups', 'batting', 'basis'],
  order: 60,
  whenMissing: 'notCaptured',
  emptyText: 'No innings yet.',
  missingText: 'Batting position is not recorded for these innings.',
  basis: (p) => ({ counted: need(p.battingPositionGroups).reduce((sum, group) => sum + group.innings, 0), total: p.batting.coverage.inningsCounted }),
  state: (p) => {
    if (!p.battingPositionGroups) return 'missing'
    if (p.batting.innings === 0) return 'empty'
    if (p.battingPositionGroups.length === 0) return 'missing'
    return p.battingPositionGroups.reduce((sum, group) => sum + group.innings, 0) < p.batting.coverage.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Batting position is recorded for ${need(p.battingPositionGroups).reduce((sum, group) => sum + group.innings, 0)} of ${p.batting.coverage.inningsCounted} innings.`,
  summary: (p) => `${p.teamName}'s runs by batting position: ${need(p.battingPositionGroups).map((group) => `${positionLabel(group)} ${group.runs}`).join(', ')}.`,
  Front: ({ payload: p }) => {
    // At most five bars fit: when there are more positions, the five with the most runs, kept in batting order.
    const groups = need(p.battingPositionGroups)
    const shown = groups.length > SHOWN ? [...groups].sort((a, b) => b.runs - a.runs).slice(0, SHOWN).sort((a, b) => groups.indexOf(a) - groups.indexOf(b)) : groups
    return (
      <>
        <HorizontalBars
          alt={`${p.teamName}'s runs by batting position: ${shown.map((group) => `${positionLabel(group)} ${group.runs}, ${formatPercent(group.sharePercent, 0)} of the runs`).join('; ')}.`}
          rows={shown.map((group) => ({ key: group.key, label: positionLabel(group), value: group.runs, valueLabel: `${group.runs} · ${formatPercent(group.sharePercent, 0)}` }))}
        />
        <Note>{groups.length > SHOWN ? `Top ${SHOWN} of ${groups.length} positions by runs. Flip for all.` : 'Runs at each batting position; openers together.'}</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Batting position</Cap>
      <FaceTable
        label="Batting position, innings, runs, share of team runs, dismissals and average"
        heads={['Position', 'Inns', 'Runs', 'Share', 'Out', 'Avg']}
        rows={need(p.battingPositionGroups).map((group) => ({
          key: group.key,
          cells: [positionLabel(group), String(group.innings), String(group.runs), formatPercent(group.sharePercent, 0), String(group.dismissals), formatDecimal(group.average)],
        }))}
      />
    </>
  ),
}
