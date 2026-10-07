import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EXPIRY_MS,
  MAX_ANSWERED_POLLS,
  MAX_REMEMBERED_PLAYERS,
  REMEMBERED_PLAYERS_KEY,
  forgetClub,
  listRememberedPlayers,
  rememberPlayer,
  removeRememberedPlayer,
} from './rememberedPlayers'

const NOW = Date.parse('2030-06-01T12:00:00Z')

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('rememberedPlayers', () => {
  it('stores names and the poll answered time, and nothing else', () => {
    rememberPlayer('club-1', 'poll-1', ' Liam ', 'Carter', NOW)
    const raw = localStorage.getItem(REMEMBERED_PLAYERS_KEY) ?? ''
    expect(JSON.parse(raw)).toEqual({
      version: 1,
      clubs: {
        'club-1': [
          {
            firstName: 'Liam',
            lastName: 'Carter',
            lastUsedAt: new Date(NOW).toISOString(),
            answered: { 'poll-1': new Date(NOW).toISOString() },
          },
        ],
      },
    })
    expect(listRememberedPlayers('club-1', NOW)).toHaveLength(1)
  })

  it('ignores a blank name', () => {
    rememberPlayer('club-1', 'poll-1', ' ', 'Carter', NOW)
    expect(localStorage.getItem(REMEMBERED_PLAYERS_KEY)).toBeNull()
  })

  it('keeps clubs apart', () => {
    rememberPlayer('club-1', 'p', 'Liam', 'Carter', NOW)
    rememberPlayer('club-2', 'p', 'Emma', 'Jones', NOW)
    expect(listRememberedPlayers('club-1', NOW).map((p) => p.firstName)).toEqual(['Liam'])
    expect(listRememberedPlayers('club-2', NOW).map((p) => p.firstName)).toEqual(['Emma'])
  })

  it('merges the same name case-insensitively and moves it to the front', () => {
    rememberPlayer('club-1', 'poll-1', 'Liam', 'Carter', NOW)
    rememberPlayer('club-1', 'poll-1', 'Emma', 'Carter', NOW + 1000)
    rememberPlayer('club-1', 'poll-2', 'liam', 'CARTER', NOW + 2000)
    const list = listRememberedPlayers('club-1', NOW + 3000)
    expect(list.map((p) => p.firstName)).toEqual(['liam', 'Emma'])
    expect(Object.keys(list[0].answered).sort()).toEqual(['poll-1', 'poll-2'])
  })

  it('caps at 10 players, dropping the least recently used', () => {
    for (let i = 0; i < 12; i++) rememberPlayer('club-1', 'p', `Player${i}`, 'X', NOW + i * 1000)
    const list = listRememberedPlayers('club-1', NOW + 20000)
    expect(list).toHaveLength(MAX_REMEMBERED_PLAYERS)
    expect(list[0].firstName).toBe('Player11')
    expect(list.map((p) => p.firstName)).not.toContain('Player0')
    expect(list.map((p) => p.firstName)).not.toContain('Player1')
  })

  it('keeps only the last 10 answered polls per player', () => {
    for (let i = 0; i < 13; i++) rememberPlayer('club-1', `poll-${i}`, 'Liam', 'Carter', NOW + i * 1000)
    const [player] = listRememberedPlayers('club-1', NOW + 20000)
    const polls = Object.keys(player.answered)
    expect(polls).toHaveLength(MAX_ANSWERED_POLLS)
    expect(polls).not.toContain('poll-0')
    expect(polls).toContain('poll-12')
  })

  it('expires players unused for about a year', () => {
    rememberPlayer('club-1', 'p', 'Old', 'Timer', NOW)
    rememberPlayer('club-1', 'p', 'Fresh', 'Face', NOW + EXPIRY_MS - 1000)
    const list = listRememberedPlayers('club-1', NOW + EXPIRY_MS + 1000)
    expect(list.map((p) => p.firstName)).toEqual(['Fresh'])
  })

  it('removes one player and forgets a club', () => {
    rememberPlayer('club-1', 'p', 'Liam', 'Carter', NOW)
    rememberPlayer('club-1', 'p', 'Emma', 'Carter', NOW + 1)
    rememberPlayer('club-2', 'p', 'Zed', 'Zed', NOW)
    removeRememberedPlayer('club-1', { firstName: 'LIAM', lastName: 'carter' }, NOW + 2)
    expect(listRememberedPlayers('club-1', NOW + 2).map((p) => p.firstName)).toEqual(['Emma'])
    forgetClub('club-1')
    expect(listRememberedPlayers('club-1', NOW + 2)).toEqual([])
    expect(listRememberedPlayers('club-2', NOW + 2)).toHaveLength(1)
  })

  it('treats corrupt JSON, a wrong version and a wrong shape as empty, then recovers', () => {
    localStorage.setItem(REMEMBERED_PLAYERS_KEY, '{not json')
    expect(listRememberedPlayers('club-1', NOW)).toEqual([])
    localStorage.setItem(REMEMBERED_PLAYERS_KEY, JSON.stringify({ version: 2, clubs: {} }))
    expect(listRememberedPlayers('club-1', NOW)).toEqual([])
    localStorage.setItem(REMEMBERED_PLAYERS_KEY, JSON.stringify({ version: 1, clubs: { 'club-1': 'nope' } }))
    expect(listRememberedPlayers('club-1', NOW)).toEqual([])
    rememberPlayer('club-1', 'p', 'Liam', 'Carter', NOW)
    expect(listRememberedPlayers('club-1', NOW)).toHaveLength(1)
  })

  it('drops malformed entries but keeps good ones', () => {
    localStorage.setItem(
      REMEMBERED_PLAYERS_KEY,
      JSON.stringify({
        version: 1,
        clubs: {
          'club-1': [
            { firstName: 'Good', lastName: 'One', lastUsedAt: new Date(NOW).toISOString(), answered: { p: 'bad date' } },
            { firstName: 5 },
            null,
          ],
        },
      }),
    )
    const list = listRememberedPlayers('club-1', NOW)
    expect(list).toHaveLength(1)
    expect(list[0].answered).toEqual({})
  })

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => rememberPlayer('club-1', 'p', 'Liam', 'Carter', NOW)).not.toThrow()
    expect(listRememberedPlayers('club-1', NOW)).toEqual([])
    expect(() => removeRememberedPlayer('club-1', { firstName: 'Liam', lastName: 'Carter' })).not.toThrow()
    expect(() => forgetClub('club-1')).not.toThrow()
  })
})
