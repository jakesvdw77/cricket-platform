import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note, Split } from '../../cardParts'
import { bowlingBasis, truncatedNote } from '../../cardKit'
import { NOT_RECORDED, plural } from '../../statsFormat'

// docs/specs/147 Amendment 2, mine.wickets-position: the batters the bowler dismisses by position in the order (openers, middle order, tail)
// and which of the team's fielders caught them. Front: the position bars and the top three catchers. Back: the full tables.
// Source: wicketsByPosition.
const CATCHERS_SHOWN = 3

export const mineWicketsPosition: StatsCardDef<MyStatsDto> = {
  id: 'mine.wickets-position',
  page: 'mine',
  group: 'bowling',
  title: (ctx) => `Who ${ctx.firstName} Dismisses`,
  tag: 'PARTLY',
  needs: ['wicketsByPosition', 'basis'],
  order: 60,
  size: 'normal',
  whenMissing: 'hide',
  emptyText: 'No batters dismissed yet.',
  basis: (p) => bowlingBasis(p),
  state: (p) => {
    if (p.wicketsByPosition.total === 0) return 'empty'
    return p.wicketsByPosition.notRecorded > 0 || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) =>
    p.wicketsByPosition.notRecorded > 0 ? `${plural(p.wicketsByPosition.notRecorded, 'batter')} with no recorded position.` : truncatedNote(p),
  summary: (p, ctx) =>
    `${ctx.firstName} has dismissed ${p.wicketsByPosition.total} batters: ${p.wicketsByPosition.groups.map((group) => `${group.label} ${group.count}`).join(', ')}.`,
  Front: ({ payload: p }) => {
    const { groups, notRecorded, caughtBy } = p.wicketsByPosition
    const rows = [...groups.map((group) => ({ key: group.key, label: group.label, count: group.count })), ...(notRecorded > 0 ? [{ key: 'not-recorded', label: NOT_RECORDED, count: notRecorded }] : [])]
    const more = caughtBy.length - CATCHERS_SHOWN
    return (
      <>
        <HorizontalBars
          dense
          alt={`Batters dismissed by position: ${rows.map((row) => `${row.label} ${row.count}`).join(', ')}.`}
          rows={rows.map((row) => ({ key: row.key, label: row.label, value: row.count, valueLabel: String(row.count) }))}
        />
        {caughtBy.length === 0 ? (
          <Note>No catches by the team's fielders recorded.</Note>
        ) : (
          <>
            <Split columns={[{ key: 'caught-by', title: 'Caught by', rows: caughtBy.slice(0, CATCHERS_SHOWN).map((fielder) => ({ key: fielder.name, label: fielder.name, value: String(fielder.count) })) }]} />
            {more > 0 && <Note>+{more} more</Note>}
          </>
        )}
      </>
    )
  },
  Back: ({ payload: p }) => {
    const { groups, notRecorded, caughtBy } = p.wicketsByPosition
    return (
      <>
        <Cap>Batters dismissed, by position</Cap>
        <FaceTable
          label="Batters dismissed by position"
          heads={['Position', 'Batters']}
          rows={[...groups.map((group) => ({ key: group.key, cells: [group.label, String(group.count)] })), ...(notRecorded > 0 ? [{ key: 'not-recorded', cells: [NOT_RECORDED, String(notRecorded)] }] : [])]}
        />
        <Cap>Caught by</Cap>
        {caughtBy.length === 0 ? (
          <Note>No catches by the team's fielders recorded.</Note>
        ) : (
          <FaceTable label="Catches taken off this bowler by fielder" heads={['Fielder', 'Catches']} rows={caughtBy.map((fielder) => ({ key: fielder.name, cells: [fielder.name, String(fielder.count)] }))} />
        )}
        <Note>Names are as the manager recorded them.</Note>
      </>
    )
  },
}
