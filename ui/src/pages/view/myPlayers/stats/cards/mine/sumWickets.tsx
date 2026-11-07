import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { Donut } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_TONES } from '../../../../../../brandTokens'
import { Big, Cap, FaceTable, Note } from '../../cardParts'
import { bowlingBasis } from '../../cardKit'
import { formatPercent } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 3, mine.sum-wickets: wickets taken. Back: the types of wicket as a donut and its table. Source:
// bowling.wickets, series.wicketTypes.
export const mineSumWickets: StatsCardDef<MyStatsDto> = {
  id: 'mine.sum-wickets',
  page: 'mine',
  group: 'summary',
  title: () => 'Wickets Taken',
  tag: 'HAVE',
  needs: ['bowling', 'series', 'basis'],
  order: 80,
  whenMissing: 'hide',
  emptyText: 'No wickets yet.',
  basis: (p) => bowlingBasis(p),
  state: (p) => {
    if (p.bowling.wickets === 0) return 'empty'
    return p.series.wicketTypes.notItemised.count > 0 ? 'partial' : 'ready'
  },
  partialNote: (p) => `${p.series.wicketTypes.notItemised.count} of ${p.series.wicketTypes.total} wickets have no recorded dismissal type.`,
  summary: (p, ctx) => `${ctx.firstName} has taken ${p.bowling.wickets} ${p.bowling.wickets === 1 ? 'wicket' : 'wickets'}.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <Big value={String(p.bowling.wickets)} caption={p.bowling.wickets === 1 ? 'wicket taken' : 'wickets taken'} />
      <Note>The wickets {ctx.firstName} has taken. Flip for how they came.</Note>
    </>
  ),
  Back: ({ payload: p, ctx }) => {
    const { types, notItemised, total } = p.series.wicketTypes
    return (
      <>
        <Cap>How the wickets came</Cap>
        <Donut
          alt={`How ${ctx.firstName} takes wickets: ${types.map((type) => `${type.label} ${type.count}`).join(', ')}${notItemised.count > 0 ? `, not itemised ${notItemised.count}` : ''}.`}
          centre={String(total)}
          centreCaption="wickets"
          slices={[
            ...types.map((type) => ({ key: type.type, label: type.label, value: type.count })),
            ...(notItemised.count > 0 ? [{ key: 'not-itemised', label: 'Not itemised', value: notItemised.count, colour: STATS_TONES.sand }] : []),
          ]}
        />
        <FaceTable
          label="Wickets by type"
          heads={['Type', 'Wickets', 'Share']}
          rows={[
            ...types.map((type) => ({ key: type.type, cells: [type.label, String(type.count), formatPercent(type.percent, 0)] })),
            ...(notItemised.count > 0 ? [{ key: 'not-itemised', cells: ['Not itemised', String(notItemised.count), formatPercent(notItemised.percent, 0)] }] : []),
          ]}
        />
        <Note>Counts only dismissals credited to the bowler.</Note>
      </>
    )
  },
}
