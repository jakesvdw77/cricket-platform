import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import { matchOutsideLeagueDatesMessage } from './errorDetail'

describe('matchOutsideLeagueDatesMessage (docs/specs/111)', () => {
  const failure = (status: number, data: unknown) =>
    new AxiosError('failed', String(status), undefined, undefined, { status, data } as never)

  it('returns the message of a MATCH_OUTSIDE_LEAGUE_DATES refusal', () => {
    expect(
      matchOutsideLeagueDatesMessage(failure(400, { code: 'MATCH_OUTSIDE_LEAGUE_DATES', detail: 'This league runs from 1 Sep 2026 to 31 Jul 2027.' })),
    ).toBe('This league runs from 1 Sep 2026 to 31 Jul 2027.')
  })

  it('returns null for other failures', () => {
    expect(matchOutsideLeagueDatesMessage(failure(400, { detail: 'Nope' }))).toBeNull()
    expect(matchOutsideLeagueDatesMessage(failure(409, { code: 'MATCH_OUTSIDE_LEAGUE_DATES', detail: 'x' }))).toBeNull()
    expect(matchOutsideLeagueDatesMessage(new Error('x'))).toBeNull()
    expect(matchOutsideLeagueDatesMessage(null)).toBeNull()
  })
})
