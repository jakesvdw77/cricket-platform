import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars, Donut } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_TONES } from '../../../../../../brandTokens'
import { Cap, FaceTable, Note } from '../../cardParts'
import { bowlingBasis, truncatedNote } from '../../cardKit'
import { NOT_RECORDED } from '../../statsFormat'

// docs/specs/147 section 5, mine.wickets-how: how the bowler takes wickets (bowler-credited dismissals only: run-outs are not a bowler's
// wicket) with a "Not itemised" slice. Back: the batters dismissed by position in the order and who caught them (the team's own fielders).
// Source: series.wicketTypes, wicketsByPosition.
export const mineWicketsHow: StatsCardDef<MyStatsDto> = {
  id: 'mine.wickets-how',
  page: 'mine',
  group: 'bowling',
  title: (ctx) => `How ${ctx.firstName} takes wickets`,
  tag: 'HAVE',
  needs: ['series', 'wicketsByPosition', 'basis'],
  order: 20,
  whenMissing: 'hide',
  emptyText: 'No wickets yet.',
  basis: (p) => bowlingBasis(p),
  state: (p) => {
    if (p.series.wicketTypes.total === 0) return 'empty'
    return p.series.wicketTypes.notItemised.count > 0 || p.wicketsByPosition.notRecorded > 0 || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) =>
    p.series.wicketTypes.notItemised.count > 0
      ? `${p.series.wicketTypes.notItemised.count} of ${p.series.wicketTypes.total} wickets have no recorded dismissal type.`
      : p.wicketsByPosition.notRecorded > 0
        ? `${p.wicketsByPosition.notRecorded} of ${p.wicketsByPosition.total} batters have no recorded position.`
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
            ...types.map((type) => ({ key: type.type, label: type.label, value: type.count })),
            ...(notItemised.count > 0 ? [{ key: 'not-itemised', label: 'Not itemised', value: notItemised.count, colour: STATS_TONES.sand }] : []),
          ]}
        />
        <Note>Bowler's wickets only; run-outs are not counted.</Note>
      </>
    )
  },
  Back: ({ payload: p }) => {
    const { groups, notRecorded, total, caughtBy } = p.wicketsByPosition
    const rows = [...groups.map((group) => ({ key: group.key, label: group.label, count: group.count })), ...(notRecorded > 0 ? [{ key: 'not-recorded', label: NOT_RECORDED, count: notRecorded }] : [])]
    return (
      <>
        <Cap>Batters dismissed, by position</Cap>
        {total === 0 ? (
          <Note>No batters dismissed yet.</Note>
        ) : (
          <HorizontalBars
            alt={`Batters dismissed by position: ${rows.map((row) => `${row.label} ${row.count}`).join(', ')}.`}
            rows={rows.map((row) => ({ key: row.key, label: row.label, value: row.count, valueLabel: String(row.count) }))}
          />
        )}
        <Cap>Caught by</Cap>
        {caughtBy.length === 0 ? (
          <Note>No catches by the team's fielders recorded.</Note>
        ) : (
          <FaceTable label="Catches taken off this bowler by fielder" heads={['Fielder', 'Catches']} rows={caughtBy.slice(0, 5).map((fielder) => ({ key: fielder.name, cells: [fielder.name, String(fielder.count)] }))} />
        )}
        <Note>Names are as the manager recorded them.</Note>
      </>
    )
  },
}
