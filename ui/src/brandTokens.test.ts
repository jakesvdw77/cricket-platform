import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BACKDROP_COLOURS } from './components/PageBackdrop'
import { BRAND, CHROME, FONT_DISPLAY } from './brandTokens'
import { HUB } from './pages/view/myPlayers/hubStyle'
import { baseTheme } from './theme'

// docs/specs/120 Decision 3: one copy of the brand constants for ui/, and a hand-kept copy in the Keycloak login theme
// that this test fails on when it drifts.
const root = join(process.cwd(), '..')
const KEYCLOAK_CSS = readFileSync(join(root, 'keycloak/themes/cricketlegend/login/resources/css/cricketlegend.css'), 'utf8')

const keycloakVar = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(KEYCLOAK_CSS)?.[1].toLowerCase()

describe('brandTokens single source', () => {
  it('BACKDROP_COLOURS and HUB read the shared values', () => {
    expect(BACKDROP_COLOURS).toMatchObject({
      green900: BRAND.green900,
      green800: BRAND.green800,
      green700: BRAND.green700,
      ink: BRAND.ink,
      gold: BRAND.gold,
      sand: BRAND.sand,
      cream: BRAND.cream,
    })
    expect(HUB).toMatchObject({ cream: BRAND.cream, gold: BRAND.gold, ink: BRAND.ink, sand: BRAND.sand })
    expect(HUB.display).toBe(FONT_DISPLAY)
  })

  it('the theme and chrome palette are built from the brand tokens', () => {
    expect(baseTheme.palette.primary.main).toBe(BRAND.green700)
    expect(baseTheme.palette.primary.dark).toBe(BRAND.green800)
    expect(baseTheme.palette.chrome.header).toBe(BRAND.green900)
    expect(CHROME.menu).toBe(BRAND.menu)
    expect(CHROME.selected).toBe(BRAND.gold)
    expect(CHROME.text).toBe(BRAND.cream)
  })

  it('the Keycloak CSS brand colours equal brandTokens (fails if they drift)', () => {
    expect(keycloakVar('cl-green-900')).toBe(BRAND.green900.toLowerCase())
    expect(keycloakVar('cl-green-800')).toBe(BRAND.green800.toLowerCase())
    expect(keycloakVar('cl-green-700')).toBe(BRAND.green700.toLowerCase())
    expect(keycloakVar('cl-gold')).toBe(BRAND.gold.toLowerCase())
    expect(keycloakVar('cl-cream')).toBe(BRAND.cream.toLowerCase())
    expect(keycloakVar('cl-sand')).toBe(BRAND.sand.toLowerCase())
  })
})

describe('shared Barlow font files', () => {
  const read = (path: string) => readFileSync(join(root, path))
  it.each(['barlow-condensed-latin-600-normal.woff2', 'barlow-condensed-latin-700-normal.woff2'])('%s is byte-identical in the app and the Keycloak theme', (file) => {
    const app = read(`ui/public/fonts/${file}`)
    const keycloak = read(`keycloak/themes/cricketlegend/login/resources/fonts/${file}`)
    expect(app.length).toBeGreaterThan(0)
    expect(app.equals(keycloak)).toBe(true)
  })
})
