import { describe, expect, it } from 'vitest'
import { VIEW_TABS_PROPS, viewTabSx, viewTabsSx } from './viewTabs'

describe('viewTabs', () => {
  it('keeps the strip and tab at 44 px, scrollable, with a divider under the strip', () => {
    expect(VIEW_TABS_PROPS).toEqual({ variant: 'scrollable', scrollButtons: false })
    expect(viewTabsSx).toMatchObject({ borderBottom: 1, borderColor: 'divider', minHeight: 44 })
    expect(viewTabSx).toMatchObject({ minHeight: 44, textTransform: 'none', fontWeight: 600 })
  })
})
