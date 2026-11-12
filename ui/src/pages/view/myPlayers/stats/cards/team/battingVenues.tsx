import type { StatsCardDef } from '../../../../../../components/StatsCards'
import { HorizontalBars } from '../../../../../../components/StatsDrawings'
import type { MyTeamStatsDto } from '../../../../../../api/meStatsApi'
import { Cap, FaceTable, Note } from '../../cardParts'
import { formatCount, whereText, need } from '../../statsFormat'
import { homeTag } from '../../teamKit'

// docs/specs/147 Amendment 3, team.batting-venues: the runs the team scored at each venue (neutral sand bars, the home ground tagged
// Home). Back: the table. Source: venues.
const SHOWN = 5

export const teamBattingVenues: StatsCardDef<MyTeamStatsDto> = {
  id: 'team.batting-venues',
  page: 'team',
  group: 'batting',
  title: () => 'Runs At Each Venue',
  tag: 'PARTLY',
  needs: ['venues', 'basis'],
  order: 80,
  whenMissing: 'notCaptured',
  emptyText: 'No matches yet.',
  missingText: 'No venue is recorded on these matches.',
  state: (p) => {
    if (!p.venues) return 'missing'
    if (p.venues.length === 0) return 'empty'
    if (p.venues.every((venue) => venue.venueKey === 'unknown')) return 'missing'
    return p.venues.some((venue) => venue.venueKey === 'unknown') ? 'partial' : 'ready'
  },
  partialNote: (p) => `${need(p.venues).find((venue) => venue.venueKey === 'unknown')?.matches ?? 0} matches have no venue recorded.`,
  summary: (p) => `${p.teamName}'s runs at each venue: ${need(p.venues).map((venue) => `${venue.name} ${formatCount(venue.runsScored)}`).join(', ')}.`,
  Front: ({ payload: p }) => {
    const venues = [...need(p.venues)].sort((a, b) => (b.runsScored ?? 0) - (a.runsScored ?? 0)).slice(0, SHOWN)
    return (
      <>
        <HorizontalBars
          alt={`${p.teamName}'s runs at each venue: ${venues.map((venue) => `${venue.name}${venue.home === true ? ' (home)' : ''} ${formatCount(venue.runsScored)}`).join(', ')}.`}
          rows={venues.map((venue) => ({ key: venue.venueKey, label: venue.name, tag: homeTag(venue.home), value: venue.runsScored ?? 0, valueLabel: formatCount(venue.runsScored) }))}
        />
        <Note>{need(p.venues).length > SHOWN ? `Top ${SHOWN} of ${need(p.venues).length} venues. Flip for all.` : 'Runs scored at each playing area.'}</Note>
      </>
    )
  },
  Back: ({ payload: p }) => (
    <>
      <Cap>Batting at each venue</Cap>
      <FaceTable
        label="Matches, results and runs scored at each venue"
        heads={['Venue', 'Where', 'M', 'Won', 'Lost', 'Runs']}
        rows={need(p.venues).map((venue) => ({ key: venue.venueKey, cells: [venue.name, whereText(venue.home), String(venue.matches), String(venue.won), String(venue.lost), formatCount(venue.runsScored)] }))}
      />
    </>
  ),
}
