import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable } from '../../cardParts'
import { fieldingBasis } from '../../cardKit'

// docs/specs/147 Amendment 2 item 3, mine.sum-fielding: fielding dismissals. Back: catches, stumpings, run-outs, total. Source: fielding.
export const mineSumFielding: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-fielding',
  page: 'mine',
  group: 'summary',
  title: () => 'Fielding Dismissals',
  tag: 'HAVE',
  needs: ['fielding', 'basis'],
  order: 70,
  // Summary tile: a compact (14 rem) card, three to a row.
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
  summary: (p, ctx) => `${ctx.firstName} has made ${p.fielding.dismissals} fielding ${p.fielding.dismissals === 1 ? 'dismissal' : 'dismissals'}: ${p.fielding.catches} catches, ${p.fielding.stumpings} stumpings and ${p.fielding.runOuts} run-outs.`,
  Front: ({ payload: p, ctx }) => {
    // The server's own total (fielding.dismissals), shown as is.
    const { catches, stumpings, runOuts, dismissals } = p.fielding
    return (
      <BigBars
        value={String(dismissals)}
        caption={dismissals === 1 ? 'fielding dismissal' : 'fielding dismissals'}
        total={3}
        alt={`${ctx.firstName}'s ${dismissals} fielding dismissals: ${catches} catches, ${stumpings} stumpings, ${runOuts} run-outs.`}
        rows={[
          { key: 'catches', label: 'Catches', value: catches, valueLabel: String(catches) },
          { key: 'stumpings', label: 'Stumpings', value: stumpings, valueLabel: String(stumpings) },
          { key: 'runouts', label: 'Run-outs', value: runOuts, valueLabel: String(runOuts) },
        ]}
      />
    )
  },
  Back: ({ payload: p }) => {
    const { catches, stumpings, runOuts, dismissals, dismissalsPerMatch } = p.fielding
    return (
      <>
        <Cap>Fielding dismissals</Cap>
        <FaceTable
          label="Fielding dismissals"
          heads={['Fielding', 'Count']}
          rows={[
            { key: 'catches', cells: ['Catches', String(catches)] },
            { key: 'stumpings', cells: ['Stumpings', String(stumpings)] },
            { key: 'runouts', cells: ['Run-outs', String(runOuts)] },
            { key: 'total', cells: ['Total', String(dismissals)] },
            { key: 'permatch', cells: ['Dismissals per match', dismissalsPerMatch == null ? '–' : dismissalsPerMatch.toFixed(2)] },
          ]}
        />
      </>
    )
  },
}
