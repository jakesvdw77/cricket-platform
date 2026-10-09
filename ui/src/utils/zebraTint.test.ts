import { lighten } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { baseTheme, withClubBranding } from '../theme'
import { ZEBRA_TINT_AMOUNT, zebraTint } from './zebraTint'

describe('zebraTint (docs/specs/087)', () => {
  it('is the primary colour lightened by 95 %', () => {
    expect(ZEBRA_TINT_AMOUNT).toBe(0.95)
    expect(zebraTint(baseTheme)).toBe(lighten(baseTheme.palette.primary.main, 0.95))
  })

  it('follows a club-branded primary colour', () => {
    const branded = withClubBranding('#1d4ed8')
    expect(zebraTint(branded)).toBe(lighten('#1d4ed8', 0.95))
    expect(zebraTint(branded)).not.toBe(zebraTint(baseTheme))
  })

  it('is opaque, never an alpha colour', () => {
    expect(zebraTint(baseTheme)).toMatch(/^rgb\(\d+, ?\d+, ?\d+\)$/)
  })
})
