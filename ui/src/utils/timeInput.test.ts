import { describe, expect, it } from 'vitest'
import { STEP_MINUTES, stepTime } from './timeInput'

describe('stepTime', () => {
  it('steps in STEP_MINUTES (15)', () => {
    expect(STEP_MINUTES).toBe(15)
  })
  it('moves to the next or previous quarter hour', () => {
    expect(stepTime('13:10', 1)).toBe('13:15')
    expect(stepTime('13:15', 1)).toBe('13:30')
    expect(stepTime('13:45', 1)).toBe('14:00')
    expect(stepTime('13:10', -1)).toBe('13:00')
    expect(stepTime('13:00', -1)).toBe('12:45')
  })
  it('wraps within the day and starts at 09:00 when empty', () => {
    expect(stepTime('23:50', 1)).toBe('00:00')
    expect(stepTime('00:00', -1)).toBe('23:45')
    expect(stepTime('', 1)).toBe('09:00')
    expect(stepTime('1', -1)).toBe('09:00')
  })
})
