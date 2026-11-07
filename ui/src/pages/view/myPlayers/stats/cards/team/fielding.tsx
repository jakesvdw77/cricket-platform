import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { formatDecimal, nOfM, need } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.fielding: the fielding dismissals of the team. Front: the total with catches, stumpings and run-outs as
// neutral bars and the figure per match. Back: the table. Source: fielding.
export const teamFielding: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.fielding',
  page: 'team',
  group: 'fielding',
  title: () => 'Fielding Dismissals',
  tag: 'PARTLY',
  needs: ['fielding', 'basis'],
  order: 10,
  whenMissing: 'notCaptured',
  emptyText: 'No fielding dismissals yet.',
  missingText: 'Fielding is not recorded for these results.',
  basis: (p) => ({ counted: need(p.fielding).coverage.recorded, total: need(p.fielding).coverage.counted }),
  state: (p) => {
    if (!p.fielding) return 'missing'
    if (p.fielding.coverage.counted === 0) return 'empty'
    if (p.fielding.coverage.recorded === 0) return 'missing'
    return p.fielding.coverage.recorded < p.fielding.coverage.counted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Fielding is recorded in ${nOfM(need(p.fielding).coverage.recorded, need(p.fielding).coverage.counted)} innings.`,
  summary: (p) => `${p.teamName}'s fielders made ${need(p.fielding).dismissals} dismissals: ${need(p.fielding).catches} catches, ${need(p.fielding).stumpings} stumpings, ${need(p.fielding).runOuts} run-outs.`,
  Front: ({ payload: p }) => {
    const { catches, stumpings, runOuts } = need(p.fielding)
    return (
      <>
        <Big value={String(need(p.fielding).dismissals)} caption={`dismissals · ${formatDecimal(need(p.fielding).dismissalsPerMatch, 1)} a match`} />
        <HorizontalBars
          alt={`${p.teamName}'s fielding dismissals: ${catches} catches, ${stumpings} stumpings, ${runOuts} run-outs.`}
          rows={[
            { key: 'catches', label: 'Catches', value: catches, valueLabel: String(catches) },
            { key: 'stumpings', label: 'Stumpings', value: stumpings, valueLabel: String(stumpings) },
            { key: 'runouts', label: 'Run-outs', value: runOuts, valueLabel: String(runOuts) },
          ]}
        />
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Fielding dismissals</Cap>
      <FaceTable
        label="Catches, stumpings and run-outs"
        heads={['Dismissal', 'Count']}
        rows={[
          { key: 'catches', cells: ['Catches', String(need(p.fielding).catches)] },
          { key: 'stumpings', cells: ['Stumpings', String(need(p.fielding).stumpings)] },
          { key: 'runouts', cells: ['Run-outs', String(need(p.fielding).runOuts)] },
          { key: 'total', cells: ['Total', String(need(p.fielding).dismissals)] },
          { key: 'per', cells: ['Per match', formatDecimal(need(p.fielding).dismissalsPerMatch, 2)] },
        ]}
      />
      <Note>Recorded for {nOfM(need(p.fielding).coverage.recorded, need(p.fielding).coverage.counted)} innings.</Note>
    </>
  ),
}
