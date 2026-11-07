import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { battingBasis, truncatedNote } from '../../cardKit'
import { formatDecimal, formatPercent, plural } from '../../statsFormat'

// docs/specs/147 section 5, mine.bands: scores in bands (0-9, 10-29, 30-49, 50+); each bar is a link to the innings in that band. Back: the
// bands as a table, then the average at each batting position. The bands keep their fixed definitions whatever the age-band guides are.
// Source: bands, batting.positions.
export const mineBands: StatsCardDef<MyStatsDto> = {
  id: 'mine.bands',
  page: 'mine',
  group: 'batting',
  title: () => 'Scores in bands',
  tag: 'HAVE',
  needs: ['bands', 'batting', 'basis'],
  order: 40,
  whenMissing: 'hide',
  emptyText: 'Not enough innings yet.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    if (p.bands.reduce((sum, band) => sum + band.innings, 0) === 0) return 'empty'
    return p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: truncatedNote,
  summary: (p, ctx) => `${ctx.firstName}'s scores in bands: ${p.bands.map((band) => `${band.label} ${band.innings}`).join(', ')}.`,
  Front: ({ payload: p, ctx }) => (
    <>
      <HorizontalBars
        alt={`${ctx.firstName}'s innings by score band: ${p.bands.map((band) => `${band.label} ${band.innings}`).join(', ')}.`}
        rows={p.bands.map((band) => ({
          key: band.key,
          label: band.label,
          value: band.innings,
          valueLabel: String(band.innings),
          href: band.filter && band.innings > 0 ? ctx.drillHref({ kind: 'BATTING', filter: band.filter, label: `Scores of ${band.label}` }) : undefined,
        }))}
      />
      <Note>
        {plural(p.batting.fiftyPlus, 'fifty', 'fifties')}, {plural(p.batting.thirtyPlus, 'score', 'scores')} of 30 or more, {plural(p.batting.ducks, 'duck')}. Tap a bar to see those innings.
      </Note>
    </>
  ),
  Back: ({ payload: p }) => (
    <>
      <Cap>Scores by band</Cap>
      <FaceTable label="Innings in each score band" heads={['Band', 'Innings', 'Share']} rows={p.bands.map((band) => ({ key: band.key, cells: [band.label, String(band.innings), formatPercent(band.percent, 1)] }))} />
      <Cap>Where the batter bats</Cap>
      {p.batting.positions.length === 0 ? (
        <Note>Batting position is not recorded for these innings.</Note>
      ) : (
        <FaceTable
          label="Batting position and average"
          heads={['Position', 'Innings', 'Runs', 'Average']}
          rows={p.batting.positions.map((position) => ({ key: String(position.position), cells: [`No. ${position.position}`, String(position.innings), String(position.runs), formatDecimal(position.average)] }))}
        />
      )}
    </>
  ),
}
