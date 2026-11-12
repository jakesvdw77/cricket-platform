import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { Donut } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { bowlerWicketColour } from '../../dismissalColours'
import { bowlingBasis, truncatedNote } from '../../cardKit'

// docs/specs/147 section 5, mine.wickets-how: how the bowler takes wickets (bowler-credited dismissals only: run-outs are not a bowler's
// wicket) with a "Not itemised" slice. Back: the table of dismissal types.
// Source: series.wicketTypes (the position bars and catchers are mine.wickets-position).
export const mineWicketsHow: StatsCardDef<MyStatsDto> = {
  id: 'mine.wickets-how',
  page: 'mine',
  group: 'bowling',
  title: (ctx) => `How ${ctx.firstName} takes wickets`,
  tag: 'HAVE',
  needs: ['series', 'basis'],
  order: 20,
  whenMissing: 'hide',
  emptyText: 'No wickets yet.',
  basis: (p) => bowlingBasis(p),
  state: (p) => {
    if (p.series.wicketTypes.total === 0) return 'empty'
    return p.series.wicketTypes.notItemised.count > 0 || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) =>
    p.series.wicketTypes.notItemised.count > 0
      ? `${p.series.wicketTypes.notItemised.count} of ${p.series.wicketTypes.total} wickets have no recorded dismissal type.`
      : truncatedNote(p),
  summary: (p, ctx) => `${ctx.firstName} has ${p.series.wicketTypes.total} wickets: ${p.series.wicketTypes.types.map((type) => `${type.label} ${type.count}`).join(', ')}.`,
  Front: ({ payload: p, ctx }) => {
    const { types, notItemised, total } = p.series.wicketTypes
    return (
      <>
        <Donut
          alt={`How ${ctx.firstName} takes wickets: ${types.map((type) => `${type.label} ${type.count}`).join(', ')}${notItemised.count > 0 ? `, not itemised ${notItemised.count}` : ''}.`}
          centre={String(total)}
          centreCaption="wickets"
          slices={[
            ...types.map((type) => ({ key: type.type, label: type.label, value: type.count, colour: bowlerWicketColour(type.type) })),
            ...(notItemised.count > 0 ? [{ key: 'not-itemised', label: 'Not itemised', value: notItemised.count, colour: bowlerWicketColour('NOT_ITEMISED') }] : []),
          ]}
        />
        <Note>Bowler's wickets only; run-outs are not counted.</Note>
      </>
    )
  },
  Back: ({ payload: p }) => {
    const { types, notItemised, total } = p.series.wicketTypes
    const share = (count: number) => (total > 0 ? `${Math.round((count / total) * 100)}%` : '-')
    return (
      <>
        <Cap>Wickets by dismissal type</Cap>
        <FaceTable
          label="Wickets by dismissal type"
          heads={['Type', 'Wickets', 'Share']}
          rows={[
            ...types.map((type) => ({ key: type.type, cells: [type.label, String(type.count), share(type.count)] })),
            ...(notItemised.count > 0 ? [{ key: 'not-itemised', cells: ['Not itemised', String(notItemised.count), share(notItemised.count)] }] : []),
          ]}
        />
      </>
    )
  },
}
