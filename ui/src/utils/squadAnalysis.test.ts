import { describe, expect, it } from 'vitest'
import { analyseSquad, bowlerKind } from './squadAnalysis'
import type { AnalysisPlayer } from './squadAnalysis'

// docs/specs/151, slice B: the shape of a squad, worked out from the players.
let counter = 0
function player(overrides: Partial<AnalysisPlayer> = {}): AnalysisPlayer {
  counter += 1
  return {
    id: `p${counter}`,
    firstName: `First${counter}`,
    lastName: `Last${counter}`,
    dateOfBirth: '1985-06-15',
    battingStance: 'RIGHT_HANDED',
    bowlingArm: null,
    bowlingType: null,
    isWicketKeeper: false,
    battingPosition: null,
    isPartTimeBowler: false,
    ...overrides,
  }
}

const TODAY = new Date('2026-11-14T12:00:00')

describe('bowlerKind', () => {
  it('is a main bowler with a type, part-time when ticked, and none otherwise', () => {
    expect(bowlerKind({ bowlingType: 'FAST', isPartTimeBowler: false })).toBe('MAIN')
    expect(bowlerKind({ bowlingType: 'FAST', isPartTimeBowler: true })).toBe('PART_TIME')
    expect(bowlerKind({ bowlingType: null, isPartTimeBowler: true })).toBe('PART_TIME')
    expect(bowlerKind({ bowlingType: null, isPartTimeBowler: false })).toBe('NONE')
    expect(bowlerKind({ bowlingType: null })).toBe('NONE')
  })
})

