import { describe, expect, it } from 'vitest'
import type { DismissalType } from '../api/matchResultApi'
import {
  bestDismissal,
  DISMISSALS,
  hasBatted,
  isBowlerCredited,
  isNonBowlerWicket,
  isWicket,
  matchDismissals,
  dismissalText,
} from './dismissal'

describe('dismissal (mirrors the backend DismissalType)', () => {
  it('flags wickets and bowler credit like the backend enum', () => {
    const wickets: DismissalType[] = [
      'BOWLED', 'CAUGHT', 'CAUGHT_AND_BOWLED', 'LBW', 'STUMPED', 'RUN_OUT', 'HIT_WICKET', 'HANDLED_BALL',
      'OBSTRUCTING_FIELD', 'HIT_BALL_TWICE', 'TIMED_OUT', 'RETIRED_OUT',
    ]
    expect(DISMISSALS.filter((d) => d.wicket).map((d) => d.type).sort()).toEqual([...wickets].sort())
    expect(DISMISSALS.filter((d) => d.bowlerCredited).map((d) => d.type).sort()).toEqual(
      ['BOWLED', 'CAUGHT', 'CAUGHT_AND_BOWLED', 'HIT_WICKET', 'LBW', 'STUMPED'],
    )
    expect(DISMISSALS).toHaveLength(15)
  })

  it('counts retired out as a non-bowler wicket and retired not out as no wicket', () => {
    expect(isWicket('RETIRED_OUT')).toBe(true)
    expect(isNonBowlerWicket('RETIRED_OUT')).toBe(true)
    expect(isBowlerCredited('RETIRED_OUT')).toBe(false)
    expect(isWicket('RETIRED_NOT_OUT')).toBe(false)
    expect(isNonBowlerWicket('RETIRED_NOT_OUT')).toBe(false)
    expect(isWicket('NOT_OUT')).toBe(false)
    expect(isWicket(null)).toBe(false)
  })

  it('treats everything but Did not bat as batted', () => {
    expect(hasBatted('DID_NOT_BAT')).toBe(false)
    expect(hasBatted('NOT_OUT')).toBe(true)
    expect(hasBatted(null)).toBe(true)
  })

  it('type-ahead: the spec shortcuts pick the right dismissal', () => {
    const expected: Record<string, DismissalType> = {
      c: 'CAUGHT', b: 'BOWLED', l: 'LBW', r: 'RUN_OUT', s: 'STUMPED', n: 'NOT_OUT', d: 'DID_NOT_BAT',
      cb: 'CAUGHT_AND_BOWLED', ro: 'RETIRED_OUT', rn: 'RETIRED_NOT_OUT',
    }
    for (const [typed, type] of Object.entries(expected)) {
      expect(bestDismissal(typed)).toBe(type)
    }
    expect(bestDismissal('C')).toBe('CAUGHT')
    expect(bestDismissal('zz')).toBeNull()
  })

  it('lists the exact shortcut first and the longer ones after it', () => {
    expect(matchDismissals('c').map((d) => d.type)).toEqual(['CAUGHT', 'CAUGHT_AND_BOWLED'])
    expect(matchDismissals('r').map((d) => d.type).slice(0, 3)).toEqual(['RUN_OUT', 'RETIRED_NOT_OUT', 'RETIRED_OUT'])
    expect(matchDismissals('')).toHaveLength(15)
  })

  it('also matches by the start of the label', () => {
    expect(matchDismissals('stu').map((d) => d.type)).toEqual(['STUMPED'])
  })
})

describe('dismissalText', () => {
  it('writes each type as a scorecard line', () => {
    expect(dismissalText('CAUGHT', 'Jones', 'Smith')).toBe('c Smith b Jones')
    expect(dismissalText('CAUGHT_AND_BOWLED', 'Jones', null)).toBe('c & b Jones')
    expect(dismissalText('STUMPED', 'Jones', 'Smith')).toBe('st Smith b Jones')
    expect(dismissalText('BOWLED', 'Jones')).toBe('b Jones')
    expect(dismissalText('LBW', 'Jones')).toBe('lbw b Jones')
    expect(dismissalText('RUN_OUT', null, 'Smith')).toBe('run out (Smith)')
    expect(dismissalText('HIT_WICKET', 'Jones')).toBe('hit wicket b Jones')
    expect(dismissalText('NOT_OUT')).toBe('not out')
    expect(dismissalText('DID_NOT_BAT')).toBe('did not bat')
  })

  it('falls back to the plain word with the names that are known', () => {
    expect(dismissalText('CAUGHT', 'Jones', null)).toBe('caught b Jones')
    expect(dismissalText('CAUGHT', null, null)).toBe('caught')
    expect(dismissalText('CAUGHT_AND_BOWLED')).toBe('caught and bowled')
    expect(dismissalText('STUMPED', null, null)).toBe('stumped')
    expect(dismissalText('BOWLED', null)).toBe('bowled')
    expect(dismissalText('LBW')).toBe('lbw')
    expect(dismissalText('RUN_OUT')).toBe('run out')
  })

  it('is empty for an undecided row and uses the lower-cased label for the rarer types', () => {
    expect(dismissalText(null)).toBe('')
    expect(dismissalText(undefined)).toBe('')
    expect(dismissalText('RETIRED_NOT_OUT')).toBe(dismissalText('RETIRED_NOT_OUT').toLowerCase())
    expect(dismissalText('TIMED_OUT')).toMatch(/timed out/)
  })
})
