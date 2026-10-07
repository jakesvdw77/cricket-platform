import { describe, expect, it } from 'vitest'
import { CARD_GRID_TEMPLATE_COLUMNS, POLL_CARD_GRID_TEMPLATE_COLUMNS, cardGridSx, pollCardGridSx } from './cardGrid'

// docs/specs/082: jsdom does not compute layout, so the cap is asserted on the template string.
describe('pollCardGridSx', () => {
  it('keeps the shared 380px floor and caps the columns at three', () => {
    expect(POLL_CARD_GRID_TEMPLATE_COLUMNS).toBe(
      'repeat(auto-fill, minmax(max(min(380px, 100%), calc((100% - 32px) / 3)), 1fr))',
    )
    expect(pollCardGridSx.gridTemplateColumns).toBe(POLL_CARD_GRID_TEMPLATE_COLUMNS)
    expect(pollCardGridSx.gap).toBe(2)
  })

  it('leaves the shared cardGridSx unchanged', () => {
    expect(cardGridSx.gridTemplateColumns).toBe(CARD_GRID_TEMPLATE_COLUMNS)
    expect(CARD_GRID_TEMPLATE_COLUMNS).toBe('repeat(auto-fill, minmax(min(380px, 100%), 1fr))')
  })

  it('cannot fit a fourth column at any width', () => {
    // Column minimum m = max(380, (W - 32) / 3); four columns need 4m + 3 * 16 <= W.
    for (const width of [380, 800, 1200, 1600, 2560, 5120, 10000]) {
      const min = Math.max(Math.min(380, width), (width - 32) / 3)
      const columns = Math.max(1, Math.floor((width + 16) / (min + 16)))
      expect(columns).toBeLessThanOrEqual(3)
    }
  })
})
