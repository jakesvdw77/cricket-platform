import type { StatsCardDef } from '../../../../../../components/StatsCards'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { BigBars, Cap, FaceTable, Note } from '../../cardParts'
import { formatCount, formatDecimal } from '../../statsFormat'

// docs/specs/147 Amendment 3, team.sum-extras: the extras the team gave away. Front: the total with the largest components as bars. Back:
// the breakdown with the average per match and what the team received. Source: extras, extrasCard.
const PARTS = [
  { key: 'wides', label: 'Wides' },
  { key: 'noBalls', label: 'No-balls' },
  { key: 'byes', label: 'Byes' },
  { key: 'legByes', label: 'Leg byes' },
] as const

export const teamSumExtras: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.sum-extras',
  page: 'team',
  group: 'summary',
  title: () => 'Extras Conceded',
  tag: 'PARTLY',
  needs: ['extras', 'extrasCard', 'basis'],
  order: 90,
  size: 'compact',
  whenMissing: 'hide',
  emptyText: 'No extras recorded yet.',
  basis: (p) => ({ counted: p.extras.coverage.inningsWithExtras, total: p.extras.coverage.inningsCounted }),
  state: (p) => {
    if (p.extras.conceded === null) return 'empty'
    return p.extras.coverage.inningsWithExtras < p.extras.coverage.inningsCounted || p.extrasCard.partly ? 'partial' : 'ready'
  },
  partialNote: (p) => `Extras are recorded in ${p.extras.coverage.inningsWithExtras} of ${p.extras.coverage.inningsCounted} innings.`,
  summary: (p) => `${p.teamName} has given away ${formatCount(p.extras.conceded)} extras.`,
  Front: ({ payload: p }) => {
    const rows = PARTS.flatMap(({ key, label }) => (p.extras[key] === null ? [] : [{ key, label, value: p.extras[key] ?? 0, valueLabel: String(p.extras[key]) }])).sort((a, b) => b.value - a.value)
    return (
      <BigBars
        value={formatCount(p.extras.conceded)}
        caption="extras conceded"
        total={rows.length}
        alt={`${p.teamName}'s extras given away: ${rows.map((row) => `${row.label} ${row.valueLabel}`).join(', ')}.`}
        rows={rows}
      />
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Extras given away</Cap>
      <FaceTable
        label="Extras given away by type"
        heads={['Type', 'Gave', 'Received']}
        rows={[
          ...PARTS.map(({ key, label }) => ({ key, cells: [label, formatCount(p.extras[key]), formatCount(p.extrasCard.received[key].value)] })),
          { key: 'total', cells: ['Total', formatCount(p.extras.conceded), formatCount(p.extrasCard.received.total)] },
          { key: 'avg', cells: ['Per match', formatDecimal(p.extras.averagePerMatch, 1), '–'] },
        ]}
      />
      <Note>The breakdown is itemised in {p.extrasCard.gaveAway.wides.inningsRecorded} of {p.extrasCard.gaveAway.wides.inningsCounted} innings.</Note>
    </>
  ),
}
