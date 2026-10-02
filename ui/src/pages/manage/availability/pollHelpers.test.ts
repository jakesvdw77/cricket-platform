import { describe, expect, it } from 'vitest'
import type { SectionAvailabilityFixtureMatch } from '../../../api/sectionAvailabilityApi'
import {
  CLOSE_TIME_AFTER_KICKOFF_MESSAGE,
  CLOSE_TIME_PAST_MESSAGE,
  CLOSE_TIME_REQUIRED_MESSAGE,
  closesRowText,
  coveredPollHref,
  defaultCloseTime,
  validateCloseTime,
} from './pollHelpers'

function match(overrides: Partial<SectionAvailabilityFixtureMatch>): SectionAvailabilityFixtureMatch {
  return { matchId: 'match-1', existingPollType: null, ...overrides } as SectionAvailabilityFixtureMatch
}

describe('coveredPollHref', () => {
  it('links a squad covering poll to its match Availability tab', () => {
    expect(coveredPollHref(match({ existingPollType: 'SQUAD' }))).toBe(
      '/manage/fixtures/matches/match-1/edit?tab=availability',
    )
  })

  it('links a group covering poll to the dashboard with closed polls shown', () => {
    expect(coveredPollHref(match({ existingPollType: 'GROUP' }))).toBe('/manage/availability?showClosed=true')
  })
})

describe('defaultCloseTime', () => {
  const now = new Date('2026-10-01T09:00:00Z')

  it('is 24 hours before the kickoff', () => {
    expect(defaultCloseTime('2026-10-05T10:00:00Z', now).toISOString()).toBe('2026-10-04T10:00:00.000Z')
  })

  it('falls back to 1 hour before when 24 hours before is already past', () => {
    expect(defaultCloseTime('2026-10-01T20:00:00Z', now).toISOString()).toBe('2026-10-01T19:00:00.000Z')
  })
})

describe('validateCloseTime', () => {
  const now = new Date('2026-10-01T09:00:00Z')
  const kickoff = '2026-10-05T10:00:00Z'

  it('accepts anything when Autoclose is off', () => {
    expect(validateCloseTime(false, null, kickoff, now)).toBeNull()
  })

  it('requires a time when Autoclose is on', () => {
    expect(validateCloseTime(true, null, kickoff, now)).toBe(CLOSE_TIME_REQUIRED_MESSAGE)
    expect(validateCloseTime(true, 'garbage', kickoff, now)).toBe(CLOSE_TIME_REQUIRED_MESSAGE)
  })

  it('rejects a time that is not in the future', () => {
    expect(validateCloseTime(true, '2026-10-01T08:00:00Z', kickoff, now)).toBe(CLOSE_TIME_PAST_MESSAGE)
    expect(validateCloseTime(true, '2026-10-01T09:00:00Z', kickoff, now)).toBe(CLOSE_TIME_PAST_MESSAGE)
  })

  it('rejects a time after the first kickoff but allows exactly the kickoff', () => {
    expect(validateCloseTime(true, '2026-10-05T10:00:01Z', kickoff, now)).toBe(CLOSE_TIME_AFTER_KICKOFF_MESSAGE)
    expect(validateCloseTime(true, '2026-10-05T10:00:00Z', kickoff, now)).toBeNull()
  })

  it('uses the exact server messages', () => {
    expect(CLOSE_TIME_REQUIRED_MESSAGE).toBe('A closing time is required when Autoclose is on.')
    expect(CLOSE_TIME_PAST_MESSAGE).toBe('Choose a closing time in the future.')
    expect(CLOSE_TIME_AFTER_KICKOFF_MESSAGE).toBe('Choose a closing time before the first match starts.')
  })
})

describe('closesRowText', () => {
  it('reads Closes manually for an open poll without autoclose', () => {
    expect(closesRowText(true, false, null)).toBe('Closes manually')
  })

  it('reads Closes <date time> for an open autoclosing poll', () => {
    expect(closesRowText(true, true, '2026-10-04T10:00:00Z')).toMatch(/^Closes .+/)
    expect(closesRowText(true, true, '2026-10-04T10:00:00Z')).not.toContain('manually')
  })

  it('reads Closed <date> for a closed autoclosing poll and Closed manually otherwise', () => {
    expect(closesRowText(false, true, '2026-10-04T10:00:00Z')).toMatch(/^Closed .+/)
    expect(closesRowText(false, false, null)).toBe('Closed manually')
  })
})
