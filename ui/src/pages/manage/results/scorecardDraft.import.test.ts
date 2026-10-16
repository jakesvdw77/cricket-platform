import { describe, expect, it } from 'vitest'
import type { ResultPlayer, Scorecard } from '../../../api/matchResultApi'
import { confirmGuess, linkGuest, resolveImportedRow, swapPlayer } from './scorecardDraft'

// docs/specs/104: how a manager's confirm, change or link settles an imported guess. The client can only ever clear the flag.

const player = (key: string, profile: string | null, patch: Partial<ResultPlayer> = {}): ResultPlayer => ({
  clientKey: key, side: 'HOME', playerProfileId: profile, displayName: profile ? 'Ann A' : 'Dino V', plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false,
  firstName: profile ? key.toUpperCase() : null, lastName: profile ? 'Smith' : null, ...patch,
})
const card = (): Scorecard => ({
  players: [player('a', 'pa', { importMatch: 'NORMALISED' }), player('b', 'pb'), player('g', null, { guest: true })],
  batting: [], bowling: [], fielding: [], awards: [],
})
const find = (scorecard: Scorecard, key: string) => scorecard.players.find((p) => p.clientKey === key)

describe('confirmGuess', () => {
  it('clears the flag and keeps the player and the file spelling', () => {
    const next = confirmGuess(card(), 'a')
    expect(find(next, 'a')).toMatchObject({ playerProfileId: 'pa', displayName: 'Ann A', importMatch: null })
    expect(find(next, 'b')).toEqual(find(card(), 'b'))
  })
})

describe('a different player settles the guess', () => {
  it('a swap clears the flag', () => {
    expect(find(swapPlayer(card(), 'a', { playerProfileId: 'pz', firstName: 'Zed', lastName: 'Zulu' }), 'a')?.importMatch).toBeNull()
  })

  it('linking a guest clears the flag', () => {
    expect(find(linkGuest(card(), 'g', { playerProfileId: 'pz', firstName: 'Zed', lastName: 'Zulu' }), 'g')?.importMatch).toBeNull()
  })
})

describe('resolveImportedRow', () => {
  it('links the row to the chosen player, keeping the name the file wrote, and clears the flag', () => {
    const next = resolveImportedRow(card(), 'a', { playerProfileId: 'pz', firstName: 'Zed', lastName: 'Zulu' })
    expect(find(next, 'a')).toMatchObject({ playerProfileId: 'pz', firstName: 'Zed', lastName: 'Zulu', displayName: 'Ann A', guest: false, importMatch: null })
  })

  it('links an unresolved guest to a registered player', () => {
    const next = resolveImportedRow(card(), 'g', { playerProfileId: 'pz', firstName: 'Zed', lastName: 'Zulu' })
    expect(find(next, 'g')).toMatchObject({ playerProfileId: 'pz', displayName: 'Dino V', guest: false })
  })

  it('keeps the row a guest when a guest name is chosen', () => {
    const next = resolveImportedRow(card(), 'a', { playerProfileId: null, displayName: 'Someone New' })
    expect(find(next, 'a')).toMatchObject({ playerProfileId: null, displayName: 'Someone New', guest: true, firstName: null, importMatch: null })
  })

  it('is refused when the registered player already plays for the side', () => {
    expect(resolveImportedRow(card(), 'a', { playerProfileId: 'pb', firstName: 'B', lastName: 'Smith' })).toEqual(card())
  })

  it('promotes the 12th man by removing his duplicate row', () => {
    const withSub: Scorecard = { ...card(), players: [...card().players, player('s', 'pz', { substitute: true })] }
    const next = resolveImportedRow(withSub, 'a', { playerProfileId: 'pz', firstName: 'Z', lastName: 'Smith' })
    expect(next.players.filter((p) => p.playerProfileId === 'pz')).toHaveLength(1)
    expect(find(next, 'a')?.playerProfileId).toBe('pz')
  })

  it('does nothing for a row that is not there', () => {
    expect(resolveImportedRow(card(), 'nope', { playerProfileId: 'pz' })).toEqual(card())
  })
})
