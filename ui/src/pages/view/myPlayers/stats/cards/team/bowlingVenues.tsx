import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { formatCount, whereText } from '../../statsFormat'
import { homeTag } from '../../teamKit'

// docs/specs/147 Amendment 3, team.bowling-venues: the wickets the team took at each venue (neutral sand bars, the home ground tagged Home).
// Back: the table. Source: venues.
const SHOWN = 5

export const teamBowlingVenues: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.bowling-venues',
  page: 'team',
  group: 'bowling',
  title: () => 'Wickets At Each Venue',
  tag: 'PARTLY',
  needs: ['venues', 'basis'],
  order: 60,
  whenMissing: 'notCaptured',
  emptyText: 'No matches yet.',
  missingText: 'No venue is recorded on these matches.',
  state: (p) => {
    if (p.venues.length === 0) return 'empty'
    if (p.venues.every((venue) => venue.venueKey === 'unknown')) return 'missing'
    return p.venues.some((venue) => venue.venueKey === 'unknown') ? 'partial' : 'ready'
  },
  partialNote: (p) => `${p.venues.find((venue) => venue.venueKey === 'unknown')?.matches ?? 0} matches have no venue recorded.`,
  summary: (p) => `${p.teamName}'s wickets at each venue: ${p.venues.map((venue) => `${venue.name} ${formatCount(venue.wicketsTaken)}`).join(', ')}.`,
  Front: ({ payload: p }) => {
    const venues = [...p.venues].sort((a, b) => (b.wicketsTaken ?? 0) - (a.wicketsTaken ?? 0)).slice(0, SHOWN)
    return (
      <>
        <HorizontalBars
          alt={`${p.teamName}'s wickets at each venue: ${venues.map((venue) => `${venue.name}${venue.home === true ? ' (home)' : ''} ${formatCount(venue.wicketsTaken)}`).join(', ')}.`}
          rows={venues.map((venue) => ({ key: venue.venueKey, label: venue.name, tag: homeTag(venue.home), value: venue.wicketsTaken ?? 0, valueLabel: formatCount(venue.wicketsTaken) }))}
        />
        <Note>{p.venues.length > SHOWN ? `Top ${SHOWN} of ${p.venues.length} venues. Flip for all.` : 'Wickets taken at each playing area.'}</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Bowling at each venue</Cap>
      <FaceTable
        label="Matches, wickets taken and runs conceded at each venue"
        heads={['Venue', 'Where', 'M', 'Wkts', 'Conceded']}
        rows={p.venues.map((venue) => ({ key: venue.venueKey, cells: [venue.name, whereText(venue.home), String(venue.matches), formatCount(venue.wicketsTaken), formatCount(venue.runsConceded)] }))}
      />
    </>
  ),
}
