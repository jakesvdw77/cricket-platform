import { describe, expect, it } from 'vitest'
import { teamNameKey } from './teamNameKey'

describe('teamNameKey', () => {
  it('reads the age group written differently as the same words', () => {
    const key = teamNameKey('Northgate U15')
    expect(teamNameKey('NORTHGATE UNDER 15')).toBe(key)
    expect(teamNameKey('Northgate Under-15')).toBe(key)
    expect(teamNameKey('Northgate U/15')).toBe(key)
    expect(teamNameKey('northgate  under15')).toBe(key)
  })

  it('ignores case, accents, spacing and the dots inside a name', () => {
    expect(teamNameKey('C.B.C. Old Boys')).toBe(teamNameKey('cbc  old boys'))
    expect(teamNameKey('Morné Strollers')).toBe(teamNameKey('MORNE STROLLERS'))
  })

  it('keeps numbers and age groups apart', () => {
    expect(teamNameKey('Northgate 1')).not.toBe(teamNameKey('Northgate 2'))
    expect(teamNameKey('Northgate 1')).not.toBe(teamNameKey('Northgate'))
    expect(teamNameKey('Northgate U15')).not.toBe(teamNameKey('Northgate U13'))
  })

  it('is empty for nothing', () => {
    expect(teamNameKey(null)).toBe('')
    expect(teamNameKey('  ')).toBe('')
  })
})
