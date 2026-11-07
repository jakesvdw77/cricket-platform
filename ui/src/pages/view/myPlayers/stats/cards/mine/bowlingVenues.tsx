import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { bowlingBasis } from '../../cardKit'
import { clip, formatDecimal, oversOrBalls, plural, whereText } from '../../statsFormat'

// docs/specs/147 Amendment 2 item 6, mine.bowling-venues: wickets at each venue with the economy beside each (in the small line under the
// venue name, with "Home" where it is a home venue). Back: the table. Source: bowlingVenues.
const SHOWN = 8

export const mineBowlingVenues: StatsCardDef<MyStatsDto> = {
  id: 'mine.bowling-venues',
  page: 'mine',
  group: 'bowling',
  title: () => 'Bowling At Each Venue',
  tag: 'PARTLY',
  needs: ['bowlingVenues', 'basis'],
  order: 50,
  whenMissing: 'notCaptured',
  emptyText: 'No bowling yet.',
  missingText: 'No venue is recorded on these matches.',
  basis: (p) => bowlingBasis(p),
  state: (p) => {
    if (p.bowlingVenues.length === 0) return 'empty'
    if (p.bowlingVenues.every((venue) => venue.venueKey === 'unknown')) return 'missing'
    return p.bowlingVenues.some((venue) => venue.venueKey === 'unknown') ? 'partial' : 'ready'
  },
  partialNote: (p) => {
    const unknown = p.bowlingVenues.find((venue) => venue.venueKey === 'unknown')
    return `${plural(unknown?.spells ?? 0, 'spell')} have no venue recorded.`
  },
  summary: (p, ctx) => `${ctx.firstName}'s wickets at each venue: ${p.bowlingVenues.map((venue) => `${venue.name} ${venue.wickets}`).join(', ')}.`,
  Front: ({ payload: p, ctx }) => {
    const venues = p.bowlingVenues.slice(0, SHOWN)
    const tagOf = (home: boolean | null, economy: number | null) => `${home === true ? 'Home · ' : ''}Econ ${formatDecimal(economy, 2)}`
    return (
      <>
        <HorizontalBars
          alt={`${ctx.firstName}'s wickets at each venue, with the economy: ${venues.map((venue) => `${venue.name}${venue.home === true ? ' (home)' : ''} ${venue.wickets} wickets, economy ${formatDecimal(venue.economy, 2)}`).join('; ')}.`}
          rows={venues.map((venue) => ({ key: venue.venueKey, label: clip(venue.name), tag: tagOf(venue.home, venue.economy), value: venue.wickets, valueLabel: String(venue.wickets) }))}
        />
        <Note>Wickets at each playing area, with the economy rate under the name. Flip for the table.</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Bowling at each venue</Cap>
      <FaceTable
        label="Bowling at each venue"
        heads={['Venue', 'Where', 'Spells', 'Overs', 'Runs', 'Wkts', 'Econ']}
        rows={p.bowlingVenues.map((venue) => ({
          key: venue.venueKey,
          cells: [venue.name, whereText(venue.home), String(venue.spells), oversOrBalls(venue.balls, venue.ballsPerOver), String(venue.runs), String(venue.wickets), formatDecimal(venue.economy, 2)],
        }))}
      />
    </>
  ),
}
