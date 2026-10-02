import { describe, expect, it } from 'vitest'
import type { SectionAvailabilityFixtureMatch } from '../../../api/sectionAvailabilityApi'
import { canReopen, coveredPollHref } from './pollHelpers'

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

describe('canReopen (re-exported from utils/pollClose)', () => {
  it('follows the Autoclose rule', () => {
    const now = new Date('2026-06-01T12:00:00Z')
    expect(canReopen({ autoClose: true, scheduledCloseAt: '2026-05-31T12:00:00Z' }, now)).toBe(false)
    expect(canReopen({ autoClose: false, scheduledCloseAt: '2026-05-31T12:00:00Z' }, now)).toBe(true)
  })
})
