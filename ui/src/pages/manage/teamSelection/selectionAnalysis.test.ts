import { describe, expect, it } from 'vitest'
import type { TeamSelectionMatch, TeamSelectionPick, TeamSelectionPlayer, TeamSelectionSide } from '../../../api/teamSelectionApi'
import { analyseSelection } from './selectionAnalysis'

const pick = (playerId: string, firstName: string, twelfthMan = false): TeamSelectionPick => ({
  playerId, firstName, lastName: 'X', battingOrder: twelfthMan ? null : 1, role: 'BATSMAN', captain: false, wicketKeeper: false, twelfthMan,
})
const side = (teamId: string, announced: boolean, picks: TeamSelectionPick[]) =>
  ({ sideId: `s-${teamId}`, teamId, teamName: `Team ${teamId}`, announced, picks } as unknown as TeamSelectionSide)
const match = (matchId: string, sides: TeamSelectionSide[], leagueId: string | null = null) =>
  ({ matchId, sides, leagueId, leagueName: leagueId ? `League ${leagueId}` : null } as unknown as TeamSelectionMatch)
const player = (playerId: string, firstName: string, cells: [string, string, TeamSelectionPlayer['cells'][number]['availability'], boolean][] = []) =>
  ({ playerId, firstName, lastName: 'X', pickedCount: 0, cells: cells.map(([matchId, teamId, availability, picked]) => ({ matchId, teamId, availability, picked })) } as unknown as TeamSelectionPlayer)

const matches = [
  match('m1', [side('a', true, [pick('p1', 'Ann'), pick('p2', 'Bob')])]),
  match('m2', [side('a', false, [pick('p1', 'Ann'), pick('p3', 'Cat', true)])]),
  match('m3', [side('b', false, [pick('p1', 'Ann')])], 'L1'),
]
const players = [
  player('p1', 'Ann', [['m1', 'a', 'AVAILABLE', true], ['m2', 'a', 'UNSURE', true], ['m3', 'b', 'AVAILABLE', true]]),
  player('p2', 'Bob', [['m1', 'a', 'AVAILABLE', true], ['m2', 'a', 'AVAILABLE', false]]),
  player('p3', 'Cat', [['m2', 'a', 'NO_RESPONSE', true]]),
  player('p4', 'Dan', [['m1', 'a', 'AVAILABLE', false]]),
]

describe('analyseSelection', () => {
  const all = analyseSelection({ matches, players }, { announcedOnly: false })

  it('counts playing and 12th man picks and sorts most picked first', () => {
    expect(all.rows.map((row) => [row.name, row.playing, row.twelfth, row.total])).toEqual([
      ['Ann X', 3, 0, 3],
      ['Bob X', 1, 0, 1],
      ['Cat X', 0, 1, 1],
      ['Dan X', 0, 0, 0],
    ])
    expect(all.games).toBe(3)
  })

  it('counts a game as available when the player said so or was picked', () => {
    expect(all.rows.find((row) => row.name === 'Ann X')?.available).toBe(3)
    expect(all.rows.find((row) => row.name === 'Bob X')?.available).toBe(2)
    expect(all.rows.find((row) => row.name === 'Cat X')?.available).toBe(1)
    expect(all.rows.find((row) => row.name === 'Dan X')?.available).toBe(1)
  })

  it('has the average, the figures and the tags', () => {
    expect(all.average).toBe(1.25)
    expect(all.notPicked).toBe(1)
    expect(all.scale).toBe(3)
    expect(all.rows.map((row) => row.tag)).toEqual(['ABOVE_AVERAGE', null, null, 'NOT_PICKED'])
  })

  it('counts announced teams only when asked', () => {
    const announced = analyseSelection({ matches, players }, { announcedOnly: true })
    expect(announced.games).toBe(1)
    expect(announced.rows.map((row) => [row.name, row.total])).toEqual([['Ann X', 1], ['Bob X', 1], ['Cat X', 0], ['Dan X', 0]])
  })

  it('handles no players and no matches', () => {
    expect(analyseSelection({ matches: [], players: [] }, { announcedOnly: false })).toMatchObject({ rows: [], average: 0, scale: 1, games: 0 })
  })
})
