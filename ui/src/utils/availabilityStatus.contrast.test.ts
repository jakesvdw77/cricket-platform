import { decomposeColor, getContrastRatio, lighten, recomposeColor } from '@mui/material'
import { describe, expect, it } from 'vitest'
import { baseTheme } from '../theme'
import { STATUS_COLOR } from './availabilityStatus'

// docs/specs/085: the status chips (12% tone tint, tone.dark text) on the Player tab sit on the panel colour and on the
// zebra tint; the gauge legend and the compact counter marker are small text on the card colour. All must stay >= 4.5:1.
function blend(top: string, alpha: number, base: string): string {
  const t = decomposeColor(top).values
  const b = decomposeColor(base).values
  const mixed = [0, 1, 2].map((i) => Math.round(t[i] * alpha + b[i] * (1 - alpha)))
  return recomposeColor({ type: 'rgb', values: mixed as [number, number, number] })
}

const paper = baseTheme.palette.background.paper
const zebra = lighten(baseTheme.palette.primary.main, 0.95)

describe('085 contrast', () => {
  for (const [status, tone] of Object.entries(STATUS_COLOR)) {
    for (const [name, row] of [['paper', paper], ['zebra tint', zebra]] as const) {
      it(`${status} chip text is at least 4.5:1 on the ${name} row`, () => {
        const chip = blend(baseTheme.palette[tone].main, 0.12, row)
        expect(getContrastRatio(baseTheme.palette[tone].dark, chip)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('the gauge legend text and the compact counter marker are at least 4.5:1 on the card', () => {
    expect(getContrastRatio(baseTheme.palette.text.secondary, paper)).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(baseTheme.palette.text.primary, paper)).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(baseTheme.palette.primary.main, paper)).toBeGreaterThanOrEqual(4.5)
  })
})
