import { describe, expect, it } from 'vitest'
import type { ScorecardPrefillPlayer, ScorecardPrefillSide } from '../api/matchResultApi'
import { lineupOrder, prefillSideRows, resetToSelection } from './scorecardPrefill'

let counter = 0
const key = () => `k${(counter += 1)}`

const prefillPlayer = (id: string, order: number | null, substitute = false): ScorecardPrefillPlayer => ({
  playerProfileId: id,
  firstName: id.toUpperCase(),
  lastName: 'Smith',
  plannedBattingOrder: order,
  role: 'BATSMAN',
  substitute,
})

const side = (players: ScorecardPrefillPlayer[]): ScorecardPrefillSide => ({
  side: 'HOME',
  teamId: 't1',
  teamName: '1st XI',
  players,
})

describe('scorecardPrefill', () => {
  it('lists the players in the planned order, the unordered after them and the 12th man last', () => {
    const ordered = lineupOrder([prefillPlayer('d', null), prefillPlayer('t', null, true), prefillPlayer('b', 2), prefillPlayer('a', 1)])
    expect(ordered.map((p) => p.playerProfileId)).toEqual(['a', 'b', 'd', 't'])
  })

  it('builds batting rows: wickets + 2 batted, the rest did not bat, the 12th man a player without a row', () => {
    const players = Array.from({ length: 11 }, (_, i) => prefillPlayer(`p${i + 1}`, i + 1))
    const { players: result, batting } = prefillSideRows(side([...players, prefillPlayer('twelfth', null, true)]), 4, key)
    expect(result).toHaveLength(12)
    expect(result[11]).toMatchObject({ playerProfileId: 'twelfth', substitute: true })
    expect(batting).toHaveLength(11)
    expect(batting.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(batting.slice(0, 6).every((entry) => entry.howOut === null)).toBe(true)
    expect(batting.slice(6).every((entry) => entry.howOut === 'DID_NOT_BAT')).toBe(true)
    expect(batting[0]).toMatchObject({ battingSide: 'HOME', inningsKind: 'REGULAR', resultPlayerId: null })
    expect(batting[0].playerClientKey).toBe(result[0].clientKey)
    expect(result[2].plannedBattingOrder).toBe(3)
  })

  it('starts empty with no selection', () => {
    expect(prefillSideRows(side([]), 6, key)).toEqual({ players: [], batting: [] })
  })

  it('reset to selection adds the missing planned players and re-snapshots the order, never removing a row', () => {
    const initial = prefillSideRows(side([prefillPlayer('a', 1), prefillPlayer('b', 2)]), 6, key)
    const edited = {
      players: initial.players.map((p) => (p.playerProfileId === 'a' ? { ...p, plannedBattingOrder: 5 } : p)),
      batting: initial.batting.map((e) => (e.position === 1 ? { ...e, runs: 40, howOut: 'CAUGHT' as const } : e)),
    }
    const reset = resetToSelection(edited, side([prefillPlayer('a', 1), prefillPlayer('b', 2), prefillPlayer('c', 3)]), key)
    expect(reset.players.map((p) => p.playerProfileId)).toEqual(['a', 'b', 'c'])
    expect(reset.players[0].plannedBattingOrder).toBe(1)
    expect(reset.batting).toHaveLength(3)
    expect(reset.batting[0]).toMatchObject({ runs: 40, howOut: 'CAUGHT' })
    expect(reset.batting[2]).toMatchObject({ position: 3, howOut: 'DID_NOT_BAT' })
  })

  it('reset keeps a guest and a swapped-in player and does not add a planned player twice', () => {
    const initial = prefillSideRows(side([prefillPlayer('a', 1)]), 6, key)
    const withGuest = {
      players: [...initial.players, { clientKey: 'g', side: 'HOME' as const, playerProfileId: null, displayName: 'Dewald', plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false }],
      batting: initial.batting,
    }
    const reset = resetToSelection(withGuest, side([prefillPlayer('a', 1)]), key)
    expect(reset.players).toHaveLength(2)
  })

  it('keeps one entry per profile, as the 12th man if either entry is a substitute', () => {
    const ordered = lineupOrder([prefillPlayer('a', 1), prefillPlayer('t', 2), prefillPlayer('t', null, true)])
    expect(ordered.map((p) => p.playerProfileId)).toEqual(['a', 't'])
    expect(ordered[1].substitute).toBe(true)
    const rows = prefillSideRows(side([prefillPlayer('a', 1), prefillPlayer('t', 2), prefillPlayer('t', null, true)]), 1, key)
    expect(rows.players.filter((p) => p.playerProfileId === 't')).toHaveLength(1)
    expect(rows.batting).toHaveLength(1)
  })
})
