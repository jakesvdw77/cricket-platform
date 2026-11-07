import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note, Tiles } from '../../cardParts'
import { DASH, formatCount, formatDecimal } from '../../statsFormat'
import { matchLabel } from '../../teamKit'

// docs/specs/147 Amendment 3, team.batting-card: the team's batting at a glance. Front: runs with the average, run rate, highest and lowest
// total as tiles. Back: every batting figure as a table. Source: batting, basis.
const totalText = (total: { runs: number; wickets: number } | null): string => (total ? `${total.runs}/${total.wickets}` : DASH)

export const teamBattingCard: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.batting-card',
  page: 'team',
  group: 'batting',
  title: () => 'Team Batting',
  tag: 'HAVE',
  needs: ['batting', 'basis'],
  order: 10,
  whenMissing: 'hide',
  emptyText: 'No innings recorded yet.',
  basis: (p) => ({ counted: p.batting.coverage.inningsUsable, total: p.batting.coverage.inningsCounted }),
  state: (p) => {
    if (p.batting.innings === 0) return 'empty'
    return p.batting.coverage.inningsUsable < p.batting.coverage.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Run rate and totals are from ${p.batting.coverage.inningsUsable} of ${p.batting.coverage.inningsCounted} innings.`,
  summary: (p) => `${p.teamName} has scored ${formatCount(p.batting.runs)} runs at ${formatDecimal(p.batting.runRate, 2)} an over.`,
  Front: ({ payload: p }) => (
    <>
      <Big value={formatCount(p.batting.runs)} caption={`runs · ${p.batting.innings} innings`} />
      <Tiles
        dense
        items={[
          { key: 'avg', label: 'Average', value: formatDecimal(p.batting.battingAverage, 1) },
          { key: 'rr', label: 'Run rate', value: formatDecimal(p.batting.runRate, 2) },
          { key: 'high', label: 'Highest', value: p.batting.highestTotal ? String(p.batting.highestTotal.runs) : DASH },
          { key: 'low', label: 'Lowest', value: p.batting.lowestTotal ? String(p.batting.lowestTotal.runs) : DASH },
        ]}
      />
    </>
  ),
  Back: ({ payload: p }) => {
    const { batting } = p
    return (
      <>
        <Cap>Team batting</Cap>
        <FaceTable
          label="Team batting figures"
          heads={['Figure', 'Value']}
          rows={[
            { key: 'runs', cells: ['Runs', formatCount(batting.runs)] },
            { key: 'wickets', cells: ['Wickets lost', formatCount(batting.wicketsLost)] },
            { key: 'innings', cells: ['Innings', String(batting.innings)] },
            { key: 'rpi', cells: ['Runs per innings', formatDecimal(batting.runsPerInnings, 1)] },
            { key: 'avg', cells: ['Average', formatDecimal(batting.battingAverage, 1)] },
            { key: 'rr', cells: ['Run rate', formatDecimal(batting.runRate, 2)] },
            { key: 'balls', cells: ['Balls faced', formatCount(batting.ballsFaced)] },
            { key: 'high', cells: [batting.highestTotal ? `Highest (${matchLabel(batting.highestTotal)})` : 'Highest', totalText(batting.highestTotal)] },
            { key: 'low', cells: [batting.lowestTotal ? `Lowest (${matchLabel(batting.lowestTotal)})` : 'Lowest', totalText(batting.lowestTotal)] },
          ]}
        />
        <Note>Totals are runs / wickets lost. The average is runs per wicket lost.</Note>
      </>
    )
  },
}
