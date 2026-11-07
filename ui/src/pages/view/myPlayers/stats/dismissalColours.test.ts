import { describe, expect, it } from 'vitest'
import { STATS_COLOUR } from '../../../../brandTokens'
import { BATTER_DISMISSAL_COLOUR, BOWLER_WICKET_COLOUR, batterDismissalColour, bowlerWicketColour } from './dismissalColours'

// docs/specs/147 Amendment 2 item 16: for a batter, out is warm and not out is good; for a bowler every wicket is good.
describe('dismissal colours', () => {
  it('paints not out as good and being out in the warm shades, each type distinguishable', () => {
    expect(batterDismissalColour('NOT_OUT')).toBe(STATS_COLOUR.good)
    expect(batterDismissalColour('BOWLED')).toBe(STATS_COLOUR.bad)
    expect(batterDismissalColour('CAUGHT')).toBe(STATS_COLOUR.warm)
    const main = ['BOWLED', 'CAUGHT', 'CAUGHT_AND_BOWLED', 'LBW', 'STUMPED', 'RUN_OUT', 'HIT_WICKET'].map(batterDismissalColour)
    expect(new Set(main).size).toBe(main.length)
    expect(main).not.toContain(STATS_COLOUR.good)
  })

  it('falls back to grey for an unknown type, for both batter and bowler', () => {
    expect(batterDismissalColour('SOMETHING_NEW')).toBe(STATS_COLOUR.neutralGrey)
    expect(bowlerWicketColour('SOMETHING_NEW')).toBe(STATS_COLOUR.neutralGrey)
    expect(bowlerWicketColour('NOT_ITEMISED')).toBe(STATS_COLOUR.neutralGrey)
  })

  it('makes every known bowler wicket type a good tone except the unknown remainder', () => {
    expect(bowlerWicketColour('BOWLED')).toBe(STATS_COLOUR.good)
    expect(bowlerWicketColour('LBW')).toBe(STATS_COLOUR.wicketBlue)
    for (const type of Object.keys(BOWLER_WICKET_COLOUR)) expect(Object.values(STATS_COLOUR)).toContain(bowlerWicketColour(type))
    for (const type of Object.keys(BATTER_DISMISSAL_COLOUR)) expect(Object.values(STATS_COLOUR)).toContain(batterDismissalColour(type))
  })
})
