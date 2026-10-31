import { isAddedRowNumber, FIRST_ADDED_ROW } from './importDecisions'

// The one wording for a row number shown to a person: a file row is "Row 14", a row added in the wizard (numbered 1001 and up) is
// "New 1". The numeric row number stays the machine value everywhere else.
export function importRowLabel(rowNumber: number): string {
  return isAddedRowNumber(rowNumber) ? `New ${rowNumber - (FIRST_ADDED_ROW - 1)}` : `Row ${rowNumber}`
}

// "Row 3", "Row 3 and New 1", "Row 3, New 1 and New 2".
export function importRowLabels(rowNumbers: number[]): string {
  const labels = rowNumbers.map(importRowLabel)
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}
