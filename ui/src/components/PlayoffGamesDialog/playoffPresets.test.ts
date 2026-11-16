import { describe, expect, it } from 'vitest'
import { emptyRow, ordinal, pairingRows, semiFinalRows } from './playoffPresets'

describe('playoffPresets (spec 155)', () => {
  it('writes ordinals, including the teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th'])
  })

  it('starts an empty row with two empty TBC sides, no date and no field', () => {
    const row = emptyRow('Final')
    expect(row).toMatchObject({ stage: 'Final', label: '', home: { kind: 'tbc', text: '' }, away: { kind: 'tbc', text: '' }, matchDate: '', field: null })
    expect(emptyRow().key).not.toBe(row.key)
  })

  it('makes one game per finishing pair for the team count', () => {
    const rows = pairingRows(6, 'Playoff')
    expect(rows.map((row) => row.label)).toEqual(['1st v 2nd', '3rd v 4th', '5th v 6th'])
    expect(rows[1].home).toMatchObject({ kind: 'tbc', text: '3rd in the pool' })
    expect(rows[1].away).toMatchObject({ kind: 'tbc', text: '4th in the pool' })
    expect(rows.every((row) => row.stage === 'Playoff')).toBe(true)
  })

  it('rounds an odd team count down and always makes at least one game', () => {
    expect(pairingRows(7, 'Playoff')).toHaveLength(3)
    expect(pairingRows(0, 'Playoff')).toHaveLength(1)
  })

  it('makes two semi-finals and a final between their winners', () => {
    const rows = semiFinalRows()
    expect(rows.map((row) => row.stage)).toEqual(['Semi-final', 'Semi-final', 'Final'])
    expect(rows[0]).toMatchObject({ home: { text: '1st in the pool' }, away: { text: '4th in the pool' } })
    expect(rows[1]).toMatchObject({ home: { text: '2nd in the pool' }, away: { text: '3rd in the pool' } })
    expect(rows[2]).toMatchObject({ home: { text: 'Winner of semi-final 1' }, away: { text: 'Winner of semi-final 2' } })
  })
})
