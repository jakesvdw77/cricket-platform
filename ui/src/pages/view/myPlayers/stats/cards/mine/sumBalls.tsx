import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Big, Cap, Note, Tiles } from '../../cardParts'
import { formatDecimal, formatPercent, need } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-balls: balls faced. Null when no innings recorded the balls (the card then says so and shows no
// zero). Back: the strike rate and boundary figures. Source: summary.ballsFaced, batting.
export const mineSumBalls: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-balls',
  page: 'mine',
  group: 'summary',
  title: () => 'Balls Faced',
  tag: 'PARTLY',
  needs: ['summary', 'batting', 'basis'],
  order: 50,
  // Summary tile: a compact (15 rem) card, three to a row.
  size: 'compact',
  whenMissing: 'notCaptured',
  emptyText: 'No innings yet.',
  missingText: 'Balls faced are not recorded for these results.',
  basis: (p) => ({ counted: p.batting.coverage.inningsWithBalls, total: p.batting.coverage.inningsCounted }),
  state: (p) => {
    if (!p.summary) return 'missing'
    if (p.batting.innings === 0) return 'empty'
    if (p.summary.ballsFaced === null) return 'missing'
    return p.batting.coverage.inningsWithBalls < p.batting.coverage.inningsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Balls faced are recorded in ${p.batting.coverage.inningsWithBalls} of ${p.batting.coverage.inningsCounted} innings.`,
  summary: (p, ctx) => `${ctx.firstName} has faced ${need(p.summary).ballsFaced ?? 'an unrecorded number of'} balls.`,
  Front: ({ payload: p }) => (
    <Big compact value={need(p.summary).ballsFaced === null ? '–' : String(need(p.summary).ballsFaced)} caption={need(p.summary).ballsFaced === null ? 'not recorded' : 'balls faced'} />
  ),
  Back: ({ payload: p }) => {
    const { batting } = p
    return (
      <>
        <Cap>Strike rate and boundaries</Cap>
        <Tiles
          items={[
            { key: 'sr', label: 'Strike Rate', value: formatDecimal(batting.strikeRate) },
            { key: 'fours', label: 'Fours', value: String(batting.fours) },
            { key: 'sixes', label: 'Sixes', value: String(batting.sixes) },
            { key: 'boundary', label: 'Boundary %', value: formatPercent(batting.boundaryPercentage, 1) },
            { key: 'perboundary', label: 'Balls Per Four Or Six', value: formatDecimal(batting.ballsPerBoundary) },
          ]}
        />
        <Note>Strike rate and boundary figures use only the innings that recorded balls faced.</Note>
      </>
    )
  },
}
