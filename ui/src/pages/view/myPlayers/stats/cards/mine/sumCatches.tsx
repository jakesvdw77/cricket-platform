import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable } from '../../cardParts'
import { fieldingBasis } from '../../cardKit'

// docs/specs/147 Amendment 2 item 3, mine.sum-catches: catches taken. Back: catches, stumpings and run-outs. Source: summary.catchesTaken, fielding.
export const mineSumCatches: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-catches',
  page: 'mine',
  group: 'summary',
  title: () => 'Catches Taken',
  tag: 'HAVE',
  needs: ['summary', 'fielding', 'basis'],
  order: 70,
  // Summary tile: a compact (10 rem) card, three to a row.
  size: 'compact',
  whenMissing: 'notCaptured',
  emptyText: 'No matches played yet.',
  missingText: 'Fielding was not recorded for these results.',
  basis: (p) => fieldingBasis(p),
  state: (p) => {
    if (p.basis.resultsWithFieldingCard === 0) return p.basis.resultsCounted === 0 ? 'empty' : 'missing'
    return p.basis.resultsWithFieldingCard < p.basis.resultsCounted ? 'partial' : 'ready'
  },
  partialNote: (p) => `Fielding is recorded in ${p.basis.resultsWithFieldingCard} of ${p.basis.resultsCounted} results.`,
  summary: (p, ctx) => `${ctx.firstName} has taken ${p.summary.catchesTaken} ${p.summary.catchesTaken === 1 ? 'catch' : 'catches'}.`,
  Front: ({ payload: p, ctx }) => {
    const { catches, stumpings, runOuts } = p.fielding
    return (
      <BigBars
        value={String(p.summary.catchesTaken)}
        caption={p.summary.catchesTaken === 1 ? 'catch taken' : 'catches taken'}
        total={3}
        alt={`${ctx.firstName}'s fielding: ${catches} catches, ${stumpings} stumpings, ${runOuts} run-outs.`}
        rows={[
          { key: 'catches', label: 'Catches', value: catches, valueLabel: String(catches) },
          { key: 'stumpings', label: 'Stumpings', value: stumpings, valueLabel: String(stumpings) },
          { key: 'runouts', label: 'Run-outs', value: runOuts, valueLabel: String(runOuts) },
        ]}
      />
    )
  },
  Back: ({ payload: p }) => {
    const { catches, stumpings, runOuts } = p.fielding
    return (
      <>
        <Cap>Catches, stumpings and run-outs</Cap>
        <FaceTable
          label="Catches, stumpings and run-outs"
          heads={['Fielding', 'Count']}
          rows={[
            { key: 'catches', cells: ['Catches', String(catches)] },
            { key: 'stumpings', cells: ['Stumpings', String(stumpings)] },
            { key: 'runouts', cells: ['Run-outs', String(runOuts)] },
          ]}
        />
      </>
    )
  },
}
