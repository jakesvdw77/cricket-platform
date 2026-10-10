import { describe, expect, it } from 'vitest'
import {
  formatSeasonRange,
  localToday,
  seasonBadge,
  seasonLength,
  seasonProgress,
  seasonStatus,
  seasonTimeStrip,
} from './seasonStatus'

function season(startDate: string, endDate: string, active = true) {
  return { startDate, endDate, active }
}

const TODAY = '2026-10-10'

describe('localToday', () => {
  it('uses the local calendar date, not the UTC one', () => {
    // 00:30 local on 10 Oct is still 10 Oct locally, whatever the UTC date is.
    expect(localToday(new Date(2026, 9, 10, 0, 30))).toBe('2026-10-10')
    expect(localToday(new Date(2026, 9, 10, 23, 59))).toBe('2026-10-10')
    expect(localToday(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('seasonStatus', () => {
  it('is current when today is inside the range', () => {
    expect(seasonStatus(season('2026-09-01', '2027-03-31'), TODAY)).toBe('current')
  })

  it('is upcoming when it starts after today and past when it ended before today', () => {
    expect(seasonStatus(season('2026-11-01', '2027-03-31'), TODAY)).toBe('upcoming')
    expect(seasonStatus(season('2025-09-01', '2026-03-31'), TODAY)).toBe('past')
  })

  it('treats the first and last day as current (boundary days)', () => {
    expect(seasonStatus(season(TODAY, '2027-03-31'), TODAY)).toBe('current')
    expect(seasonStatus(season('2026-04-01', TODAY), TODAY)).toBe('current')
    expect(seasonStatus(season('2026-10-11', '2027-03-31'), TODAY)).toBe('upcoming')
    expect(seasonStatus(season('2026-04-01', '2026-10-09'), TODAY)).toBe('past')
  })

  it('is current for a one-day season on that day', () => {
    expect(seasonStatus(season(TODAY, TODAY), TODAY)).toBe('current')
  })

  it('calls an inactive season inactive, never current, even when it contains today', () => {
    expect(seasonStatus(season('2026-09-01', '2027-03-31', false), TODAY)).toBe('inactive')
    expect(seasonStatus(season('2025-09-01', '2026-03-31', false), TODAY)).toBe('inactive')
    expect(seasonStatus(season('2026-11-01', '2027-03-31', false), TODAY)).toBe('inactive')
  })

  it('calls two active seasons that both contain today both current', () => {
    expect(seasonStatus(season('2026-01-01', '2026-12-31'), TODAY)).toBe('current')
    expect(seasonStatus(season('2026-09-01', '2027-03-31'), TODAY)).toBe('current')
  })
})

describe('seasonBadge', () => {
  it('maps each status to one badge', () => {
    expect(seasonBadge(season('2026-09-01', '2027-03-31'), TODAY)).toEqual({ label: 'Current', tone: 'positive' })
    expect(seasonBadge(season('2026-11-01', '2027-03-31'), TODAY)).toEqual({ label: 'Upcoming', tone: 'neutral' })
    expect(seasonBadge(season('2025-09-01', '2026-03-31'), TODAY)).toEqual({ label: 'Past', tone: 'muted' })
    expect(seasonBadge(season('2026-09-01', '2027-03-31', false), TODAY)).toEqual({ label: 'Inactive', tone: 'muted' })
  })
})

describe('formatSeasonRange', () => {
  it('writes the range in UK style with "to" and no leading zero', () => {
    expect(formatSeasonRange(season('2026-09-01', '2027-03-31'))).toBe('1 Sep 2026 to 31 Mar 2027')
    expect(formatSeasonRange(season('2026-01-05', '2026-12-31'))).toBe('5 Jan 2026 to 31 Dec 2026')
  })
})

describe('seasonLength', () => {
  it('is whole calendar months when a month or more', () => {
    expect(seasonLength(season('2026-09-01', '2027-03-31'))).toBe('7 months')
    expect(seasonLength(season('2026-03-01', '2026-03-31'))).toBe('1 month')
    expect(seasonLength(season('2026-01-01', '2026-12-31'))).toBe('12 months')
  })

  it('rounds a part month to the nearest month', () => {
    expect(seasonLength(season('2026-09-01', '2027-03-14'))).toBe('6 months')
    expect(seasonLength(season('2026-09-01', '2027-03-20'))).toBe('7 months')
  })

  it('is weeks from 14 days up to a month, and days below that', () => {
    expect(seasonLength(season('2026-10-01', '2026-10-21'))).toBe('3 weeks')
    expect(seasonLength(season('2026-10-01', '2026-10-14'))).toBe('2 weeks')
    expect(seasonLength(season('2026-10-01', '2026-10-12'))).toBe('12 days')
    expect(seasonLength(season('2026-10-01', '2026-10-01'))).toBe('1 day')
  })
})

describe('seasonTimeStrip', () => {
  it('says how long a current season has left', () => {
    const result = seasonTimeStrip(season('2026-09-01', '2026-11-20'), TODAY)
    expect(result.text).toBe('Ends in 41 days')
    expect(result.label).toBe('Ends in')
    expect(result.value).toBe('41 days')
    expect(result.tone).toBe('neutral')
  })

  it('says how long until an upcoming season starts', () => {
    expect(seasonTimeStrip(season('2026-10-22', '2027-03-31'), TODAY).text).toBe('Starts in 12 days')
  })

  it('says how long ago a past season ended', () => {
    expect(seasonTimeStrip(season('2025-09-01', '2026-07-10'), TODAY)).toMatchObject({ text: 'Ended 3 months ago', tone: 'neutral' })
    expect(seasonTimeStrip(season('2025-09-01', '2026-10-09'), TODAY).text).toBe('Ended 1 day ago')
    expect(seasonTimeStrip(season('2024-09-01', '2025-03-31'), TODAY).text).toBe('Ended 1 year ago')
    expect(seasonTimeStrip(season('2026-01-01', '2026-09-05'), TODAY).text).toBe('Ended 5 weeks ago')
  })

  it('uses the singular for one day', () => {
    expect(seasonTimeStrip(season('2026-10-11', '2027-03-31'), TODAY).text).toBe('Starts in 1 day')
    expect(seasonTimeStrip(season('2026-09-01', '2026-10-11'), TODAY).text).toBe('Ends in 1 day')
  })

  it('reads "Ends today" for a season ending today, amber', () => {
    expect(seasonTimeStrip(season('2026-04-01', TODAY), TODAY)).toMatchObject({ text: 'Ends today', tone: 'warning' })
  })

  it('goes amber within 7 days of starting or ending, and not at 8', () => {
    expect(seasonTimeStrip(season('2026-10-17', '2027-03-31'), TODAY).tone).toBe('warning')
    expect(seasonTimeStrip(season('2026-10-18', '2027-03-31'), TODAY).tone).toBe('neutral')
    expect(seasonTimeStrip(season('2026-04-01', '2026-10-17'), TODAY).tone).toBe('warning')
    expect(seasonTimeStrip(season('2026-04-01', '2026-10-18'), TODAY).tone).toBe('neutral')
  })

  it('starting today is current and shows the time left', () => {
    expect(seasonTimeStrip(season(TODAY, '2027-03-31'), TODAY).text).toBe('Ends in 6 months')
  })

  it('reads an inactive season by its dates but never amber', () => {
    expect(seasonTimeStrip(season('2026-10-12', '2027-03-31', false), TODAY)).toMatchObject({ text: 'Starts in 2 days', tone: 'neutral' })
    expect(seasonTimeStrip(season('2026-04-01', TODAY, false), TODAY)).toMatchObject({ text: 'Ends today', tone: 'neutral' })
  })
})

describe('seasonProgress', () => {
  it('counts the day number and total days of the current season', () => {
    expect(seasonProgress(season('2026-10-01', '2026-10-31'), TODAY)).toEqual({ dayNumber: 10, totalDays: 31 })
  })

  it('is day 1 on the first day and the last day on the final day', () => {
    expect(seasonProgress(season(TODAY, '2026-10-19'), TODAY)).toEqual({ dayNumber: 1, totalDays: 10 })
    expect(seasonProgress(season('2026-10-01', TODAY), TODAY)).toEqual({ dayNumber: 10, totalDays: 10 })
  })

  it('is null unless the season is current', () => {
    expect(seasonProgress(season('2026-11-01', '2027-03-31'), TODAY)).toBeNull()
    expect(seasonProgress(season('2025-09-01', '2026-03-31'), TODAY)).toBeNull()
    expect(seasonProgress(season('2026-09-01', '2027-03-31', false), TODAY)).toBeNull()
  })
})
