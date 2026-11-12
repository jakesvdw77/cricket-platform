import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { alpha } from '@mui/material/styles'
import { BRAND, TICKER_FADE, TICKER_TONES, blackAlpha } from '../../../brandTokens'
import { HUB } from './hubStyle'
import { TICKER_KIND_RULES } from './tickerKindRules'
import { TICKER_KINDS } from './tickerKinds'
import type { TickerKind } from './tickerTypes'

// docs/specs/146 Test Plan, contract guards: the strip and the shuffle never import a source or a Hub read module, the registry holds
// exactly the built kinds, every tone is a token, and no ticker file carries a hex literal.
const dir = import.meta.dirname
const read = (path: string) => readFileSync(join(dir, path), 'utf8')
const imports = (source: string) => [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])
const TICKER_FILES = ['HubTicker/HubTicker.tsx', 'HubFooter/HubFooter.tsx', 'weightedShuffle.ts', 'tickerKinds.ts', 'tickerKindRules.ts', 'tickerItems.ts', 'tickerText.ts', 'tickerTypes.ts', 'tickerConfig.ts', 'tickerRoute.ts', 'useTickerCycle.ts', 'useTickerData.ts', ...readdirSync(join(dir, 'tickerSources')).map((name) => `tickerSources/${name}`)]

describe('the ticker contract guards', () => {
  it('HubTicker and orderTickerItems import no source file and no matches, results or polls api module', () => {
    for (const file of ['HubTicker/HubTicker.tsx', 'weightedShuffle.ts', 'useTickerCycle.ts', 'tickerKindRules.ts']) {
      for (const path of imports(read(file))) {
        expect(path, `${file} imports ${path}`).not.toMatch(/tickerSources/)
        expect(path, `${file} imports ${path}`).not.toMatch(/tickerKinds$/)
        expect(path, `${file} imports ${path}`).not.toMatch(/\/api\/(myPlayersApi|meResultsApi|meApi)/)
      }
    }
  })

  it('only the sources and the data hook touch the Hub reads; the footer reads data through useTickerData', () => {
    expect(imports(read('HubFooter/HubFooter.tsx')).filter((path) => /\/api\//.test(path))).toEqual([])
    expect(imports(read('useTickerData.ts')).filter((path) => /\/api\//.test(path)).length).toBeGreaterThanOrEqual(2)
  })

  it('every built kind has a registry entry and a tone, every designed-for kind has none', () => {
    const built: TickerKind[] = ['result', 'live', 'upcoming', 'poll']
    const later: TickerKind[] = ['message', 'sponsor', 'milestone', 'standing', 'birthday', 'weather', 'onThisDay', 'funFact']
    for (const kind of built) {
      expect(TICKER_KINDS[kind], kind).toBeDefined()
      expect(TICKER_KINDS[kind]?.source).toBeTypeOf('function')
      expect(TICKER_KIND_RULES[kind]?.tone, kind).toBeDefined()
      expect(TICKER_TONES[TICKER_KIND_RULES[kind]!.tone], kind).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
    for (const kind of later) {
      expect(TICKER_KINDS[kind], kind).toBeUndefined()
      expect(TICKER_KIND_RULES[kind], kind).toBeUndefined()
    }
  })

  it('the rules are the ones in the spec', () => {
    expect(TICKER_KIND_RULES.result).toMatchObject({ label: 'Result', defaultWeight: 3, maxPerCycle: 5 })
    expect(TICKER_KIND_RULES.live).toMatchObject({ label: 'Live', defaultWeight: 5, maxPerCycle: 3, pinnedWhenPresent: true })
    expect(TICKER_KIND_RULES.upcoming).toMatchObject({ label: 'Next', defaultWeight: 2, maxPerCycle: 3 })
    expect(TICKER_KIND_RULES.poll).toMatchObject({ label: 'Poll', defaultWeight: 2, maxPerCycle: 3 })
  })

  it('no ticker file carries a hex colour literal (the 120 gate)', () => {
    for (const file of TICKER_FILES) expect(read(file), file).not.toMatch(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![\w-])/)
  })
})

// Relative luminance and the WCAG contrast ratio of two opaque colours.
const channels = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((value) => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
// The band: rgba(0,0,0,.42) over the console ground (the dark green behind the footer, which TICKER_FADE stands for).
const ground = channels('#0a3322')
const band = ground.map((value) => value * (1 - 0.42))
const over = (colour: string, opacity: number) => channels(colour).map((value, index) => value * opacity + band[index] * (1 - opacity))

describe('the ticker colours read on the band at 4.5:1 or better', () => {
  it('gold and cream text', () => {
    expect(contrast(channels(HUB.gold), band)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(channels(BRAND.cream), band)).toBeGreaterThanOrEqual(4.5)
  })

  it('the muted cream tail', () => {
    expect(contrast(over(BRAND.cream, 0.66), band)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(Object.entries(TICKER_TONES))('the %s chip tone', (_name, hex) => {
    expect(contrast(channels(hex), band)).toBeGreaterThanOrEqual(4.5)
  })

  it('the fade token is a dark green and the alpha helpers are used for transparency', () => {
    expect(luminance(channels(TICKER_FADE))).toBeLessThan(0.03)
    expect(alpha(BRAND.cream, 0.5)).toContain('rgba')
    expect(blackAlpha(0)).toContain('rgba')
  })
})
