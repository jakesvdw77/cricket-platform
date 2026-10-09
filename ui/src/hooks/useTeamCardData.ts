import { useQueries, useQuery } from '@tanstack/react-query'
import type { Team } from '../api/teamApi'
import type { Sponsor } from '../api/sponsorApi'
import type { TeamContact } from '../api/teamContactApi'
import { listTeamContacts } from '../api/teamContactApi'
import { listTeamSponsors } from '../api/teamSponsorApi'
import { listSquad } from '../api/teamSquadApi'
import { listMatches } from '../api/matchApi'

export interface TeamCardData {
  captainName: string | null
  managerName: string | null
  coachName: string | null
  playerCount: number
  matchCount: number
  // docs/specs/092: matches of the chosen season from today to today + 7 days (same rule as the Matches counter), from
  // the same loaded list as matchCount, so the Teams counters need no extra request.
  matchesThisWeek: number
  // False while this team's squad or the shared matches list is still loading, so a counter built from them can show
  // its loading state instead of a wrong zero. A query that is not enabled (no season yet) counts as loaded.
  loaded: boolean
  sponsors: Sponsor[]
}

const DAY_MS = 24 * 60 * 60 * 1000

// Start of today to the end of the day seven days on (exclusive upper bound = start of today + 8 days).
function weekWindow(now: Date): { from: number; to: number } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return { from, to: from + 8 * DAY_MS }
}

// The first team-contact whose role case-insensitively equals `role` — a display convenience over
// already-linked TeamContact data, not a new relationship (docs/specs/057-team-extended-profile.md's
// UI Requirements).
function contactNameByRole(contacts: TeamContact[], role: string): string | null {
  const match = contacts.find((teamContact) => teamContact.role.toLowerCase() === role.toLowerCase())
  if (!match) {
    return null
  }
  return `${match.contact.contact.firstName} ${match.contact.contact.lastName}`
}

// Shared by TeamDirectory.tsx and TeamList.tsx (docs/specs/057-team-extended-profile.md's approved
// "Detailed" card) — resolves the extra, previously-unfetched data that card density needs per
// visible team: this season's captain (from the squad), Manager/Coach (from TeamContact), player
// count, match count (client-side, filtered from the club's current-season matches), and sponsors.
// No new backend endpoint (per the spec's Non-goals) — batched per-team via useQueries, the same
// "small, bounded, N-requests-is-fine" posture this section's existing lists already use, plus one
// shared matches query (not per-team) filtered client-side per team's own home/away id.
export function useTeamCardData(
  clubId: string | undefined,
  teams: Team[],
  currentSeasonId: string | undefined,
): Record<string, TeamCardData> {
  const contactsQueries = useQueries({
    queries: teams.map((team) => ({
      queryKey: ['managed-club', clubId, 'sections', team.sectionId, 'teams', team.id, 'contacts'],
      queryFn: () => listTeamContacts(clubId as string, team.sectionId, team.id),
      enabled: Boolean(clubId),
    })),
  })

  const sponsorsQueries = useQueries({
    queries: teams.map((team) => ({
      queryKey: ['managed-club', clubId, 'sections', team.sectionId, 'teams', team.id, 'sponsors'],
      queryFn: () => listTeamSponsors(clubId as string, team.sectionId, team.id),
      enabled: Boolean(clubId),
    })),
  })

  const squadQueries = useQueries({
    queries: teams.map((team) => ({
      queryKey: ['managed-club', clubId, 'teams', team.id, 'seasons', currentSeasonId, 'squad'],
      queryFn: () => listSquad(clubId as string, team.id, currentSeasonId as string),
      enabled: Boolean(clubId) && Boolean(currentSeasonId),
    })),
  })

  const matchesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', 'current-season', currentSeasonId],
    queryFn: () => listMatches(clubId as string, { page: 0, size: 200, seasonId: currentSeasonId as string }),
    enabled: Boolean(clubId) && Boolean(currentSeasonId),
  })

  const matches = matchesQuery.data?.content ?? []
  const week = weekWindow(new Date())

  const result: Record<string, TeamCardData> = {}
  teams.forEach((team, index) => {
    const contacts = contactsQueries[index]?.data ?? []
    const sponsors = sponsorsQueries[index]?.data ?? []
    const squad = squadQueries[index]?.data ?? []
    const captain = squad.find((member) => member.isCaptain)

    const involvesTeam = (match: (typeof matches)[number]) => match.homeTeamId === team.id || match.awayTeamId === team.id
    result[team.id] = {
      captainName: captain ? `${captain.firstName} ${captain.lastName}` : null,
      managerName: contactNameByRole(contacts, 'Manager'),
      coachName: contactNameByRole(contacts, 'Coach'),
      playerCount: squad.length,
      matchCount: matches.filter(involvesTeam).length,
      matchesThisWeek: matches.filter((match) => {
        if (!involvesTeam(match)) return false
        const at = new Date(match.matchDate).getTime()
        return at >= week.from && at < week.to
      }).length,
      loaded: !squadQueries[index]?.isLoading && !matchesQuery.isLoading,
      sponsors,
    }
  })

  return result
}
