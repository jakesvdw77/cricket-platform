import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { Donut } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { battingBasis, truncatedNote } from '../../cardKit'
import { batterDismissalColour } from '../../dismissalColours'
import { NOT_RECORDED, nOfM } from '../../statsFormat'

// docs/specs/147 section 5, mine.dismissals: how the batter gets out (a donut; each slice with a drill is a link to those innings). Back:
// the bowlers who got the batter out, as the manager recorded them, with a "not recorded" remainder. Source: series.dismissals, dismissedBy.
const total = (p: MyStatsDto): number => p.series.dismissals.reduce((sum, slice) => sum + slice.count, 0)

export const mineDismissals: StatsCardDef<MyStatsDto> = {
  id: 'mine.dismissals',
  page: 'mine',
  group: 'batting',
  title: (ctx) => `How ${ctx.firstName} gets out`,
  tag: 'HAVE',
  needs: ['series', 'dismissedBy', 'basis'],
  order: 30,
  whenMissing: 'hide',
  emptyText: 'Not enough innings yet.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    if (total(p) === 0) return 'empty'
    return p.dismissedBy.notRecorded > 0 || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) =>
    p.dismissedBy.notRecorded > 0 ? `The bowler is named for ${nOfM(p.dismissedBy.total - p.dismissedBy.notRecorded, p.dismissedBy.total)} dismissals.` : truncatedNote(p),
  summary: (p, ctx) => `How ${ctx.firstName} gets out over ${total(p)} innings: ${p.series.dismissals.map((slice) => `${slice.label} ${slice.count}`).join(', ')}.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <Donut
        alt={`How ${ctx.firstName} gets out: ${p.series.dismissals.map((slice) => `${slice.label} ${slice.count}`).join(', ')}.`}
        centre={String(total(p))}
        centreCaption="innings"
        slices={p.series.dismissals.map((slice) => ({
          key: slice.type,
          label: slice.label,
          value: slice.count,
          colour: batterDismissalColour(slice.type),
          href: slice.filter && slice.count > 0 ? ctx.drillHref({ kind: 'BATTING', filter: slice.filter, label: slice.label }) : undefined,
        }))}
      />
      <Note>Tap a slice to see those innings.</Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const { bowlers, notRecorded } = p.dismissedBy
    return (
      <>
        <Cap>Who got {ctx.firstName} out</Cap>
        {bowlers.length === 0 && notRecorded === 0 ? (
          <Note>No dismissals credited to a bowler yet.</Note>
        ) : (
          <FaceTable
            label="Bowlers who got the batter out"
            heads={['Bowler', 'Times']}
            rows={[
              ...bowlers.slice(0, 8).map((bowler) => ({ key: bowler.name, cells: [bowler.name, String(bowler.count)] })),
              ...(notRecorded > 0 ? [{ key: 'not-recorded', cells: [NOT_RECORDED, String(notRecorded)] }] : []),
            ]}
          />
        )}
        <Note>Opposition names are free text, so the same bowler can appear spelled two ways; they are shown as recorded.</Note>
      </>
    )
  },
}