describe('analyseSquad', () => {
  it('counts an empty squad as nothing and raises no gaps', () => {
    const result = analyseSquad([], TODAY)
    expect(result.size).toBe(0)
    expect(result.gaps).toEqual([])
    expect(result.missing).toEqual([])
    expect(result.experience.averageAge).toBeNull()
  })

  it('counts batters, main bowlers, part-timers, all-rounders and keepers', () => {
    const players = [
      player({ firstName: 'Opener', lastName: 'Pace', bowlingType: 'FAST', battingPosition: 'OPENER' }),
      player({ firstName: 'Tail', lastName: 'Spin', bowlingType: 'OFF_BREAK', battingPosition: 'LOWER_ORDER' }),
      player({ firstName: 'Part', lastName: 'Timer', bowlingType: 'MEDIUM', isPartTimeBowler: true, battingPosition: 'MIDDLE_ORDER' }),
      player({ firstName: 'Glove', lastName: 'Man', isWicketKeeper: true, battingPosition: 'TOP_ORDER' }),
    ]

    const result = analyseSquad(players, TODAY)

    expect(result.size).toBe(4)
    expect(result.mainBowlers).toEqual(['Opener Pace', 'Tail Spin'])
    expect(result.partTimeBowlers).toEqual(['Part Timer'])
    // a batter is anyone who is not a main bowler
    expect(result.batters).toEqual(['Glove Man', 'Part Timer'])
    // an all-rounder is a main bowler who bats opener, top or middle order, not lower order
    expect(result.allRounders).toEqual(['Opener Pace'])
    expect(result.keepers).toEqual(['Glove Man'])
  })

  it('groups the batting order and lists the players with no position as not set', () => {
    const players = [
      player({ firstName: 'A', lastName: 'One', battingPosition: 'OPENER' }),
      player({ firstName: 'B', lastName: 'Two', battingPosition: 'OPENER' }),
      player({ firstName: 'C', lastName: 'Three', battingPosition: 'MIDDLE_ORDER' }),
      player({ firstName: 'D', lastName: 'Four', battingPosition: null }),
    ]

    const result = analyseSquad(players, TODAY)

    expect(result.battingOrder.OPENER).toEqual(['A One', 'B Two'])
    expect(result.battingOrder.TOP_ORDER).toEqual([])
    expect(result.battingOrder.MIDDLE_ORDER).toEqual(['C Three'])
    expect(result.battingNotSet).toEqual(['D Four'])
  })

  it('splits bowlers into pace, medium, spin and part-time', () => {
    const players = [
      player({ firstName: 'F', lastName: 'Fast', bowlingType: 'FAST' }),
      player({ firstName: 'M', lastName: 'MediumFast', bowlingType: 'MEDIUM_FAST' }),
      player({ firstName: 'Me', lastName: 'Medium', bowlingType: 'MEDIUM' }),
      player({ firstName: 'L', lastName: 'Leg', bowlingType: 'LEG_BREAK' }),
      player({ firstName: 'G', lastName: 'Googly', bowlingType: 'GOOGLY' }),
      player({ firstName: 'P', lastName: 'Part', bowlingType: 'FAST', isPartTimeBowler: true }),
    ]

    const { bowling } = analyseSquad(players, TODAY)

    expect(bowling.pace).toEqual(['F Fast', 'M MediumFast'])
    expect(bowling.medium).toEqual(['Me Medium'])
    expect(bowling.spin).toEqual(['G Googly', 'L Leg'])
    expect(bowling.partTime).toEqual(['P Part'])
  })

  it('counts hands for batters and for bowlers, including part-timers', () => {
    const players = [
      player({ battingStance: 'RIGHT_HANDED', bowlingType: 'FAST', bowlingArm: 'RIGHT_ARM' }),
      player({ battingStance: 'LEFT_HANDED', bowlingType: 'OFF_BREAK', bowlingArm: 'LEFT_ARM' }),
      player({ battingStance: null, bowlingType: 'MEDIUM', isPartTimeBowler: true, bowlingArm: null }),
      player({ battingStance: 'RIGHT_HANDED' }),
    ]

    const { hands } = analyseSquad(players, TODAY)

    expect(hands).toEqual({ rightBat: 2, leftBat: 1, batNotSet: 1, rightArm: 1, leftArm: 1, armNotSet: 1 })
  })

  it('works out ages on the day, before and after the birthday', () => {
    const players = [
      player({ dateOfBirth: '2000-11-14' }), // 26 today
      player({ dateOfBirth: '2000-11-15' }), // 25, birthday tomorrow
      player({ dateOfBirth: null }),
    ]

    const { experience } = analyseSquad(players, TODAY)

    expect(experience.youngest).toBe(25)
    expect(experience.oldest).toBe(26)
    expect(experience.averageAge).toBe(26)
    expect(experience.known).toBe(2)
  })

  it('lists players with a missing batting position, stance or date of birth', () => {
    const players = [
      player({ firstName: 'Full', lastName: 'Info', battingPosition: 'OPENER' }),
      player({ firstName: 'No', lastName: 'Stance', battingPosition: 'OPENER', battingStance: null }),
      player({ firstName: 'No', lastName: 'Date', battingPosition: 'OPENER', dateOfBirth: null }),
      player({ firstName: 'Nothing', lastName: 'Set', battingStance: null, dateOfBirth: null }),
    ]

    const { missing } = analyseSquad(players, TODAY)

    expect(missing).toEqual([
      { name: 'No Date', missing: ['date of birth'] },
      { name: 'No Stance', missing: ['batting stance'] },
      { name: 'Nothing Set', missing: ['batting position', 'batting stance', 'date of birth'] },
    ])
  })

  describe('gaps', () => {
    const ids = (players: AnalysisPlayer[], tone: 'warning' | 'ok') =>
      analyseSquad(players, TODAY).gaps.filter((gap) => gap.tone === tone).map((gap) => gap.id)

    const sideOfEleven = (extra: Partial<AnalysisPlayer>[] = []) =>
      Array.from({ length: 11 }, (_, index) => player(extra[index] ?? {}))

    it('warns of no wicketkeeper, and of only one', () => {
      expect(ids(sideOfEleven(), 'warning')).toContain('keeper')
      expect(analyseSquad(sideOfEleven(), TODAY).gaps.find((gap) => gap.id === 'keeper')?.text).toBe('No wicketkeeper.')
      const one = analyseSquad(sideOfEleven([{ isWicketKeeper: true }]), TODAY).gaps.find((gap) => gap.id === 'keeper')
      expect(one?.text).toMatch(/^Only 1 wicketkeeper/)
      expect(ids(sideOfEleven([{ isWicketKeeper: true }, { isWicketKeeper: true }]), 'warning')).not.toContain('keeper')
    })

    it('warns of no opener or one opener, and ticks two', () => {
      expect(analyseSquad(sideOfEleven(), TODAY).gaps.find((gap) => gap.id === 'openers')?.text).toBe('No opener set.')
      expect(analyseSquad(sideOfEleven([{ battingPosition: 'OPENER' }]), TODAY).gaps.find((gap) => gap.id === 'openers')?.text).toBe('Only 1 opener set.')
      expect(ids(sideOfEleven([{ battingPosition: 'OPENER' }, { battingPosition: 'OPENER' }]), 'ok')).toContain('openers')
    })

    it('warns under five bowling options and ticks five or more, counting part-timers', () => {
      const four = sideOfEleven([{ bowlingType: 'FAST' }, { bowlingType: 'MEDIUM' }, { bowlingType: 'OFF_BREAK' }, { bowlingType: 'FAST', isPartTimeBowler: true }])
      expect(analyseSquad(four, TODAY).gaps.find((gap) => gap.id === 'bowling')?.text).toMatch(/^Only 4 bowling options/)
      const five = sideOfEleven([{ bowlingType: 'FAST' }, { bowlingType: 'MEDIUM' }, { bowlingType: 'OFF_BREAK' }, { bowlingType: 'FAST', isPartTimeBowler: true }, { bowlingType: 'LEG_BREAK' }])
      expect(ids(five, 'ok')).toContain('bowling')
      expect(analyseSquad(four.slice(0, 1), TODAY).gaps.find((gap) => gap.id === 'bowling')?.text).toMatch(/^Only 1 bowling option \(/)
    })

    it('warns of no spin bowler, no left-hand batter and a small squad', () => {
      const found = ids([player()], 'warning')
      expect(found).toEqual(expect.arrayContaining(['spin', 'left-hand', 'size']))
      const big = sideOfEleven([{ bowlingType: 'OFF_BREAK' }, { battingStance: 'LEFT_HANDED' }])
      expect(ids(big, 'warning')).not.toEqual(expect.arrayContaining(['spin']))
      expect(ids(big, 'warning')).not.toContain('left-hand')
      expect(ids(big, 'warning')).not.toContain('size')
    })

    it('names the players with no batting position in one warning', () => {
      const gap = analyseSquad([player({ firstName: 'Sam', lastName: 'Smith' })], TODAY).gaps.find((entry) => entry.id === 'batting-position')
      expect(gap?.text).toBe('1 player has no batting position set (Sam Smith).')
    })
  })

  it('names players through nameOf but sorts on the full name', () => {
    const players = [player({ firstName: 'Zed', lastName: 'Adams' }), player({ firstName: 'Amy', lastName: 'Brown' })]

    const result = analyseSquad(players, TODAY, (entry) => `${entry.firstName[0]}. ${entry.lastName}`)

    expect(result.battingNotSet).toEqual(['A. Brown', 'Z. Adams'])
    expect(result.missing.map((entry) => entry.name)).toEqual(['A. Brown', 'Z. Adams'])
  })
})
