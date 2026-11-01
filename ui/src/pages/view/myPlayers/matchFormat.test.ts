import { describe, expect, it } from 'vitest'
import { hubBack } from './hubNav'
import type { HubBackState } from './hubNav'
import { answerLabel, countdownLabel, elapsedLabel, leagueFrom, matchPath, parseFrom, recentResultLine, selectionLabel, statusBadgeLabel, watchPath, withinForecastDays } from './matchFormat'

// docs/specs/135: the pure match helpers and the footer Back of the match pages.
const NOW = new Date('2026-11-01T10:00:00')

describe('elapsedLabel', () => {
  it('reads whole minutes since the server\'s startedAt', () => {
    const at = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString()
    expect(elapsedLabel(at(80), NOW)).toBe('Started 1h 20m ago')
    expect(elapsedLabel(at(20), NOW)).toBe('Started 20m ago')
    expect(elapsedLabel(at(120), NOW)).toBe('Started 2h ago')
    expect(elapsedLabel(at(0.4), NOW)).toBe('Started just now')
    expect(elapsedLabel(at(-5), NOW)).toBe('Started just now')
  })

  it('is empty without a usable start', () => {
    expect(elapsedLabel(null, NOW)).toBe('')
    expect(elapsedLabel('nonsense', NOW)).toBe('')
  })
})

describe('countdownLabel', () => {
  it('counts calendar days: today, tomorrow, in N days', () => {
    expect(countdownLabel('2026-11-01', NOW)).toBe('today')
    expect(countdownLabel('2026-11-02', NOW)).toBe('tomorrow')
    expect(countdownLabel('2026-11-08', NOW)).toBe('in 7 days')
  })

  it('is empty for a day that has passed', () => {
    expect(countdownLabel('2026-10-31', NOW)).toBe('')
  })
})

describe('withinForecastDays', () => {
  it('is true from today to six days ahead only', () => {
    expect(withinForecastDays('2026-11-01', NOW)).toBe(true)
    expect(withinForecastDays('2026-11-07', NOW)).toBe(true)
    expect(withinForecastDays('2026-11-08', NOW)).toBe(false)
    expect(withinForecastDays('2026-10-31', NOW)).toBe(false)
  })
})

describe('labels', () => {
  it('names the selection states in Title Case', () => {
    expect(selectionLabel('SELECTED')).toBe('Selected')
    expect(selectionLabel('NOT_SELECTED')).toBe('Not Selected')
    expect(selectionLabel('SELECTED_TWELFTH')).toBe('Selected (12th)')
    expect(selectionLabel('NOT_ANNOUNCED')).toBe('Waiting For Team Announcement')
  })

  it('gives one status badge, with Result Pending for a past match without a result', () => {
    expect(statusBadgeLabel({ status: 'UPCOMING', phase: 'UPCOMING' })).toBe('Upcoming')
    expect(statusBadgeLabel({ status: 'UPCOMING', phase: 'RECENT' })).toBe('Result Pending')
    expect(statusBadgeLabel({ status: 'PLAYED', phase: 'RECENT' })).toBe('Played')
    expect(statusBadgeLabel({ status: 'CANCELLED', phase: 'RECENT' })).toBe('Cancelled')
    expect(statusBadgeLabel({ status: 'POSTPONED', phase: 'UPCOMING' })).toBe('Postponed')
  })

  it('words the answer and the recent result', () => {
    expect(answerLabel('AVAILABLE')).toBe('You said Yes.')
    expect(answerLabel(null)).toBe('No answer yet.')
    expect(recentResultLine({ result: null })).toBe('Result pending')
    expect(recentResultLine({ result: { homeScore: '1', awayScore: '2', resultLine: 'Home won' } })).toBe('Home won')
  })
})

describe('URLs', () => {
  it('builds and parses where a match page was opened from', () => {
    expect(matchPath('k1', 'm1')).toBe('/account/players/k1/schedule/matches/m1')
    expect(matchPath('k1', 'm1', leagueFrom('l1', 'results'))).toBe('/account/players/k1/schedule/matches/m1?from=league%3Al1%3Aresults')
    expect(watchPath('k1', 'm1', 'matches')).toBe('/account/players/k1/schedule/matches/m1/watch?from=matches')
    expect(parseFrom('league:l1')).toEqual({ kind: 'league', leagueId: 'l1', tab: 'schedule' })
    expect(parseFrom('league:l1:results')).toEqual({ kind: 'league', leagueId: 'l1', tab: 'results' })
    expect(parseFrom('https://evil.example')).toEqual({ kind: 'matches' })
    expect(parseFrom(null)).toEqual({ kind: 'matches' })
  })
})

describe('hubBack on the match pages', () => {
  const state = (overrides: Partial<HubBackState>): HubBackState => ({ playerKey: 'k1', layout: 'wide', many: true, section: 'schedule', item: 'matches', ...overrides })

  it('goes from the Matches list up as before', () => {
    expect(hubBack(state({ layout: 'phone' }))).toEqual({ label: 'Back to menu', target: '/account/players/k1' })
  })

  it('goes from a match to the Matches list, or to the league it was opened from, on every layout', () => {
    for (const layout of ['phone', 'wide'] as const) {
      expect(hubBack(state({ layout, view: 'm1' }))).toEqual({ label: 'Back to Matches', target: '/account/players/k1/schedule/matches' })
      expect(hubBack(state({ layout, view: 'm1', from: 'league:l1', fromLabel: 'Boland Under 15' }))).toEqual({ label: 'Back to Boland Under 15 schedule', target: '/account/players/k1/schedule/leagues/l1?tab=schedule' })
      expect(hubBack(state({ layout, view: 'm1', from: 'league:l1:results', fromLabel: 'Boland Under 15' }))).toEqual({ label: 'Back to Boland Under 15 results', target: '/account/players/k1/schedule/leagues/l1?tab=results' })
    }
  })

  it('goes from Watch Live to the match, keeping where it was opened from', () => {
    expect(hubBack(state({ view: 'm1', extra: 'watch', from: 'matches' }))).toEqual({ label: 'Back to Match', target: '/account/players/k1/schedule/matches/m1?from=matches' })
  })
})
