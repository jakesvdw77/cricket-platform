import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable, Note } from '../../cardParts'
import { formatDecimal, formatPercent } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-boundaries: boundaries hit (fours plus sixes). Front: the total with Fours and Sixes bars. Back: the
// table only. Source: batting.fours, batting.sixes, batting.boundaryPercentage, batting.ballsPerBoundary, batting.coverage.
export const mineSumBoundaries: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-boundaries',
  page: 'mine',
  group: 'summary',
  title: () => 'Boundaries Hit',
  tag: 'PARTLY',
  needs: ['batting', 'basis'],
  order: 55,
  // Summary tile: a compact (13.5 rem) card, three to a row.
  size: 'compact',
  whenMissing: 'notCaptured',
  emptyText: 'No innings yet.',
  missingText: 'Fours and sixes are not recorded for these results.',
  basis: (p) => ({ counted: p.batting.coverage.inningsWithBoundaries, total: p.batting.coverage.inningsCounted }),
  state: (p) => {
    if (p.batting.innings === 0) return 'empty'
    if (p.batting.coverage.inningsWithBoundaries === 0) return 'missing'
    return p.batting.coverage.inningsWithBoundaries < p.batting.coverage.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Fours and sixes are recorded in ${p.batting.coverage.inningsWithBoundaries} of ${p.batting.coverage.inningsCounted} innings.`,
  summary: (p, ctx) => `${ctx.firstName} has hit ${p.batting.fours} fours and ${p.batting.sixes} sixes.`,
  Front: ({ payload: p, ctx }) => {
    const { fours, sixes } = p.batting
    return (
      <BigBars
        value={String(fours + sixes)}
        caption="boundaries hit"
        total={2}
        legend={['Fours', 'Sixes']}
        alt={`${ctx.firstName}'s boundaries: ${fours} fours, ${sixes} sixes.`}
        rows={[
          { key: 'fours', label: 'Fours', tone: 'compare', seriesIndex: 0, value: fours, valueLabel: String(fours) },
          { key: 'sixes', label: 'Sixes', tone: 'compare', seriesIndex: 1, value: sixes, valueLabel: String(sixes) },
        ]}
      />
    )
  },
  Back: ({ payload: p }) => {
    const { batting } = p
    return (
      <>
        <Cap>Fours and sixes</Cap>
        <FaceTable
          label="Fours and sixes"
          heads={['Boundaries', 'Figure']}
          rows={[
            { key: 'fours', cells: ['Fours', String(batting.fours)] },
            { key: 'sixes', cells: ['Sixes', String(batting.sixes)] },
            { key: 'pct', cells: ['Boundary %', formatPercent(batting.boundaryPercentage, 1)] },
            { key: 'perboundary', cells: ['Balls Per Boundary', formatDecimal(batting.ballsPerBoundary)] },
          ]}
        />
        <Note>Boundary figures use only the innings that recorded fours and sixes.</Note>
      </>
    )
  },
}
