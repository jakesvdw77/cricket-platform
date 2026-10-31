import { describe, expect, it } from 'vitest'
import { importRowLabel, importRowLabels } from './importRowLabel'

describe('importRowLabel', () => {
  it('labels file rows and added rows', () => {
    expect(importRowLabel(14)).toBe('Row 14')
    expect(importRowLabel(1000)).toBe('Row 1000')
    expect(importRowLabel(1001)).toBe('New 1')
    expect(importRowLabel(1002)).toBe('New 2')
  })
  it('joins mixed lists', () => {
    expect(importRowLabels([])).toBe('')
    expect(importRowLabels([3])).toBe('Row 3')
    expect(importRowLabels([3, 1001])).toBe('Row 3 and New 1')
    expect(importRowLabels([3, 1001, 1002])).toBe('Row 3, New 1 and New 2')
  })
})
