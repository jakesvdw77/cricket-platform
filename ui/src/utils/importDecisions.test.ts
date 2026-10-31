import { describe, expect, it } from 'vitest'
import { emptyImportDecisions } from '../api/importApi'
import type { ImportIssue } from '../api/importApi'
import { RESOLUTION_STEP_CODES, blockingErrorCount, errorCount, hasDecisions, hasOpenProposals, nextAddedRowNumber, normaliseOptions, pendingResolutionRows, pickOf, removeAddedRow, resumeStepFor, teamSummary, withAddedRow, withPickedResolutions, withResolution, withRowEdit, withoutRowEdit } from './importDecisions'

const unresolved = (rows: number[]): ImportIssue => ({ code: 'TEAM_UNRESOLVED', severity: 'ERROR', rowNumbers: rows, field: 'home', message: 'not linked', hint: null })
const badDate: ImportIssue = { code: 'BAD_DATE', severity: 'ERROR', rowNumbers: [3], field: 'date', message: 'bad date', hint: null }

describe('blockingErrorCount', () => {
  it('ignores the codes a later step resolves but still counts other errors', () => {
    const issues = [unresolved([2]), unresolved([3]), badDate]
    expect(errorCount(issues, emptyImportDecisions())).toBe(3)
    expect(blockingErrorCount(issues, emptyImportDecisions())).toBe(1)
    expect(blockingErrorCount(issues, emptyImportDecisions(), [])).toBe(3)
    expect(RESOLUTION_STEP_CODES).toEqual(['TEAM_UNRESOLVED'])
  })
})

describe('pendingResolutionRows', () => {
  it('lists rows whose only errors are deferred ones', () => {
    expect([...pendingResolutionRows([unresolved([2, 3]), badDate])]).toEqual([2])
  })
})

describe('resumeStepFor', () => {
  it('does not send a batch back to Check rows for an unresolved team', () => {
    const decisions = withResolution(emptyImportDecisions(), { key: 'A', kind: 'LINK', targetKind: 'OWN_TEAM', targetId: 't1', targetName: 'A', remember: false })
    const batch = { issues: [unresolved([2])], proposals: [{ key: 'B', step: 'RESOLVE' as const, candidates: [] }] } as unknown as Parameters<typeof resumeStepFor>[0]
    expect(resumeStepFor(batch, decisions, [], false)).toBe('resolve')
  })
})

describe('row edits and added rows (spec 125)', () => {
  it('merges edits of a row and resets them', () => {
    let decisions = withRowEdit(emptyImportDecisions(), 5, { date: '2026-10-11' })
    decisions = withRowEdit(decisions, 5, { venue: 'Main oval' })
    expect(decisions.rowEdits).toEqual([{ rowNumber: 5, values: { date: '2026-10-11', venue: 'Main oval' } }])
    expect(hasDecisions(decisions)).toBe(true)
    expect(withoutRowEdit(decisions, 5).rowEdits).toEqual([])
  })

  it('ignores an empty edit', () => {
    const decisions = emptyImportDecisions()
    expect(withRowEdit(decisions, 5, {})).toBe(decisions)
  })

  it('numbers added rows from 1001 and never goes below what was used', () => {
    expect(nextAddedRowNumber(emptyImportDecisions())).toBe(1001)
    const decisions = withAddedRow(emptyImportDecisions(), { rowNumber: 1001, values: { home: 'A' } })
    expect(nextAddedRowNumber(decisions)).toBe(1002)
    expect(nextAddedRowNumber(removeAddedRow(decisions, 1001), 1001)).toBe(1002)
  })

  it('edits an added row inside addedRows and removes it with its exclusion', () => {
    let decisions = withAddedRow(emptyImportDecisions(), { rowNumber: 1001, values: { home: 'A', away: 'B' } })
    decisions = withRowEdit(decisions, 1001, { away: 'C' })
    expect(decisions.addedRows).toEqual([{ rowNumber: 1001, values: { home: 'A', away: 'C' } }])
    expect(decisions.rowEdits).toEqual([])
    expect(removeAddedRow({ ...decisions, excludedRows: [1001] }, 1001)).toMatchObject({ addedRows: [], excludedRows: [] })
  })

  it('counts added rows as decisions so a reload restores them', () => {
    expect(hasDecisions(withAddedRow(emptyImportDecisions(), { rowNumber: 1001, values: {} }))).toBe(true)
    expect(hasDecisions({ ...emptyImportDecisions(), options: { windowDays: 30 } })).toBe(true)
  })
})

describe('option identity (spec 125 amendment)', () => {
  it('de-dupes by label, preferring an identity and the first identity', () => {
    const merged = normaliseOptions(['Hilton', { label: 'irene villagers 2', kind: 'OWN_TEAM', id: 'o-1' }, { label: 'Irene Villagers 2', kind: 'LEAGUE_TEAM', id: 'l-1' }, { label: 'hilton', kind: 'LEAGUE_TEAM', id: 'l-2' }, '  '])
    expect(merged).toEqual([{ label: 'hilton', kind: 'LEAGUE_TEAM', id: 'l-2' }, { label: 'irene villagers 2', kind: 'OWN_TEAM', id: 'o-1' }])
  })

  it('records a LINK resolution per pick, replacing an earlier one, and none for a plain option', () => {
    const start = withResolution(emptyImportDecisions(), { key: 'Hilton', kind: 'CREATE', targetKind: null, targetId: null, targetName: 'Hilton', remember: false })
    const next = withPickedResolutions(start, [pickOf({ label: 'Hilton', kind: 'LEAGUE_TEAM', id: 'l-2' })!])
    expect(next.resolutions).toEqual([{ key: 'Hilton', kind: 'LINK', targetKind: 'LEAGUE_TEAM', targetId: 'l-2', targetName: 'Hilton', remember: false }])
    expect(pickOf({ label: 'Plain' })).toBeNull()
    expect(withPickedResolutions(start, [])).toBe(start)
  })

  it('counts matched and new teams, copies as new, and spots an open proposal', () => {
    const proposal = (key: string) => ({ key, value: key, step: 'RESOLVE' as const, rowNumbers: [1], candidates: [] })
    const proposals = [proposal('a'), proposal('b'), proposal('c'), proposal('d')]
    let decisions = withResolution(emptyImportDecisions(), { key: 'a', kind: 'LINK', targetKind: 'OWN_TEAM', targetId: '1', targetName: 'a', remember: false })
    decisions = withResolution(decisions, { key: 'b', kind: 'CREATE', targetKind: null, targetId: null, targetName: 'b', remember: false })
    decisions = withResolution(decisions, { key: 'c', kind: 'LINK', targetKind: 'COPY_LEAGUE_TEAM', targetId: '3', targetName: 'c', remember: false })
    expect(teamSummary(proposals, decisions)).toEqual({ matched: 1, created: 2 })
    expect(hasOpenProposals({ proposals }, 'RESOLVE', decisions, [])).toBe(true)
    expect(hasOpenProposals({ proposals: proposals.slice(0, 3) }, 'RESOLVE', decisions, [])).toBe(false)
  })
})
