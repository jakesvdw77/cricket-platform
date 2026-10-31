import { importRowLabel } from './importRowLabel'
import type { ImportIssue, ImportRow } from '../api/importApi'

// docs/specs/097-import-framework.md: the "rows not imported" CSV of the report. Built from the rows the paginated rows
// endpoint returns; a cell that starts like a formula is prefixed so a spreadsheet never runs it.
function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function isNotImported(row: ImportRow): boolean {
  return row.action === 'SKIP' || row.action === 'EXCLUDED' || row.status === 'SKIPPED_NOT_OURS'
}

export function rowsToCsv(rows: ImportRow[], issues: ImportIssue[]): string {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row.values)))]
  const reasonOf = (row: ImportRow) => issues.filter((issue) => issue.rowNumbers.includes(row.rowNumber) || row.issueCodes.includes(issue.code)).map((issue) => issue.message).join('; ')
  const lines = [['Row', 'Label', 'Cell', 'Status', 'Outcome', 'Action', 'Reason', ...keys].map(cell).join(',')]
  for (const row of rows) {
    lines.push([row.rowNumber, importRowLabel(row.rowNumber), row.sourceRef, row.status, row.outcome, row.action, reasonOf(row), ...keys.map((key) => row.values[key])].map(cell).join(','))
  }
  return lines.join('\r\n')
}
