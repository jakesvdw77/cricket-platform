import { describe, expect, it } from 'vitest'
import type { DismissalType } from '../api/matchResultApi'
import { applyWicketFill, dismissalCount, initialBattedCount, initialRows, newRowFill } from './wicketFill'
import type { FillRow } from './wicketFill'

const howOuts = (rows: FillRow[]) => rows.map((row) => row.howOut)

// Marks row `index` as the manager's own choice (the grid clears `auto` on an edit).
const mark = (rows: FillRow[], index: number, howOut: DismissalType | null): FillRow[] =>
  rows.map((row, i) => (i === index ? { howOut, auto: false } : row))

describe('wicketFill', () => {
  it('starts with wickets + 2 batters and the rest did not bat', () => {
    const rows = initialRows(11, 4)
    expect(howOuts(rows)).toEqual([null, null, null, null, null, null, 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT'])
  })

  it('lists everyone as batted for 10 wickets (all out)', () => {
    expect(initialBattedCount(11, 10)).toBe(11)
    expect(howOuts(initialRows(11, 10)).every((howOut) => howOut === null)).toBe(true)
  })

  it('lists the whole line-up when it is shorter than wickets + 2', () => {
    expect(initialBattedCount(5, 6)).toBe(5)
    expect(howOuts(initialRows(5, 6))).toEqual([null, null, null, null, null])
  })

  it('lists everyone as batted while the wickets are not known', () => {
    expect(initialBattedCount(11, null)).toBe(11)
  })

  it('makes the remaining batted rows Not out once the dismissals equal the wickets', () => {
    let rows = initialRows(11, 4)
    rows = mark(rows, 0, 'CAUGHT')
    rows = mark(rows, 1, 'BOWLED')
    rows = mark(rows, 2, 'LBW')
    expect(howOuts(applyWicketFill(rows, 4))).toEqual([
      'CAUGHT', 'BOWLED', 'LBW', null, null, null, 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT',
    ])
    rows = mark(rows, 3, 'RUN_OUT')
    const filled = applyWicketFill(rows, 4)
    expect(howOuts(filled).slice(0, 7)).toEqual(['CAUGHT', 'BOWLED', 'LBW', 'RUN_OUT', 'NOT_OUT', 'NOT_OUT', 'DID_NOT_BAT'])
    expect(filled[4].auto).toBe(true)
  })

  it('handles 10 wickets: ten dismissals and the last batter not out', () => {
    let rows = initialRows(11, 10)
    for (let i = 0; i < 10; i += 1) rows = mark(rows, i, 'CAUGHT')
    const filled = applyWicketFill(rows, 10)
    expect(filled[10].howOut).toBe('NOT_OUT')
  })

  it('reverts the automatic Not outs when a dismissal is cleared', () => {
    let rows = initialRows(11, 2)
    rows = mark(rows, 0, 'CAUGHT')
    rows = mark(rows, 1, 'BOWLED')
    rows = applyWicketFill(rows, 2)
    expect(howOuts(rows).slice(0, 4)).toEqual(['CAUGHT', 'BOWLED', 'NOT_OUT', 'NOT_OUT'])
    rows = applyWicketFill(mark(rows, 1, null), 2)
    expect(howOuts(rows).slice(0, 4)).toEqual(['CAUGHT', null, null, null])
  })

  it('keeps a Not out the manager chose themselves when the fill reverts', () => {
    let rows = initialRows(11, 2)
    rows = mark(rows, 3, 'NOT_OUT')
    rows = mark(rows, 0, 'CAUGHT')
    rows = applyWicketFill(rows, 2)
    expect(rows[3]).toMatchObject({ howOut: 'NOT_OUT', auto: false })
  })

  it('counts Retired out as a dismissal and Retired not out as none', () => {
    expect(dismissalCount([{ howOut: 'RETIRED_OUT' }, { howOut: 'RETIRED_NOT_OUT' }, { howOut: 'NOT_OUT' }, { howOut: null }])).toBe(1)
    let rows = initialRows(6, 1)
    rows = mark(rows, 0, 'RETIRED_NOT_OUT')
    expect(howOuts(applyWicketFill(rows, 1))[1]).toBeNull()
    rows = mark(rows, 0, 'RETIRED_OUT')
    expect(howOuts(applyWicketFill(rows, 1))[1]).toBe('NOT_OUT')
  })

  it('forces nothing when more dismissals are marked than wickets', () => {
    let rows = initialRows(11, 1)
    rows = mark(rows, 0, 'CAUGHT')
    rows = mark(rows, 1, 'BOWLED')
    expect(howOuts(applyWicketFill(rows, 1)).slice(0, 4)).toEqual(['CAUGHT', 'BOWLED', null, 'DID_NOT_BAT'])
  })

  it('fills nothing while the wickets are not known', () => {
    const rows = mark(initialRows(3, null), 0, 'CAUGHT')
    expect(howOuts(applyWicketFill(rows, null))).toEqual(['CAUGHT', null, null])
  })

  it('adds a row as Did not bat once wickets + 2 batters are in play', () => {
    // 1 wicket: 3 in play, the 4th is Did not bat.
    expect(newRowFill(initialRows(3, 1), 1)).toEqual({ howOut: 'DID_NOT_BAT', auto: true })
  })

  it('adds an editable row while fewer than wickets + 2 are in play', () => {
    // A line-up cut short: 2 in play with 1 wicket, so a third is still editable.
    expect(newRowFill(initialRows(2, 1), 1)).toEqual({ howOut: null })
  })

  it('adds a Did not bat row once the dismissals equal the wickets, never an automatic Not out', () => {
    const rows = mark(initialRows(2, 1), 0, 'CAUGHT')
    expect(newRowFill(rows, 1)).toEqual({ howOut: 'DID_NOT_BAT', auto: true })
  })

  it('adds an undecided row when the wickets are not known', () => {
    expect(newRowFill(initialRows(5, null), null)).toEqual({ howOut: null })
  })
})
