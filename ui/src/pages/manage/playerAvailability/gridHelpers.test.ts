import { describe, expect, it } from 'vitest'
import {
  cellLabel,
  dateHeading,
  filterPlayers,
  firstUpcomingGame,
  footerCounts,
  footerLabel,
  footerText,
  groupGames,
  hasAnswers,
  kickoffText,
  nextGameDayMarker,
  openPollPath,
  orderedGames,
  pollKindLabel,
  pollPath,
  slotLabel,
} from './gridHelpers'
import { at, makeGame, makePlayer } from './testData'

const SAT_AM_1 = makeGame({ matchId: 'm1', matchDate: at(10, 3, 9), dayPart: 'MORNING' })
const SAT_AM_2 = makeGame({ matchId: 'm2', matchDate: at(10, 3, 10), dayPart: 'MORNING', label: 'Villagers 2 v Town' })
const SAT_PM = makeGame({ matchId: 'm3', matchDate: at(10, 3, 13), dayPart: 'AFTERNOON' })
const SUN_PM = makeGame({ matchId: 'm4', matchDate: at(10, 4, 14), dayPart: 'AFTERNOON' })

describe('groupGames', () => {
  it('groups date, then Morning/Afternoon, then games, in order', () => {
    const groups = groupGames([SAT_AM_1, SAT_AM_2, SAT_PM, SUN_PM])

    expect(groups.map((group) => group.dateKey)).toEqual(['2026-10-03', '2026-10-04'])
    expect(groups[0].gameCount).toBe(3)
    expect(groups[0].slots.map((slot) => [slot.dayPart, slot.games.map((game) => game.matchId)])).toEqual([
      ['MORNING', ['m1', 'm2']],
      ['AFTERNOON', ['m3']],
    ])
    // Sunday has no morning game, so there is no Morning slot at all.
    expect(groups[1].slots.map((slot) => slot.dayPart)).toEqual(['AFTERNOON'])
    expect(orderedGames(groups).map((game) => game.matchId)).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('returns nothing for no games', () => {
    expect(groupGames([])).toEqual([])
  })

  it('puts Morning before Afternoon even when the input interleaves them', () => {
    const groups = groupGames([SAT_PM, SAT_AM_1])
    expect(groups[0].slots.map((slot) => slot.dayPart)).toEqual(['MORNING', 'AFTERNOON'])
  })
})

describe('footer counts', () => {
  const players = [
    makePlayer('p1', 'Jane', 'Smith', 7, [['m1', 'AVAILABLE'], ['m2', 'NO_RESPONSE']]),
    makePlayer('p2', 'Bob', 'Jones', null, [['m1', 'UNSURE'], ['m2', 'NOT_IN_POLL']]),
    makePlayer('p3', 'Amy', 'Lee', null, [['m1', 'AVAILABLE'], ['m2', 'UNAVAILABLE']]),
  ]

  it('counts available / unsure / unavailable per game, ignoring no response and not in poll', () => {
    expect(footerCounts(players, 'm1')).toEqual({ available: 2, unsure: 1, unavailable: 0 })
    expect(footerCounts(players, 'm2')).toEqual({ available: 0, unsure: 0, unavailable: 1 })
    expect(footerCounts([], 'm1')).toEqual({ available: 0, unsure: 0, unavailable: 0 })
  })

  it('formats the text and the accessible label', () => {
    const counts = footerCounts(players, 'm1')
    expect(footerText(counts)).toBe('2 / 1 / 0')
    expect(footerLabel(counts)).toBe('2 available, 1 unsure, 0 unavailable')
  })
})

describe('filterPlayers', () => {
  const answered = makePlayer('p1', 'Jane', 'Smith', 7, [['m1', 'AVAILABLE']])
  const silent = makePlayer('p2', 'Bob', 'Jones', null, [['m1', 'NO_RESPONSE']])
  const outside = makePlayer('p3', 'Amy', 'Lee', null, [['m1', 'NOT_IN_POLL']])

  it('knows who has answers', () => {
    expect(hasAnswers(answered)).toBe(true)
    expect(hasAnswers(silent)).toBe(false)
    expect(hasAnswers(outside)).toBe(false)
  })

  it('searches the full name case-insensitively', () => {
    expect(filterPlayers([answered, silent], { search: ' JANE sm', hideUnanswered: false })).toEqual([answered])
    expect(filterPlayers([answered, silent], { search: 'zzz', hideUnanswered: false })).toEqual([])
  })

  it('hides players with no answers and combines with search', () => {
    expect(filterPlayers([answered, silent, outside], { search: '', hideUnanswered: true })).toEqual([answered])
    expect(filterPlayers([answered, silent], { search: 'bob', hideUnanswered: true })).toEqual([])
  })
})

describe('upcoming game and next-day marker', () => {
  it('finds the first game at or after now', () => {
    const now = new Date(2026, 9, 3, 9, 30)
    expect(firstUpcomingGame([SAT_AM_1, SAT_AM_2, SAT_PM], now)?.matchId).toBe('m2')
    expect(firstUpcomingGame([SAT_AM_1], new Date(2026, 9, 5))).toBeUndefined()
  })

  it('marks Today, Tomorrow or Next game day, and nothing once all games are past', () => {
    const groups = groupGames([SAT_AM_1, SUN_PM])
    expect(nextGameDayMarker(groups, new Date(2026, 9, 3, 18))).toEqual({ dateKey: '2026-10-03', text: 'Today' })
    expect(nextGameDayMarker(groups, new Date(2026, 9, 2, 12))).toEqual({ dateKey: '2026-10-03', text: 'Tomorrow' })
    expect(nextGameDayMarker(groups, new Date(2026, 9, 1, 12))).toEqual({ dateKey: '2026-10-03', text: 'Next game day' })
    expect(nextGameDayMarker(groups, new Date(2026, 9, 5, 12))).toBeNull()
  })
})

describe('labels and paths', () => {
  it('formats the date heading, kickoff and slot labels', () => {
    expect(dateHeading(new Date(2026, 9, 3))).toBe('Sat 3 Oct')
    expect(kickoffText(at(10, 3, 9, 5))).toBe('09:05')
    expect(slotLabel('MORNING')).toBe('Morning')
    expect(slotLabel('AFTERNOON', true)).toBe('PM')
  })

  it('builds the accessible cell label, with the poll kind and picked', () => {
    const player = makePlayer('p1', 'Anton', 'de Villiers', 17, [['m1', 'AVAILABLE', true]])
    const game = makeGame({ matchId: 'm1' })
    expect(cellLabel(player, game, player.cells[0])).toBe(
      'Anton de Villiers, Sat 3 Oct Morning, Villagers 1 v CBC: Available, group poll, picked',
    )
    expect(cellLabel(player, makeGame({ matchId: 'm1', pollType: 'SQUAD' }), { matchId: 'm1', status: 'NO_RESPONSE', picked: false })).toMatch(
      /: No response, squad poll$/,
    )
    expect(
      cellLabel(player, makeGame({ matchId: 'm1', pollType: null, pollId: null }), { matchId: 'm1', status: 'NOT_IN_POLL', picked: false }),
    ).toMatch(/: Not in this poll, no poll$/)
  })

  it('names the poll kind', () => {
    expect(pollKindLabel({ pollType: 'GROUP' })).toBe('group poll')
    expect(pollKindLabel({ pollType: 'SQUAD' })).toBe('squad poll')
    expect(pollKindLabel({ pollType: null })).toBe('no poll')
  })

  it('links a group game to its round (falling back to the poll id), a squad game to match and poll, none for no poll', () => {
    expect(pollPath(makeGame({ pollType: 'GROUP', roundId: 'r9', pollId: 'x' }))).toBe('/manage/availability/group/r9')
    expect(pollPath(makeGame({ pollType: 'GROUP', roundId: null, pollId: 'r8' }))).toBe('/manage/availability/group/r8')
    expect(pollPath(makeGame({ matchId: 'm5', pollType: 'SQUAD', pollId: 'p5', roundId: null }))).toBe('/manage/availability/squad/m5/p5')
    expect(pollPath(makeGame({ pollType: null, pollId: null, roundId: null }))).toBeNull()
  })

  it('builds the Open a poll link from the game section and match', () => {
    expect(openPollPath(makeGame({ matchId: 'm7', sectionId: 's7' }))).toBe(
      '/manage/availability/new?type=group&sectionId=s7&matchId=m7',
    )
  })

  it('omits sectionId from the Open a poll link when the game has none', () => {
    const path = openPollPath(makeGame({ matchId: 'm7', sectionId: null, teamId: null }))
    expect(path).toBe('/manage/availability/new?type=group&matchId=m7')
    expect(path).not.toContain('null')
  })
})
