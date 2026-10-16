import { describe, expect, it } from 'vitest'
import { resultImportActionFor } from '../matches/matchResultHelpers'
import { resultImportTo } from './resultListHelpers'

describe('resultImportTo', () => {
  it('opens the import wizard, optionally for one match', () => {
    expect(resultImportTo()).toBe('/manage/results/import')
    expect(resultImportTo('match-1')).toBe('/manage/results/import?matchId=match-1')
    expect(resultImportTo('a b&c')).toBe('/manage/results/import?matchId=a%20b%26c')
  })
})

describe('resultImportActionFor', () => {
  const now = new Date('2026-10-15T12:00:00Z').getTime()
  const match = { id: 'm1', active: true, resultStatus: 'NONE' as const, matchDate: '2026-10-11T09:00:00Z' }

  it('offers Import for a match that has started and has no result or a draft', () => {
    expect(resultImportActionFor(match, now)).toEqual({ caption: 'Import', label: 'Import result', to: '/manage/results/import?matchId=m1' })
    expect(resultImportActionFor({ ...match, resultStatus: 'DRAFT' }, now)).not.toBeNull()
  })

  it('offers nothing once a result is published, for an inactive match, or before the match starts', () => {
    expect(resultImportActionFor({ ...match, resultStatus: 'PUBLISHED' }, now)).toBeNull()
    expect(resultImportActionFor({ ...match, active: false }, now)).toBeNull()
    expect(resultImportActionFor({ ...match, matchDate: '2026-10-20T09:00:00Z' }, now)).toBeNull()
  })
})
