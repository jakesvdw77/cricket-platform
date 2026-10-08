import { describe, expect, it } from 'vitest'
import { groupPollResponsesPath, squadPollResponsesPath } from './pollRoutes'

describe('pollRoutes', () => {
  it('builds the group and squad Responses paths', () => {
    expect(groupPollResponsesPath('r1')).toBe('/manage/availability/group/r1')
    expect(squadPollResponsesPath('m1', 'p1')).toBe('/manage/availability/squad/m1/p1')
  })
})
