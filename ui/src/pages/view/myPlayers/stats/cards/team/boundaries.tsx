import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { DASH, formatCount, formatDecimal, formatPercent, nOfM, need } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.boundaries: the fours and sixes the team hit (a two-category comparison: green and blue) and the share of
// runs that came in boundaries. Back: the table. Source: boundaries.
export const teamBoundaries: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.boundaries',
  page: 'team',
  group: 'batting',
  title: () => 'Boundaries',
  tag: 'PARTLY',
  needs: ['boundaries', 'basis'],
  order: 70,
  whenMissing: 'notCaptured',
  emptyText: 'No innings yet.',
  missingText: 'Fours and sixes are not recorded for these results.',
  basis: (p) => ({ counted: need(p.boundaries).inningsRecorded, total: need(p.boundaries).inningsCounted }),
  state: (p) => {
    if (!p.boundaries) return 'missing'
    if (p.boundaries.inningsCounted === 0) return 'empty'
    if (p.boundaries.inningsRecorded === 0) return 'missing'
    return p.boundaries.inningsRecorded < p.boundaries.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Fours and sixes are recorded in ${need(p.boundaries).inningsRecorded} of ${need(p.boundaries).inningsCounted} innings.`,
  summary: (p) => `${p.teamName} has hit ${formatCount(need(p.boundaries).fours)} fours and ${formatCount(need(p.boundaries).sixes)} sixes.`,
  Front: ({ payload: p }) => {
    const { fours, sixes } = need(p.boundaries)
    return (
      <>
        <Big value={fours === null || sixes === null ? DASH : String(fours + sixes)} caption="boundaries" />
        <HorizontalBars
          legend={['Fours', 'Sixes']}
          alt={`${p.teamName}'s boundaries: ${formatCount(fours)} fours, ${formatCount(sixes)} sixes.`}
          rows={[
            { key: 'fours', label: 'Fours', tone: 'compare', seriesIndex: 0, value: fours ?? 0, valueLabel: formatCount(fours) },
            { key: 'sixes', label: 'Sixes', tone: 'compare', seriesIndex: 1, value: sixes ?? 0, valueLabel: formatCount(sixes) },
          ]}
        />
        <Note>{formatPercent(need(p.boundaries).boundaryPercent, 0)} of the runs came in boundaries.</Note>
      </>
    )
  },
  Back: ({ payload: p }) => {
    const b = need(p.boundaries)
    return (
      <>
        <Cap>Fours and sixes</Cap>
        <FaceTable
          label="Fours, sixes and boundary figures"
          heads={['Boundaries', 'Figure']}
          rows={[
            { key: 'fours', cells: ['Fours', formatCount(b.fours)] },
            { key: 'sixes', cells: ['Sixes', formatCount(b.sixes)] },
            { key: 'runs', cells: ['Runs from boundaries', formatCount(b.boundaryRuns)] },
            { key: 'pct', cells: ['Boundary %', formatPercent(b.boundaryPercent, 1)] },
            { key: 'bpb', cells: ['Balls per boundary', formatDecimal(b.ballsPerBoundary)] },
          ]}
        />
        <Note>Boundary figures use only the {nOfM(b.inningsRecorded, b.inningsCounted)} innings that recorded fours and sixes.</Note>
      </>
    )
  },
}
