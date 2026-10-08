import { describe, expect, it } from 'vitest'
import { compactFilterPanelSx, COMPACT_FIELD_HEIGHT, filterPanelSx, filterPanelSxFor } from './filterPanel'

describe('filterPanelSx density (085 I)', () => {
  it('comfortable (the default) is the original surface with 16 px padding and gap', () => {
    expect(filterPanelSxFor()).toBe(filterPanelSx)
    expect(filterPanelSxFor('comfortable')).toMatchObject({ p: 2, gap: 2, boxShadow: 1, borderRadius: 2 })
  })

  it('compact keeps the surface and halves the padding and the row gap to 8 px', () => {
    expect(filterPanelSxFor('compact')).toBe(compactFilterPanelSx)
    expect(compactFilterPanelSx).toMatchObject({ p: 1, gap: 1, boxShadow: 1, borderRadius: 2, bgcolor: 'background.paper' })
  })

  it('names the 36 px compact field height', () => {
    expect(COMPACT_FIELD_HEIGHT).toBe(36)
  })
})
