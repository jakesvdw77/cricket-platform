import { describe, expect, it } from 'vitest'
import type { DismissalType } from '../api/matchResultApi'
import { applyWicketFill, dismissalCount, initialRows, newRowFill } from './wicketFill'
import type { FillRow } from './wicketFill'

const howOuts = (rows: FillRow[]) => rows.map((row) => row.howOut)

// Marks row `index` as the manager's own choice (the grid clears `auto` on an edit).
const mark = (rows: FillRow[], index: number, howOut: DismissalType | null): FillRow[] =>
  rows.map((row, i) => (i === index ? { howOut, auto: false } : row))

describe('wicketFill', () => {
  it('starts with everyone as an automatic Did not bat, never a blank row', () => {
    const rows = initialRows(4, 2)
    expect(howOuts(rows)).toEqual(['DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT'])
    expect(rows.every((row) => row.auto)).toBe(true)
  })

  it('makes the next two rows after the last dismissed batter Not out once the dismissals equal the wickets', () => {
    let rows = initialRows(11, 4)
    rows = mark(rows, 0, 'CAUGHT')
    rows = mark(rows, 1, 'BOWLED')
    rows = mark(rows, 2, 'LBW')
    // 3 dismissals of 4 wickets: nothing is Not out yet
    expect(howOuts(applyWicketFill(rows, 4)).slice(0, 6)).toEqual(['CAUGHT', 'BOWLED', 'LBW', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT'])
    rows = mark(rows, 3, 'RUN_OUT')
    const filled = applyWicketFill(rows, 4)
    expect(howOuts(filled)).toEqual(['CAUGHT', 'BOWLED', 'LBW', 'RUN_OUT', 'NOT_OUT', 'NOT_OUT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT'])
    expect(filled[4].auto).toBe(true)
  })

  it('counts from the last dismissed batter, skipping rows the manager already set', () => {
    let rows = initialRows(6, 2)
    rows = mark(rows, 0, 'CAUGHT')
    rows = mark(rows, 2, 'BOWLED')
    rows = mark(rows, 3, 'NOT_OUT')
    expect(howOuts(applyWicketFill(rows, 2))).toEqual(['CAUGHT', 'DID_NOT_BAT', 'BOWLED', 'NOT_OUT', 'NOT_OUT', 'NOT_OUT'])
  })

  it('handles 10 wickets: ten dismissals and the last batter not out', () => {
    let rows = initialRows(11, 10)
    for (let i = 0; i < 10; i += 1) rows = mark(rows, i, 'CAUGHT')
    expect(applyWicketFill(rows, 10)[10].howOut).toBe('NOT_OUT')
  })

  it('reverts the automatic Not outs when a dismissal is cleared', () => {
    let rows = initialRows(11, 2)
    rows = mark(rows, 0, 'CAUGHT')
    rows = mark(rows, 1, 'BOWLED')
    rows = applyWicketFill(rows, 2)
    expect(howOuts(rows).slice(0, 4)).toEqual(['CAUGHT', 'BOWLED', 'NOT_OUT', 'NOT_OUT'])
    rows = applyWicketFill(mark(rows, 1, 'DID_NOT_BAT'), 2)
    expect(howOuts(rows).slice(0, 4)).toEqual(['CAUGHT', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT'])
  })

  it('keeps a Not out the manager chose themselves', () => {
    let rows = initialRows(11, 2)
    rows = mark(rows, 3, 'NOT_OUT')
    rows = mark(rows, 0, 'CAUGHT')
    expect(applyWicketFill(rows, 2)[3]).toMatchObject({ howOut: 'NOT_OUT', auto: false })
  })

  it('counts Retired out as a dismissal and Retired not out as none', () => {
    expect(dismissalCount([{ howOut: 'RETIRED_OUT' }, { howOut: 'RETIRED_NOT_OUT' }, { howOut: 'NOT_OUT' }, { howOut: null }])).toBe(1)
    let rows = initialRows(6, 1)
    rows = mark(rows, 0, 'RETIRED_NOT_OUT')
    expect(howOuts(applyWicketFill(rows, 1))[1]).toBe('DID_NOT_BAT')
    rows = mark(rows, 0, 'RETIRED_OUT')
    expect(howOuts(applyWicketFill(rows, 1))[1]).toBe('NOT_OUT')
  })

  it('makes nothing Not out when more or fewer dismissals are marked than wickets', () => {
    let rows = initialRows(5, 1)
    rows = mark(rows, 0, 'CAUGHT')
    rows = mark(rows, 1, 'BOWLED')
    expect(howOuts(applyWicketFill(rows, 1))).toEqual(['CAUGHT', 'BOWLED', 'DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT'])
    expect(howOuts(applyWicketFill(rows, 5)).slice(2)).toEqual(['DID_NOT_BAT', 'DID_NOT_BAT', 'DID_NOT_BAT'])
  })

  it('makes nothing Not out while the wickets are not known', () => {
    const rows = mark(initialRows(3, null), 0, 'CAUGHT')
    expect(howOuts(applyWicketFill(rows, null))).toEqual(['CAUGHT', 'DID_NOT_BAT', 'DID_NOT_BAT'])
  })

  it('turns a blank row without figures into Did not bat, and flips a Did not bat row the moment it has a figure', () => {
    const blank: FillRow[] = [{ howOut: null }, { howOut: null }]
    expect(howOuts(applyWicketFill(blank, null))).toEqual(['DID_NOT_BAT', 'DID_NOT_BAT'])
    const typed = applyWicketFill(initialRows(2, null).map((row, i) => (i === 1 ? { ...row, runs: 7 } : row)), null)
    expect(typed[0]).toMatchObject({ howOut: 'DID_NOT_BAT', auto: true })
    expect(typed[1]).toMatchObject({ howOut: null, auto: false })
  })

  it('leaves an explicit Did not bat alone', () => {
    const rows = mark(initialRows(2, null), 0, 'DID_NOT_BAT')
    expect(applyWicketFill(rows, null)[0]).toMatchObject({ howOut: 'DID_NOT_BAT', auto: false })
  })

  it('starts a newly added row as an automatic Did not bat', () => {
    expect(newRowFill()).toEqual({ howOut: 'DID_NOT_BAT', auto: true })
  })

  it('never makes a batted row with figures but no how out a Not out or a wicket', () => {
    let rows: Array<FillRow & { runs?: number | null }> = initialRows(5, 1)
    rows = mark(rows, 0, 'CAUGHT')
    rows = rows.map((row, i) => (i === 1 ? { ...row, howOut: null, auto: false, runs: 9 } : row))
    const filled = applyWicketFill(rows, 1)
    expect(filled[1]).toMatchObject({ howOut: null, runs: 9 })
    expect(dismissalCount(filled)).toBe(1)
    expect(filled.slice(2, 4).map((row) => row.howOut)).toEqual(['NOT_OUT', 'NOT_OUT'])
  })
})
