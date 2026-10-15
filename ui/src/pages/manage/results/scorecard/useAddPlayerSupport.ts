import { useQuery } from '@tanstack/react-query'
import { listOppositionNames, resultKeys } from '../../../../api/matchResultApi'
import type { ResultSide, Scorecard, ScorecardPrefillSide } from '../../../../api/matchResultApi'
import { listSquad } from '../../../../api/teamSquadApi'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { playerRowKey } from '../../../../utils/scorecardPrefill'
import { matchSquadFor, playersOfSide } from '../scorecardDraft'
import type { PlayerIdentity } from '../scorecardDraft'
import type { OurSide } from '../steps/stepTypes'
import type { PickOption } from './PlayerPickCombo'

const lower = (text: string | null | undefined) => (text ?? '').trim().toLowerCase()

export interface AddPlayerSupportOptions {
  clubId: string
  matchId: string
  seasonId: string
  side: ResultSide
  // The ours side being shown, or null for the opposition.
  ours: OurSide | null
  scorecard: Scorecard
  prefillSide: ScorecardPrefillSide | null
  label: (name: PersonName) => string
}

// docs/specs/101-match-results-our-side-scorecard.md (Batting and Bowling, inline typing): what the trailing "Type a name to
// add a player" row offers and what each choice means. Our side: the registered squad players (match squad, then the team
// squad) who are not on the list yet, and the 12th man / substitutes already on it; anything else typed becomes a guest.
// The opposition: its substitutes, and the names used against it before (text only); anything typed becomes a new name.
// `identityOf` turns a chosen key into the player to add.
export function useAddPlayerSupport({ clubId, matchId, seasonId, side, ours, scorecard, prefillSide, label }: AddPlayerSupportOptions) {
  const squadQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams', ours?.teamId, 'seasons', seasonId, 'squad'],
    queryFn: () => listSquad(clubId, ours?.teamId as string, seasonId),
    enabled: Boolean(ours),
    staleTime: 60_000,
    retry: false,
  })
  const suggestionsQuery = useQuery({
    queryKey: resultKeys.oppositionNames(clubId, { matchId }),
    queryFn: () => listOppositionNames(clubId, { matchId }),
    enabled: !ours,
    staleTime: 60_000,
    retry: false,
  })

  const onSide = playersOfSide(scorecard, side)
  const listedProfiles = new Set(onSide.filter((player) => !player.substitute).map((player) => player.playerProfileId).filter(Boolean))
  const listedNames = new Set(onSide.map((player) => lower(player.displayName)).filter(Boolean))

  const options: PickOption[] = onSide
    .filter((player) => player.substitute)
    .map((player) => ({ key: `k:${playerRowKey(player)}`, label: label(scorecardPersonName(player)), hint: ours ? '12th man or substitute' : 'Substitute' }))

  const registered = new Map<string, { firstName: string; lastName: string; hint: string }>()
  if (ours) {
    for (const person of matchSquadFor(scorecard, side, prefillSide, false)) {
      if (!listedProfiles.has(person.playerProfileId)) registered.set(person.playerProfileId, { firstName: person.firstName, lastName: person.lastName, hint: 'Match squad' })
    }
    for (const member of squadQuery.data ?? []) {
      if (!listedProfiles.has(member.playerProfileId) && !registered.has(member.playerProfileId)) {
        registered.set(member.playerProfileId, { firstName: member.firstName, lastName: member.lastName, hint: 'Team squad' })
      }
    }
    for (const [profileId, person] of registered) {
      // A substitute already offered above is the same person.
      if (onSide.some((player) => player.substitute && player.playerProfileId === profileId)) continue
      options.push({ key: `p:${profileId}`, label: label({ firstName: person.firstName, lastName: person.lastName, id: profileId }), hint: person.hint })
    }
  } else {
    for (const suggestion of suggestionsQuery.data?.content ?? []) {
      if (!listedNames.has(lower(suggestion.displayName))) options.push({ key: `n:${suggestion.displayName}`, label: suggestion.displayName, hint: 'Played against us before' })
    }
  }

  const identityOf = (key: string): PlayerIdentity | null => {
    if (key.startsWith('p:')) {
      const person = registered.get(key.slice(2))
      return person ? { playerProfileId: key.slice(2), firstName: person.firstName, lastName: person.lastName } : null
    }
    if (key.startsWith('n:')) return { playerProfileId: null, displayName: key.slice(2), opposition: true }
    if (key.startsWith('k:')) {
      const player = onSide.find((candidate) => playerRowKey(candidate) === key.slice(2))
      if (!player) return null
      return player.playerProfileId
        ? { playerProfileId: player.playerProfileId, firstName: player.firstName, lastName: player.lastName }
        : { playerProfileId: null, displayName: player.displayName, opposition: Boolean(player.opposition) }
    }
    return null
  }
  const nameIdentity = (name: string): PlayerIdentity => ({ playerProfileId: null, displayName: name, opposition: !ours })

  return { options, identityOf, nameIdentity, addLabel: ours ? 'Add as a guest' : 'Add a new name' }
}
