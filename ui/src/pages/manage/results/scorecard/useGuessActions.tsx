import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ResultPlayer, Scorecard, ScorecardPrefill } from '../../../../api/matchResultApi'
import { PlayerSlotPicker } from '../../../../components/PlayerSlotPicker'
import type { PickedPlayer, PickerSuggestion } from '../../../../components/PlayerSlotPicker'
import { useTeamSectionLookup } from '../../../../hooks/useTeamSectionId'
import { splitName } from '../../../../utils/playerDisplayName'
import { playerRowKey } from '../../../../utils/scorecardPrefill'
import { guessLevelOf, noteFor, reasonPhrase } from '../import/guessSummary'
import type { GuessInfo } from '../import/guessSummary'
import { useImportReview } from '../import/importReviewContext'
import { confirmGuess, matchSquadFor, resolveImportedRow } from '../scorecardDraft'
import type { OurSide } from '../steps/stepTypes'

export interface GuessActionsOptions {
  clubId: string
  seasonId: string
  leagueId?: string | null
  oursSides: OurSide[]
  prefill: ScorecardPrefill | null
  scorecard: Scorecard
  onScorecard: (next: Scorecard) => void
}

const fullNameOf = (player: ResultPlayer) => [player.firstName, player.lastName].filter(Boolean).join(' ').trim()

const asPicked = (suggestion: { playerProfileId: string; displayName: string }): PickedPlayer => {
  const name = splitName(suggestion.displayName)
  return { playerProfileId: suggestion.playerProfileId, firstName: name.firstName, lastName: name.lastName }
}

// docs/specs/104-match-results-import-adaptors.md: everything behind a Guess chip, shared by every step that shows one
// (Teams, Batting, Bowling and fielding, the dismissal pickers). `guessOf(player)` is what a row hands to its chip (undefined
// for a row with nothing to check, and always for a result that was not imported); Confirm clears the flag and Change opens
// the shared picker with what the file said and, for a name that was not placed, the ranked closest players. `host` is the
// picker, rendered once per step. Works on the row's own side, so a fielder of the other side is changed as readily as a
// batter. Every write goes through the step's `onScorecard`, so the normal save persists it (and the server writes the
// remembered name).
export function useGuessActions({ clubId, seasonId, leagueId, oursSides, prefill, scorecard, onScorecard }: GuessActionsOptions) {
  const review = useImportReview()
  const [pickerKey, setPickerKey] = useState<string | null>(null)

  const guessOf = (player: ResultPlayer | undefined): GuessInfo | undefined => {
    if (!player || review.provider === null) return undefined
    const level = guessLevelOf(player, review.notes)
    if (level === null || !player.displayName) return undefined
    const key = playerRowKey(player)
    const note = noteFor(review.notes, player.displayName)
    const suggestions = note?.suggestions ?? []
    const top = level === 'UNRESOLVED' ? (suggestions[0] ?? null) : null
    const topTaken = top ? scorecard.players.some((other) => other.side === player.side && !other.substitute && playerRowKey(other) !== key && other.playerProfileId === top.playerProfileId) : false
    return {
      key,
      importedName: player.displayName,
      level,
      matchedName: level === 'UNRESOLVED' ? null : (note?.candidateName || fullNameOf(player) || null),
      reason: reasonPhrase(note),
      closest: suggestions[0] ?? null,
      suggestions,
      onConfirm: level === 'UNRESOLVED' ? undefined : () => onScorecard(confirmGuess(scorecard, key)),
      onUseClosest: top && !topTaken ? () => onScorecard(resolveImportedRow(scorecard, key, asPicked(top))) : undefined,
      onChange: () => setPickerKey(key),
    }
  }

  const row = pickerKey ? scorecard.players.find((candidate) => playerRowKey(candidate) === pickerKey) : undefined
  const ours = row ? (oursSides.find((side) => side.side === row.side) ?? null) : null
  const prefillSide = row ? (prefill?.sides.find((side) => side.side === row.side) ?? null) : null
  const taken: Record<string, string> = {}
  const takenGuests: string[] = []
  for (const candidate of scorecard.players) {
    if (!row || candidate.side !== row.side || playerRowKey(candidate) === pickerKey || candidate.substitute) continue
    if (candidate.playerProfileId) taken[candidate.playerProfileId] = 'Already on this side'
    else if (candidate.displayName) takenGuests.push(candidate.displayName)
  }
  const suggestions: PickerSuggestion[] = row?.displayName ? (noteFor(review.notes, row.displayName)?.suggestions ?? []).map((s) => ({ player: asPicked(s), score: s.score })) : []
  const unresolved = row ? !row.playerProfileId : false
  const { sectionId, pending: sectionPending } = useTeamSectionLookup(clubId, ours?.teamId ?? null, row !== undefined)

  const host: ReactNode = (
    <PlayerSlotPicker
      open={row !== undefined}
      onClose={() => setPickerKey(null)}
      clubId={clubId}
      teamId={ours?.teamId ?? null}
      seasonId={seasonId}
      title={unresolved ? 'Link to a registered player' : 'Choose the player'}
      importedName={row?.displayName ?? undefined}
      suggestions={suggestions}
      takenPlayers={taken}
      takenGuests={takenGuests}
      allowGuest={!unresolved}
      newPlayer={unresolved && row?.displayName ? { name: row.displayName, sectionId, leagueId, seasonId } : undefined}
      clubScope={ours?.teamId ? { sectionId, leagueId, sectionPending } : undefined}
      matchSquad={row ? matchSquadFor(scorecard, row.side, prefillSide, false) : undefined}
      onPickPlayer={(picked) => {
        if (pickerKey) onScorecard(resolveImportedRow(scorecard, pickerKey, { playerProfileId: picked.playerProfileId, firstName: picked.firstName, lastName: picked.lastName }))
        setPickerKey(null)
      }}
      onPickGuest={(displayName) => {
        if (pickerKey) onScorecard(resolveImportedRow(scorecard, pickerKey, { playerProfileId: null, displayName }))
        setPickerKey(null)
      }}
    />
  )

  return { guessOf, host }
}
