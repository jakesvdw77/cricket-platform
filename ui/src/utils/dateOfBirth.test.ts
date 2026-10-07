import { describe, expect, it } from 'vitest'
import { parseDateOfBirth } from './dateOfBirth'

const today = new Date(2026, 9, 7)

describe('parseDateOfBirth', () => {
  it('converts to padded ISO', () => {
    expect(parseDateOfBirth('4', '3', '1985', today)).toEqual({ iso: '1985-03-04' })
    expect(parseDateOfBirth(' 14 ', '03', '1985', today)).toEqual({ iso: '1985-03-14' })
  })

  it('requires all three parts', () => {
    expect(parseDateOfBirth('', '3', '1985', today).error).toMatch(/Enter the day/)
    expect(parseDateOfBirth('1', '', '1985', today).error).toMatch(/Enter the day/)
    expect(parseDateOfBirth('1', '3', '', today).error).toMatch(/Enter the day/)
  })

  it('rejects non numbers and a short year', () => {
    expect(parseDateOfBirth('ab', '3', '1985', today).error).toMatch(/numbers only/)
    expect(parseDateOfBirth('1', '3', '85', today).error).toMatch(/numbers only/)
  })

  it('rejects a month out of range, a missing day and an old year', () => {
    expect(parseDateOfBirth('1', '13', '1985', today).error).toMatch(/month/)
    expect(parseDateOfBirth('31', '4', '1985', today).error).toMatch(/does not exist/)
    expect(parseDateOfBirth('0', '4', '1985', today).error).toMatch(/does not exist/)
    expect(parseDateOfBirth('1', '4', '1850', today).error).toMatch(/year/)
  })

  it('handles leap days', () => {
    expect(parseDateOfBirth('29', '2', '2000', today)).toEqual({ iso: '2000-02-29' })
    expect(parseDateOfBirth('29', '2', '2001', today).error).toMatch(/does not exist/)
  })

  it('rejects the future but accepts today', () => {
    expect(parseDateOfBirth('8', '10', '2026', today).error).toMatch(/future/)
    expect(parseDateOfBirth('7', '10', '2026', today)).toEqual({ iso: '2026-10-07' })
  })
})
