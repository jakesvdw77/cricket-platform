import { describe, expect, it } from 'vitest'
import type { CellStatus, GameColumn, PlayerRow } from '../../../../api/playerAvailabilityApi'
import { at, makeGame, makePlayer } from '../../playerAvailability/testData'
import { computeSlotCoverage, hintToString, maxMatching, slotHint } from './slotCoverage'
import type { SlotCoverage } from './slotCoverage'

const XI = new Map([
  ['L11', 11],
  ['L9', 9],
  ['L1', 1],
])
const NAMES: Record<string, string> = { t1: 'Villagers 1', t2: 'Villagers 2', t3: 'Villagers 3' }
const name = (id: string) => NAMES[id] ?? id

// A squad-poll game for a team in the Saturday afternoon slot unless overridden.
function game(matchId: string, teamId: string | null, overrides: Partial<GameColumn> = {}): GameColumn {
  return makeGame({
    matchId,
    teamId,
    leagueId: 'L11',
    pollType: 'SQUAD',
    pollId: `poll-${matchId}`,
    roundId: null,
    matchDate: at(10, 3, 13),
    dayPart: 'AFTERNOON',
    label: `${teamId} v CBC`,
    ...overrides,
  })
}

function ids(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`)
}

type Answers = Array<[matchId: string, status: CellStatus, ids: string[]]>

// One player row per distinct id; a cell for every game, NO_RESPONSE unless the answers say otherwise.
function roster(games: GameColumn[], answers: Answers): PlayerRow[] {
  const everyone = [...new Set(answers.flatMap(([, , list]) => list))]
  return everyone.map((id) =>
    makePlayer(
      id,
      'First',
      id,
      null,
      games.map((g) => {
        const hit = answers.find(([matchId, , list]) => matchId === g.matchId && list.includes(id))
        return [g.matchId, hit ? hit[1] : 'NO_RESPONSE']
      }),
    ),
  )
}

function compute(games: GameColumn[], answers: Answers, xi = XI): SlotCoverage[] {
  return computeSlotCoverage({ games, players: roster(games, answers), xiSizeByLeagueId: xi })
}

function only(games: GameColumn[], answers: Answers, xi = XI): SlotCoverage {
  const slots = compute(games, answers, xi)
  expect(slots).toHaveLength(1)
  return slots[0]
}

const teamOf = (slot: SlotCoverage, teamId: string) => slot.teams.find((team) => team.teamId === teamId)!
const hint = (slot: SlotCoverage, compact = false) => {
  const parts = slotHint(slot, name, compact)
  return parts ? hintToString(parts) : null
}

const G1 = game('m1', 't1')
const G2 = game('m2', 't2')

describe('computeSlotCoverage verdicts', () => {
  it('covers two teams that each have 11 own-only players (13/13 with 2 shared)', () => {
    const shared = ['s01', 's02']
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 11), ...shared]],
      ['m2', 'AVAILABLE', [...ids('b', 11), ...shared]],
    ])

    expect(slot.status).toBe('COVERED')
    expect(slot.distinctAvailable).toBe(24)
    expect(slot.placesNeeded).toBe(22)
    expect(slot.sharedIds).toEqual(shared)
    expect(slot.spare).toBe(2)
    expect(teamOf(slot, 't1')).toMatchObject({ available: 13, ownOnly: 11, shared: 2, needed: 11 })
    expect(hint(slot)).toBeNull()
  })

  it('is TIGHT for 13/12 with 2 shared (the mockup example): Villagers 2 has only 10 own-only', () => {
    const shared = ['s01', 's02']
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 11), ...shared]],
      ['m2', 'AVAILABLE', [...ids('b', 10), ...shared]],
    ])

    expect(slot.status).toBe('TIGHT')
    expect(slot.distinctAvailable).toBe(23)
    expect(slot.split).toEqual([{ teamId: 't2', shortfall: 1 }])
    expect(slot.spare).toBe(1)
    expect(hint(slot)).toBe('Works only if 1 of the 2 shared players go to Villagers 2 (1 spare).')
  })

  it('is TIGHT for 15/14 with 6 shared each: split 2 and 3, 1 spare, 23 distinct', () => {
    const shared = ids('s', 6)
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 9), ...shared]],
      ['m2', 'AVAILABLE', [...ids('b', 8), ...shared]],
    ])

    expect(slot.status).toBe('TIGHT')
    expect(slot.distinctAvailable).toBe(23)
    expect(slot.placesNeeded).toBe(22)
    expect(slot.split).toEqual([
      { teamId: 't1', shortfall: 2 },
      { teamId: 't2', shortfall: 3 },
    ])
    expect(slot.spare).toBe(1)
    expect(hint(slot)).toBe('Works only if the 6 shared players are split: 2 to Villagers 1, 3 to Villagers 2 (1 spare).')
  })

  it('is SHORT by 5 for 11/9 with 3 shared each, naming Villagers 2', () => {
    const shared = ids('s', 3)
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 8), ...shared]],
      ['m2', 'AVAILABLE', [...ids('b', 6), ...shared]],
    ])

    expect(slot.status).toBe('SHORT')
    expect(slot.shortBy).toBe(5)
    expect(slot.distinctAvailable).toBe(17)
    expect(hint(slot)).toBe(
      'Villagers 2 cannot reach 11 even with every shared player. ' +
        'The 3 shared players are contended between Villagers 1 and Villagers 2. Chase 5 more players.',
    )
  })

  it('is SHORT by 11 when both teams have the same 11 players (contention only)', () => {
    const same = ids('p', 11)
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', same],
      ['m2', 'AVAILABLE', same],
    ])

    expect(slot.status).toBe('SHORT')
    expect(slot.distinctAvailable).toBe(11)
    expect(slot.shortBy).toBe(11)
    expect(slot.teams.every((team) => team.needed !== null && team.available >= team.needed)).toBe(true)
    expect(hint(slot)).toBe(
      'Villagers 1 and Villagers 2 need more distinct players than are available: ' +
        'the 11 shared players cannot fill both XIs. Chase 11 more players.',
    )
  })

  it('finds the assignment that greedy fails: A for both teams, B for team 1 only, one place each', () => {
    const games = [game('m1', 't1', { leagueId: 'L1' }), game('m2', 't2', { leagueId: 'L1' })]
    const answers: Answers = [
      ['m1', 'AVAILABLE', ['a', 'b']],
      ['m2', 'AVAILABLE', ['a']],
    ]
    const slot = only(games, answers)

    // 'a' sorts first and a greedy pass hands it to team 1, which then blocks 'b'; augmenting moves it.
    expect(slot.status).toBe('TIGHT')
    expect(slot.split).toEqual([{ teamId: 't2', shortfall: 1 }])
    const { matched, assignment } = maxMatching([
      { teamId: 't1', needed: 1, availableIds: new Set(['a', 'b']) },
      { teamId: 't2', needed: 1, availableIds: new Set(['a']) },
    ])
    expect(matched).toBe(2)
    expect(assignment.get('a')).toBe('t2')
    expect(assignment.get('b')).toBe('t1')
  })

  it('needs two displacements: greedy in id order fails, augmenting fills every place', () => {
    // Greedy in sorted order: a -> t1, b -> t2, then c (t1 only) is blocked, so greedy matches 2 of 3.
    // Augmenting moves a to t2 and b to t3 to make room for c.
    const { matched, assignment } = maxMatching([
      { teamId: 't1', needed: 1, availableIds: new Set(['a', 'c']) },
      { teamId: 't2', needed: 1, availableIds: new Set(['a', 'b']) },
      { teamId: 't3', needed: 1, availableIds: new Set(['b']) },
    ])
    expect(matched).toBe(3)
    expect(assignment.get('c')).toBe('t1')
    expect(assignment.get('a')).toBe('t2')
    expect(assignment.get('b')).toBe('t3')
  })

  it('never assigns anyone to a team with needed 0', () => {
    const { matched } = maxMatching([
      { teamId: 't1', needed: 0, availableIds: new Set(['a', 'b']) },
      { teamId: 't2', needed: 1, availableIds: new Set(['a']) },
    ])
    expect(matched).toBe(1)
  })

  it('handles a team with needed 0 in a slot: it needs nobody, but its players still count as shared', () => {
    const xi = new Map([...XI, ['L0', 0]])
    const games = [game('m1', 't1', { leagueId: 'L0' }), G2]
    const covered = only(games, [
      ['m1', 'AVAILABLE', ids('a', 3)],
      ['m2', 'AVAILABLE', ids('b', 11)],
    ], xi)
    expect(covered.status).toBe('COVERED')
    expect(covered.placesNeeded).toBe(11)
    expect(teamOf(covered, 't1').needed).toBe(0)

    const tight = only(games, [
      ['m1', 'AVAILABLE', ['s01']],
      ['m2', 'AVAILABLE', [...ids('b', 10), 's01']],
    ], xi)
    expect(tight.status).toBe('TIGHT')
    expect(tight.split).toEqual([{ teamId: 't2', shortfall: 1 }])
  })

  it('is deterministic whatever order the players arrive in', () => {
    const games = [G1, G2]
    const answers: Answers = [
      ['m1', 'AVAILABLE', [...ids('a', 9), ...ids('s', 6)]],
      ['m2', 'AVAILABLE', [...ids('b', 8), ...ids('s', 6)]],
    ]
    const rows = roster(games, answers)
    const forward = computeSlotCoverage({ games, players: rows, xiSizeByLeagueId: XI })
    const backward = computeSlotCoverage({ games, players: [...rows].reverse(), xiSizeByLeagueId: XI })
    expect(backward).toEqual(forward)
  })
})

describe('de-duplication and group polls', () => {
  it('counts a group-poll answer once per team and once in the distinct set', () => {
    const games = [
      game('m1', 't1', { pollType: 'GROUP' }),
      game('m2', 't1', { pollType: 'GROUP', matchDate: at(10, 3, 14) }),
      game('m3', 't2', { pollType: 'GROUP' }),
    ]
    const same = ids('p', 3)
    const slot = only(games, [
      ['m1', 'AVAILABLE', same],
      ['m2', 'AVAILABLE', same],
      ['m3', 'AVAILABLE', same],
    ])

    expect(slot.teams).toHaveLength(2)
    expect(teamOf(slot, 't1').available).toBe(3)
    expect(teamOf(slot, 't2').available).toBe(3)
    expect(slot.distinctAvailable).toBe(3)
    expect(slot.sharedIds).toEqual(same)
  })

  it('treats a team with two games in one slot as one team', () => {
    const games = [game('m1', 't1'), game('m2', 't1', { matchDate: at(10, 3, 14) })]
    const slot = only(games, [
      ['m1', 'AVAILABLE', ids('a', 8)],
      ['m2', 'AVAILABLE', [...ids('a', 5), ...ids('b', 4)]],
    ])

    expect(slot.teams).toHaveLength(1)
    expect(teamOf(slot, 't1').available).toBe(12)
    expect(slot.status).toBe('COVERED')
    expect(slot.games).toHaveLength(2)
  })

  it('uses the larger XI size when a team has two games with different sizes', () => {
    const games = [game('m1', 't1', { leagueId: 'L9' }), game('m2', 't1', { leagueId: 'L11' })]
    const slot = only(games, [['m1', 'AVAILABLE', ids('a', 10)]])
    expect(teamOf(slot, 't1').needed).toBe(11)
    expect(slot.status).toBe('SHORT')
    expect(slot.shortBy).toBe(1)
  })

  it('never calls a group-poll slot COVERED: everyone is available for both teams', () => {
    const games = [game('m1', 't1', { pollType: 'GROUP' }), game('m2', 't2', { pollType: 'GROUP' })]
    const split = only(games, [
      ['m1', 'AVAILABLE', ids('p', 22)],
      ['m2', 'AVAILABLE', ids('p', 22)],
    ])
    expect(split.status).toBe('TIGHT')
    expect(split.split).toEqual([
      { teamId: 't1', shortfall: 11 },
      { teamId: 't2', shortfall: 11 },
    ])
    expect(split.spare).toBe(0)

    const plenty = only(games, [
      ['m1', 'AVAILABLE', ids('p', 40)],
      ['m2', 'AVAILABLE', ids('p', 40)],
    ])
    expect(plenty.status).toBe('TIGHT')
    expect(plenty.spare).toBe(18)
  })
})

describe('single team, no league, no poll', () => {
  it('single team: covered at or over the XI, short by the difference under it, no shared players', () => {
    const covered = only([G1], [['m1', 'AVAILABLE', ids('a', 11)]])
    expect(covered.status).toBe('COVERED')
    expect(covered.sharedIds).toEqual([])
    expect(teamOf(covered, 't1').shared).toBe(0)
    expect(covered.spare).toBe(0)

    const over = only([G1], [['m1', 'AVAILABLE', ids('a', 14)]])
    expect(over.status).toBe('COVERED')
    expect(over.spare).toBe(3)

    const short = only([G1], [['m1', 'AVAILABLE', ids('a', 9)]])
    expect(short.status).toBe('SHORT')
    expect(short.shortBy).toBe(2)
    expect(hint(short)).toBe('Villagers 1 has 9 available and needs 11. Chase 2 more players.')
  })

  it('single team short by one says "player"', () => {
    const short = only([G1], [['m1', 'AVAILABLE', ids('a', 10)]])
    expect(hint(short)).toBe('Villagers 1 has 10 available and needs 11. Chase 1 more player.')
  })

  it('NO_XI_SIZE when a game has no league or the league is unknown, with distinct counts only', () => {
    for (const leagueId of [null, 'missing-league']) {
      const slot = only([game('m1', 't1', { leagueId })], [['m1', 'AVAILABLE', ids('a', 12)]])
      expect(slot.status).toBe('NO_XI_SIZE')
      expect(slot.distinctAvailable).toBe(12)
      expect(teamOf(slot, 't1')).toMatchObject({ needed: null, available: 12 })
      expect(hint(slot)).toBeNull()
    }
  })

  it('NO_XI_SIZE when only one of two teams has no league', () => {
    const slot = only([G1, game('m2', 't2', { leagueId: null })], [
      ['m1', 'AVAILABLE', ids('a', 11)],
      ['m2', 'AVAILABLE', ids('b', 11)],
    ])
    expect(slot.status).toBe('NO_XI_SIZE')
  })

  it('NO_POLL when a team has no poll, and it wins over NO_XI_SIZE', () => {
    const noPoll = game('m2', 't2', { pollType: null, pollId: null })
    const slot = only([G1, noPoll], [['m1', 'AVAILABLE', ids('a', 11)]])
    expect(slot.status).toBe('NO_POLL')
    expect(teamOf(slot, 't2').hasPoll).toBe(false)
    expect(teamOf(slot, 't2').needed).toBe(11)
    expect(teamOf(slot, 't1').hasPoll).toBe(true)

    const both = only([game('m1', 't1', { leagueId: null }), noPoll], [['m1', 'AVAILABLE', ids('a', 11)]])
    expect(both.status).toBe('NO_POLL')
  })

  it('a single team with no poll is NO_POLL', () => {
    const slot = only([game('m1', 't1', { pollType: null, pollId: null })], [])
    expect(slot.status).toBe('NO_POLL')
    expect(slot.distinctAvailable).toBe(0)
  })
})

describe('what counts', () => {
  it('never counts unsure as available, in a count, the distinct set or the matching', () => {
    const slot = only([G1], [
      ['m1', 'AVAILABLE', ids('a', 10)],
      ['m1', 'UNSURE', ids('u', 4)],
    ])

    expect(slot.distinctAvailable).toBe(10)
    expect(teamOf(slot, 't1').available).toBe(10)
    expect(teamOf(slot, 't1').unsure).toBe(4)
    expect(slot.distinctUnsure).toBe(4)
    // Four unsure answers could close a gap of one, but never turn SHORT into COVERED.
    expect(slot.status).toBe('SHORT')
    expect(slot.shortBy).toBe(1)
  })

  it('does not count someone available for any team as unsure for the slot', () => {
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', ['x']],
      ['m2', 'UNSURE', ['x', 'y']],
    ])
    expect(slot.distinctUnsure).toBe(1)
    expect(teamOf(slot, 't2').unsure).toBe(2)
  })

  it('does not count UNAVAILABLE, NO_RESPONSE or NOT_IN_POLL for anything', () => {
    const slot = only([G1], [
      ['m1', 'AVAILABLE', ['a']],
      ['m1', 'UNAVAILABLE', ['b']],
      ['m1', 'NO_RESPONSE', ['c']],
      ['m1', 'NOT_IN_POLL', ['d']],
    ])
    expect(slot.distinctAvailable).toBe(1)
    expect(slot.distinctUnsure).toBe(0)
    expect(teamOf(slot, 't1')).toMatchObject({ available: 1, unsure: 0 })
  })
})

describe('different XI sizes and several teams', () => {
  it('handles a team needing 11 and one needing 9', () => {
    const games = [G1, game('m2', 't2', { leagueId: 'L9' })]
    const covered = only(games, [
      ['m1', 'AVAILABLE', ids('a', 11)],
      ['m2', 'AVAILABLE', ids('b', 9)],
    ])
    expect(covered.status).toBe('COVERED')
    expect(covered.placesNeeded).toBe(20)
    expect(teamOf(covered, 't2').needed).toBe(9)

    const short = only(games, [
      ['m1', 'AVAILABLE', ids('a', 11)],
      ['m2', 'AVAILABLE', ids('a', 9)],
    ])
    expect(short.status).toBe('SHORT')
    expect(short.shortBy).toBe(9)
  })

  it('handles 11/11/9 across three teams with overlapping availability', () => {
    const games = [G1, G2, game('m3', 't3', { leagueId: 'L9' })]
    const short = only(games, [
      ['m1', 'AVAILABLE', ids('x', 11)],
      ['m2', 'AVAILABLE', ids('x', 11)],
      ['m3', 'AVAILABLE', ids('y', 9)],
    ])
    expect(short.placesNeeded).toBe(31)
    expect(short.status).toBe('SHORT')
    expect(short.shortBy).toBe(11)
    expect(hint(short)).toBe(
      'Villagers 1 and Villagers 2 need more distinct players than are available: ' +
        'the 11 shared players cannot fill both XIs. Chase 11 more players.',
    )
  })

  it('handles a shared player in all three teams', () => {
    const games = [G1, G2, game('m3', 't3', { leagueId: 'L9' })]
    const shared = ['s01', 's02', 's03']
    const slot = only(games, [
      ['m1', 'AVAILABLE', [...ids('a', 10), ...shared]],
      ['m2', 'AVAILABLE', [...ids('b', 10), ...shared]],
      ['m3', 'AVAILABLE', [...ids('c', 8), ...shared]],
    ])

    expect(slot.status).toBe('TIGHT')
    expect(slot.distinctAvailable).toBe(31)
    expect(slot.sharedIds).toEqual(shared)
    expect(slot.split).toEqual([
      { teamId: 't1', shortfall: 1 },
      { teamId: 't2', shortfall: 1 },
      { teamId: 't3', shortfall: 1 },
    ])
    expect(teamOf(slot, 't3')).toMatchObject({ available: 11, ownOnly: 8, shared: 3 })
    expect(hint(slot)).toBe('Works only if the 3 shared players are split: 1 to Villagers 1, 1 to Villagers 2, 1 to Villagers 3.')
  })
})

describe('slotting', () => {
  it('makes two slots of the same date with different day parts, Morning first', () => {
    const morning = game('m1', 't1', { matchDate: at(10, 3, 9), dayPart: 'MORNING' })
    const afternoon = game('m2', 't2')
    const slots = compute([afternoon, morning], [])
    expect(slots.map((slot) => slot.dayPart)).toEqual(['MORNING', 'AFTERNOON'])
    expect(slots.map((slot) => slot.key)).toEqual(['2026-10-03|MORNING', '2026-10-03|AFTERNOON'])
  })

  it('keeps one slot across two sections', () => {
    const slot = only([game('m1', 't1', { sectionId: 's-a' }), game('m2', 't2', { sectionId: 's-b' })], [])
    expect(slot.teams).toHaveLength(2)
  })

  it('sorts slots by date ascending, then Morning before Afternoon', () => {
    const sunday = game('m1', 't1', { matchDate: at(10, 4, 9), dayPart: 'MORNING' })
    const satPm = game('m2', 't1')
    const satAm = game('m3', 't1', { matchDate: at(10, 3, 9), dayPart: 'MORNING' })
    const slots = compute([sunday, satPm, satAm], [])
    expect(slots.map((slot) => slot.key)).toEqual(['2026-10-03|MORNING', '2026-10-03|AFTERNOON', '2026-10-04|MORNING'])
  })

  it('makes a slot of a single game', () => {
    const slots = compute([G1], [])
    expect(slots).toHaveLength(1)
    expect(slots[0].games.map((g) => g.matchId)).toEqual(['m1'])
  })

  it('sorts a slot\'s games by kickoff', () => {
    const late = game('m1', 't1', { matchDate: at(10, 3, 14) })
    const early = game('m2', 't2', { matchDate: at(10, 3, 12) })
    expect(only([late, early], []).games.map((g) => g.matchId)).toEqual(['m2', 'm1'])
  })

  it('ignores games with no club team', () => {
    expect(compute([game('m1', null)], [])).toEqual([])
    const slot = only([game('m1', null), G2], [])
    expect(slot.teams.map((team) => team.teamId)).toEqual(['t2'])
    expect(slot.games).toHaveLength(1)
  })

  it('returns nothing for empty input', () => {
    expect(computeSlotCoverage({ games: [], players: [], xiSizeByLeagueId: new Map() })).toEqual([])
  })
})

describe('slotHint wording with a single shared player', () => {
  it('reads singular in Tight', () => {
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 11), 's01']],
      ['m2', 'AVAILABLE', [...ids('b', 10), 's01']],
    ])
    expect(slot.status).toBe('TIGHT')
    expect(hint(slot)).toBe('Works only if 1 of the 1 shared player goes to Villagers 2.')
    expect(hint(slot, true)).toBe('Split the 1 shared player: 1 to Villagers 2.')
  })

  it('reads singular in Short', () => {
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 10), 's01']],
      ['m2', 'AVAILABLE', [...ids('b', 5), 's01']],
    ])
    expect(slot.status).toBe('SHORT')
    expect(hint(slot)).toBe(
      'Villagers 2 cannot reach 11 even with every shared player. ' +
        'The 1 shared player is contended between Villagers 1 and Villagers 2. Chase 6 more players.',
    )
  })
})

describe('slotHint wording', () => {
  const tight = () =>
    only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 9), ...ids('s', 6)]],
      ['m2', 'AVAILABLE', [...ids('b', 8), ...ids('s', 6)]],
    ])

  it('marks the split bold and the rest plain', () => {
    expect(slotHint(tight(), name)).toEqual([
      { text: 'Works only if the 6 shared players are split: ' },
      { text: '2 to Villagers 1, 3 to Villagers 2', bold: true },
      { text: ' (1 spare).' },
    ])
  })

  it('omits the spare part at zero spare', () => {
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 9), ...ids('s', 6)]],
      ['m2', 'AVAILABLE', [...ids('b', 7), ...ids('s', 6)]],
    ])
    expect(slot.spare).toBe(0)
    expect(hint(slot)).toBe('Works only if the 6 shared players are split: 2 to Villagers 1, 4 to Villagers 2.')
  })

  it('omits the spare part for the one-team form at zero spare', () => {
    const slot = only([G1, G2], [
      ['m1', 'AVAILABLE', [...ids('a', 11), ...ids('s', 2)]],
      ['m2', 'AVAILABLE', [...ids('b', 9), ...ids('s', 2)]],
    ])
    expect(slot.spare).toBe(0)
    expect(hint(slot)).toBe('Works only if 2 of the 2 shared players go to Villagers 2.')
  })

  it('has a compact Tight wording for a phone', () => {
    expect(hint(tight(), true)).toBe('Split the 6 shared players: 2 to Villagers 1, 3 to Villagers 2.')
  })

  it('has no hint for Covered or the unassessed statuses', () => {
    expect(hint(only([G1], [['m1', 'AVAILABLE', ids('a', 11)]]))).toBeNull()
    expect(hint(only([game('m1', 't1', { leagueId: null })], []))).toBeNull()
    expect(hint(only([game('m1', 't1', { pollType: null })], []))).toBeNull()
  })

  it('marks the team and the chase bold in a Short hint', () => {
    const slot = only([G1], [['m1', 'AVAILABLE', ids('a', 9)]])
    expect(slotHint(slot, name)).toEqual([
      { text: 'Villagers 1', bold: true },
      { text: ' has 9 available and needs 11. ' },
      { text: 'Chase 2 more players.', bold: true },
    ])
  })
})
