import { describe, expect, it } from 'vitest'
import { RESULT_TONES } from '../../../brandTokens'
import { cardSx } from './resultCardStyle'

// docs/specs/145: the card tint follows the tone: gold for a win, the loss token for a loss, sand for a tie, a plain dark card otherwise.
describe('cardSx tone mapping', () => {
  const background = (tone: Parameters<typeof cardSx>[0]) => cardSx(tone).background

  it('tints a win with gold, a tie with sand and a loss with the loss token', () => {
    expect(background('win')).toMatch(/^linear-gradient\(160deg, rgba\(232, 184, 61/)
    expect(background('tie')).toMatch(/^linear-gradient\(160deg, rgba\(226, 213, 176/)
    const loss = background('loss')
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(RESULT_TONES.lossTint.slice(i, i + 2), 16))
    expect(loss).toContain(`rgba(${r}, ${g}, ${b}`)
  })

  it('uses a plain translucent ground, with no gradient, for a neutral result', () => {
    expect(background('neutral')).not.toContain('linear-gradient')
  })

  it('keeps the same layout for every tone', () => {
    const { background: _a, ...win } = cardSx('win')
    const { background: _b, ...loss } = cardSx('loss')
    expect(win).toEqual(loss)
  })
})
