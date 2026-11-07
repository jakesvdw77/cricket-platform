import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { battingBasis, truncatedNote } from '../../cardKit'
import { formatDecimal, plural, whereText } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 6, mine.batting-venues: runs at each venue. Front: bars of runs per venue, a home venue marked "Home"
// (venues beyond the server's cap arrive as "Other venues", a match with no playing area as "Unknown venue"). Back: the table. Source: battingVenues.
const SHOWN = 4

export const mineBattingVenues: StatsCardDef<MyStatsDto> = {
  id: 'mine.batting-venues',
  page: 'mine',
  group: 'batting',
  title: () => 'Runs At Each Venue',
  tag: 'PARTLY',
  needs: ['battingVenues', 'basis'],
  order: 65,
  whenMissing: 'notCaptured',
  emptyText: 'Not enough innings yet.',
  missingText: 'No venue is recorded on these matches.',
  basis: (p) => battingBasis(p),
  state: (p) => {
    if (p.battingVenues.length === 0) return 'empty'
    const known = p.battingVenues.filter((venue) => venue.venueKey !== 'unknown')
    if (known.length === 0) return 'missing'
    return p.battingVenues.some((venue) => venue.venueKey === 'unknown') || p.basis.truncated ? 'partial' : 'ready'
  },
  partialNote: (p) => {
    const unknown = p.battingVenues.find((venue) => venue.venueKey === 'unknown')
    return unknown ? `${plural(unknown.innings, 'innings', 'innings')} have no venue recorded.` : truncatedNote(p)
  },
  summary: (p, ctx) => `${ctx.firstName}'s runs at each venue: ${p.battingVenues.map((venue) => `${venue.name} ${venue.runs}`).join(', ')}.`,
  Front: ({ payload: p, ctx }) => {
    const venues = p.battingVenues.slice(0, SHOWN)
    return (
      <>
        <HorizontalBars
          alt={`${ctx.firstName}'s runs at each venue: ${venues.map((venue) => `${venue.name}${venue.home === true ? ' (home)' : ''} ${venue.runs}`).join(', ')}.`}
          rows={venues.map((venue) => ({ key: venue.venueKey, label: venue.name, tag: venue.home === true ? 'Home' : undefined, value: venue.runs, valueLabel: String(venue.runs) }))}
        />
        <Note>{p.battingVenues.length > SHOWN ? `Top ${SHOWN} of ${p.battingVenues.length} venues. Flip for all.` : 'Runs scored at each playing area.'}</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Batting at each venue</Cap>
      <FaceTable
        label="Batting at each venue"
        heads={['Venue', 'Where', 'Inns', 'Out', 'Runs', 'Avg']}
        rows={p.battingVenues.map((venue) => ({ key: venue.venueKey, cells: [venue.name, whereText(venue.home), String(venue.innings), String(venue.dismissals), String(venue.runs), formatDecimal(venue.average)] }))}
      />
    </>
  ),
}
