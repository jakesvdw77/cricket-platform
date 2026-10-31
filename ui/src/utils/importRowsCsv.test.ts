import { describe, expect, it } from 'vitest'
import type { ImportIssue, ImportRow } from '../api/importApi'
import { isNotImported, rowsToCsv } from './importRowsCsv'

function row(patch: Partial<ImportRow> = {}): ImportRow {
  return { rowNumber: 3, sourceRef: 'A3', values: {}, status: 'OK', outcome: 'NEW', action: 'CREATE', issueCodes: [], existingRef: null, ...patch }
}

describe('isNotImported', () => {
  it('is true for a skipped, excluded or not-ours row and false for a row that will be created or updated', () => {
    expect(isNotImported(row({ action: 'SKIP' }))).toBe(true)
    expect(isNotImported(row({ action: 'EXCLUDED' }))).toBe(true)
    expect(isNotImported(row({ status: 'SKIPPED_NOT_OURS' }))).toBe(true)
    expect(isNotImported(row({ action: 'CREATE' }))).toBe(false)
    expect(isNotImported(row({ action: 'UPDATE' }))).toBe(false)
  })
})

describe('rowsToCsv', () => {
  it('writes a header of the fixed columns plus the union of the value keys, and one line per row', () => {
    const csv = rowsToCsv([row({ values: { home: 'A' } }), row({ rowNumber: 1001, values: { away: 'B' } })], [])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Row,Label,Cell,Status,Outcome,Action,Reason,home,away')
    expect(lines[1]).toBe('3,Row 3,A3,OK,NEW,CREATE,,A,')
    expect(lines[2]).toBe('1001,New 1,A3,OK,NEW,CREATE,,,B')
  })

  it('quotes cells with commas, quotes and line breaks', () => {
    const csv = rowsToCsv([row({ values: { notes: 'say "hi", please\nnow' } })], [])
    expect(csv).toContain('"say ""hi"", please\nnow"')
  })

  it('prefixes a cell that starts like a formula so a spreadsheet never runs it', () => {
    const csv = rowsToCsv([row({ values: { notes: '=HYPERLINK("x")' } }), row({ values: { notes: '+1' } }), row({ values: { notes: '@SUM' } }), row({ values: { notes: '-2' } })], [])
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`)
    expect(lines[2].endsWith(`'+1`)).toBe(true)
    expect(lines[3].endsWith(`'@SUM`)).toBe(true)
    expect(lines[4].endsWith(`'-2`)).toBe(true)
  })

  it('joins the messages of the issues that name the row, by row number or by code', () => {
    const issues: ImportIssue[] = [
      { code: 'BAD_DATE', severity: 'ERROR', rowNumbers: [3], field: 'date', message: 'Date is not valid', hint: null },
      { code: 'SAME_TEAM', severity: 'ERROR', rowNumbers: [9], field: null, message: 'A team cannot play itself', hint: null },
      { code: 'OTHER', severity: 'WARNING', rowNumbers: [8], field: null, message: 'Unrelated', hint: null },
    ]
    const csv = rowsToCsv([row({ issueCodes: ['SAME_TEAM'] })], issues)
    expect(csv.split('\r\n')[1]).toContain('Date is not valid; A team cannot play itself')
    expect(csv).not.toContain('Unrelated')
  })

  it('renders a missing source cell as empty and an object value as JSON', () => {
    const csv = rowsToCsv([row({ sourceRef: null, values: { extra: { a: 1 } } })], [])
    expect(csv.split('\r\n')[1]).toBe('3,Row 3,,OK,NEW,CREATE,,"{""a"":1}"')
  })

  it('gives only the header for no rows', () => {
    expect(rowsToCsv([], [])).toBe('Row,Label,Cell,Status,Outcome,Action,Reason')
  })
})
