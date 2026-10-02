import api from './axiosConfig'
import type { Player } from './playerApi'
import type { DayPart } from './sectionAvailabilityApi'

// docs/specs/063-section-availability-and-flexible-squads.md Part B/C: the per-fixture squad pool
// for a side covered by a group poll (064), replacing what teamSquadApi.ts's TeamSquadMember does
// for a side without one (the season squad). `GET .../squad` resolves this side's own (section, date, day-part) bracket and, if
// a SectionAvailabilityWindow already exists for it, returns the live candidate pool (everyone who
// said Available for that bracket) alongside the current picks.
export interface MatchSquadPickedElsewhere {
  matchId: string
  teamId: string
  teamName: string
}

export interface MatchSquadCandidate {
  playerProfileId: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  // Set when this candidate already holds a MatchSquadMember row elsewhere in this exact bracket
  // (docs/specs/063's Part C hard block) — an inline indicator, never a silently-hidden candidate.
  pickedElsewhere: MatchSquadPickedElsewhere | null
}

// Mirrors teamSquadApi.ts's own SquadMember shape field-for-field (docs/specs/063's own deliberate
// reuse decision, Rollout Notes) — `id` is the MatchSquadMember row's own id, `isCaptain` is always
// false here (captaincy stays exclusively on MatchSide.captainPlayerId for every squad mode).
export interface MatchSquadMember extends Player {
  playerProfileId: string
  squadJerseyNumber: number | null
  isCaptain: boolean
}

export interface MatchSquad {
  sectionId: string
  windowDate: string
  dayPart: DayPart
  // null when no SectionAvailabilityWindow has been opened yet for this side's resolved bracket -
  // the UI offers a pre-filled shortcut straight to the fixture-group review page, this exact
  // matchId already pre-selected, rather than a blind "create for this date" form.
  windowId: string | null
  windowOpen: boolean
  // docs/specs/063-section-availability-and-flexible-squads.md's fixture-group-selection revision:
  // the round that owns this side's resolved window - lets MatchSideTab (033's tinting) fetch
  // round-level responses without a second lookup. Only non-null alongside a non-null windowId.
  roundId: string | null
  candidates: MatchSquadCandidate[]
  selected: MatchSquadMember[]
}

function squadPath(clubId: string, matchId: string, teamId: string): string {
  return `/manage/clubs/${clubId}/matches/${matchId}/teams/${teamId}/squad`
}

export async function getMatchSquad(clubId: string, matchId: string, teamId: string): Promise<MatchSquad> {
  const { data } = await api.get<MatchSquad>(squadPath(clubId, matchId, teamId))
  return data
}

export async function addToMatchSquad(
  clubId: string,
  matchId: string,
  teamId: string,
  playerId: string,
): Promise<MatchSquadMember> {
  const { data } = await api.post<MatchSquadMember>(`${squadPath(clubId, matchId, teamId)}/${playerId}/add`)
  return data
}

export async function removeFromMatchSquad(clubId: string, matchId: string, teamId: string, playerId: string): Promise<void> {
  await api.post(`${squadPath(clubId, matchId, teamId)}/${playerId}/remove`)
}

export async function updateMatchSquadJerseyNumber(
  clubId: string,
  matchId: string,
  teamId: string,
  playerId: string,
  jerseyNumber: number | null,
): Promise<MatchSquadMember> {
  const { data } = await api.put<MatchSquadMember>(`${squadPath(clubId, matchId, teamId)}/${playerId}`, { jerseyNumber })
  return data
}
