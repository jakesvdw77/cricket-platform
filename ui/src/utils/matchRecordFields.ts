import type { RecordCardField } from '../components/RecordCard'
import type { Match } from '../api/matchApi'
import type { League } from '../api/leagueApi'
import type { Season } from '../api/seasonApi'

// The RecordCardField set for a Match — shared by MatchList.tsx and SquadPicker.tsx's reused
// card shape (docs/specs/029-league-management.md). Pulled into its own utility (rather than
// exported straight from MatchList.tsx) so importing it doesn't defeat React Fast Refresh on that
// page — same reasoning as sponsorRecordFields.ts/playerRecordFields.ts.
export function matchFields(
  match: Match,
  leaguesById: Map<string, League>,
  seasonsById: Map<string, Season>,
): RecordCardField[] {
  const fields: RecordCardField[] = [{ label: 'Date & time', value: new Date(match.matchDate).toLocaleString() }]

  if (match.venue) {
    fields.push({ label: 'Venue', value: match.venue })
  }

  const league = match.leagueId ? leaguesById.get(match.leagueId) : undefined
  const season = seasonsById.get(match.seasonId)
  if (league || season) {
    fields.push({
      label: 'League / Season',
      value: [league?.name, season?.label].filter(Boolean).join(' — ') || '—',
    })
  }

  return fields
}
