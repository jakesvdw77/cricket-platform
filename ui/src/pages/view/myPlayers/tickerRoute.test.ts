import { describe, expect, it } from 'vitest'
import { drawTickerSeed, tickerRoute } from './tickerRoute'

// docs/specs/146 section 8: where the ticker is shown and hidden, read from the address.
describe('tickerRoute', () => {
  it('reads the player and the section of a Hub page', () => {
    expect(tickerRoute('/account/players/k1')).toEqual({ playerKey: 'k1', routeKey: '', visible: true })
    expect(tickerRoute('/account/players/k1/availability')).toEqual({ playerKey: 'k1', routeKey: 'availability', visible: true })
    expect(tickerRoute('/account/players/k1/results/m9')).toMatchObject({ playerKey: 'k1', routeKey: 'results', visible: true })
    expect(tickerRoute('/account/players/k1/schedule/matches/m1')).toMatchObject({ visible: true })
  })

  it('has no player on the chooser, Find Players, Welcome, Account and Preferences', () => {
    for (const path of ['/account', '/account/options', '/account/preferences', '/welcome', '/choose-profile', '/account/invitations']) {
      expect(tickerRoute(path)).toMatchObject({ playerKey: null, visible: false })
    }
  })

  it('is hidden on Watch Live and on an edit sub-view', () => {
    expect(tickerRoute('/account/players/k1/schedule/matches/m1/watch').visible).toBe(false)
    expect(tickerRoute('/account/players/k1/profile/contact/edit').visible).toBe(false)
    expect(tickerRoute('/account/players/k1/profile/contact/edit-card').visible).toBe(false)
    expect(tickerRoute('/account/players/k1/profile/agents/edit').visible).toBe(false)
    expect(tickerRoute('/account/players/k1/profile/agents/leave').visible).toBe(false)
    expect(tickerRoute('/account/players/k1/profile/contact').visible).toBe(true)
  })
})

describe('drawTickerSeed', () => {
  it('differs from draw to draw and by section', () => {
    expect(drawTickerSeed('results')).not.toBe(drawTickerSeed('results'))
    expect(drawTickerSeed('a')).toBeTypeOf('number')
  })
})
