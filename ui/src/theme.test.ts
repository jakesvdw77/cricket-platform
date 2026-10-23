import { getContrastRatio } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'
import { BRAND, FONT_DISPLAY, GROUND_GRADIENT } from './brandTokens'
import { baseTheme, pageBackgroundGradient, readablePrimary, withClubBranding } from './theme'

// docs/specs/120 Decision 22: whatever primary a club picks, text and control edges drawn in it stay readable on white
// and on the darkest stop of the cream ground.
const DARKEST_GROUND = BRAND.groundTop
const CLUB_COLOURS: Record<string, string> = {
  'platform default': BRAND.green700,
  gold: '#F2C94C',
  yellow: '#FFEB3B',
  red: '#C8102E',
  navy: '#1F3A8A',
  'near white': '#FAFAFA',
}

describe('theme tokens (docs/specs/120)', () => {
  it('uses the display face, a 6 px radius and the platform default primary', () => {
    expect(baseTheme.typography.fontFamilyDisplay).toBe(FONT_DISPLAY)
    expect(baseTheme.shape.borderRadius).toBe(6)
    expect(baseTheme.palette.primary.main).toBe('#14633F')
  })

  it('keeps the chrome and the page ground the same for every club colour', () => {
    const club = withClubBranding('#C8102E')
    expect(club.palette.primary.main).toBe('#C8102E')
    expect(club.palette.chrome).toEqual(baseTheme.palette.chrome)
    expect(pageBackgroundGradient(club)).toBe(pageBackgroundGradient(baseTheme))
    expect(pageBackgroundGradient(baseTheme)).toBe(GROUND_GRADIENT)
  })

  it('returns the base theme for the platform default colour in any case', () => {
    expect(withClubBranding('#14633f')).toBe(baseTheme)
  })
})

describe('readablePrimary', () => {
  describe.each(Object.entries(CLUB_COLOURS))('%s (%s)', (_name, colour) => {
    const theme = withClubBranding(colour)

    it('gives text 4.5:1 on white and on the darkest ground stop', () => {
      const text = readablePrimary(theme, 'text')
      expect(getContrastRatio(text, '#ffffff')).toBeGreaterThanOrEqual(4.5)
      expect(getContrastRatio(text, DARKEST_GROUND)).toBeGreaterThanOrEqual(4.5)
    })

    it('gives an edge 3:1 on white and on the darkest ground stop', () => {
      const edge = readablePrimary(theme, 'edge')
      expect(getContrastRatio(edge, '#ffffff')).toBeGreaterThanOrEqual(3)
      expect(getContrastRatio(edge, DARKEST_GROUND)).toBeGreaterThanOrEqual(3)
    })

    it('gives contained button text 4.5:1 on the club fill', () => {
      const { main } = theme.palette.primary
      expect(getContrastRatio(main, theme.palette.getContrastText(main))).toBeGreaterThanOrEqual(4.5)
    })
  })

  it('keeps the club colour itself when it already passes', () => {
    expect(readablePrimary(baseTheme, 'text')).toBe(BRAND.green700)
    expect(readablePrimary(withClubBranding('#1F3A8A'), 'text')).toBe('#1F3A8A')
  })

  it('falls back to a darker shade for a colour that fails', () => {
    const gold = withClubBranding('#F2C94C')
    expect(readablePrimary(gold, 'text')).not.toBe('#F2C94C')
    expect(getContrastRatio(readablePrimary(gold, 'text'), '#ffffff')).toBeGreaterThan(getContrastRatio('#F2C94C', '#ffffff'))
  })
})

describe('chrome contrast (docs/specs/120 Test Plan)', () => {
  const { chrome } = baseTheme.palette
  it('gold on the side menu and cream on the header and menu meet 4.5:1', () => {
    expect(getContrastRatio(BRAND.gold, chrome.menu)).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(BRAND.cream, chrome.header)).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(BRAND.cream, chrome.menu)).toBeGreaterThanOrEqual(4.5)
  })
})
