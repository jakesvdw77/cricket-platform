import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamExtrasComponent, MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { STATS_COLOUR } from '../../../../../../brandTokens'
import { Cap, FaceTable, Note, Tiles } from '../../cardParts'
import { DASH, dayText, formatCount, formatPercent } from '../../statsFormat'

// docs/specs/147 Addendum, team.extras-given: the extras the team gave away and received. Front: gave away, received and the share of the runs
// conceded, with the breakdown of wides, no-balls, byes and leg byes as bars. Back: the breakdown as a table and the extras given away
// match by match. PARTLY: summary-level results record no breakdown. Source: extrasCard, series.extrasConceded.
const SHOWN_ROWS = 6
// The front draws wides, no-balls, byes and leg byes (the four commonest); the back has every type.

const COMPONENTS = [
  { key: 'wides', label: 'Wides' },
  { key: 'noBalls', label: 'No-balls' },
  { key: 'byes', label: 'Byes' },
  { key: 'legByes', label: 'Leg byes' },
  { key: 'penaltyRuns', label: 'Penalty runs' },
] as const

// Penalty runs are a rare extra: drawn only when some innings recorded them.
const shown = (component: MyTeamExtrasComponent, key: string): boolean => key !== 'penaltyRuns' || (component.value ?? 0) > 0

export const teamExtrasGiven: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.extras-given',
  page: 'team',
  group: 'bowling',
  title: () => 'Extras Given',
  tag: 'PARTLY',
  needs: ['extrasCard', 'series', 'basis'],
  order: 50,
  whenMissing: 'hide',
  emptyText: 'No extras recorded yet.',
  state: (p) => {
    if (p.extrasCard.gaveAway.total === null && p.extrasCard.received.total === null) return 'empty'
    return p.extrasCard.partly ? 'partial' : 'ready'
  },
  partialNote: (p) => `The breakdown is itemised in ${p.extrasCard.gaveAway.wides.inningsRecorded} of ${p.extrasCard.gaveAway.wides.inningsCounted} innings.`,
  summary: (p) => `${p.teamName} gave away ${formatCount(p.extrasCard.gaveAway.total)} extras and received ${formatCount(p.extrasCard.received.total)}.`,
  Front: ({ payload: p }) => {
    const gave = p.extrasCard.gaveAway
    // Four bars fit the card: the four largest, in the usual order. The back table has every type.
    const rows = COMPONENTS.filter(({ key }) => shown(gave[key], key))
      .map(({ key, label }) => ({ key, label, value: gave[key].value ?? 0, valueLabel: formatCount(gave[key].value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
    return (
      <>
        <Tiles
          dense
          items={[
            { key: 'gave', label: 'Gave away', swatch: STATS_COLOUR.compareFirst, value: formatCount(gave.total) },
            { key: 'got', label: 'Received', swatch: STATS_COLOUR.compareSecond, value: formatCount(p.extrasCard.received.total) },
            { key: 'share', label: 'Of runs conceded', value: formatPercent(gave.sharePercent, 0) },
          ]}
        />
        <HorizontalBars
          rows={rows}
          alt={`Extras given away: ${rows.map((row) => `${row.label} ${row.valueLabel}`).join(', ')}. The back has the same in a table.`}
        />
      </>
    )
  },
  Back: ({ payload: p, ctx }) => {
    const gave = p.extrasCard.gaveAway
    const got = p.extrasCard.received
    const byMatch = [...p.series.extrasConceded].reverse().slice(0, SHOWN_ROWS)
    return (
      <>
        <Cap>Given away and received</Cap>
        <FaceTable
          label="Extras given away and received, by type"
          heads={['Type', 'Gave', 'Got']}
          rows={[
            ...COMPONENTS.filter(({ key }) => shown(gave[key], key) || shown(got[key], key)).map(({ key, label }) => ({
              key,
              cells: [label, formatCount(gave[key].value), formatCount(got[key].value)],
            })),
            { key: 'total', cells: ['Total', formatCount(gave.total), formatCount(got.total)] },
          ]}
        />
        {byMatch.length > 0 && (
          <>
            <Cap>Given away, match by match</Cap>
            <FaceTable
              label="Extras given away by match"
              heads={['Date and opponent', 'Gave']}
              rows={byMatch.map((point, index) => ({
                key: `${point.matchId}-${index}`,
                cells: [`${dayText(point.matchDate)}${point.opponentName ? ` v ${point.opponentName}` : ''}`, point.total === null ? DASH : String(point.total)],
                href: ctx.resultHref(point.matchId),
                linkName: `Open the match of ${dayText(point.matchDate)}`,
              }))}
            />
            {p.series.extrasConceded.length > SHOWN_ROWS && <Note>The latest {SHOWN_ROWS} of {p.series.extrasConceded.length} matches.</Note>}
          </>
        )}
        <Note>Fewer extras given away is a quiet way to win close games.</Note>
      </>
    )
  },
}
