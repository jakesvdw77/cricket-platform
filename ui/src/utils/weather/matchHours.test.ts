import { describe, expect, it } from 'vitest'
import type { DailyForecast, HourSample } from '../../api/weatherApi'
import { hoursInWindow, matchHoursLines, matchWindowHours, summariseMatchHours } from './matchHours'

const hour = (h: number, patch: Partial<HourSample> = {}): HourSample => ({
  time: `2026-11-06T${String(h).padStart(2, '0')}:00`,
  temperature: 20,
  rainChance: 0,
  rainMm: 0,
  wind: 5,
  gusts: 10,
  humidity: 40,
  uv: 1,
  cloud: 50,
  ...patch,
})
const day = (patch: (h: number) => Partial<HourSample> = () => ({})): HourSample[] => Array.from({ length: 24 }, (_, h) => hour(h, patch(h)))
const forecast = (hours: HourSample[], sunset: string | null = null): DailyForecast => ({ date: '2026-11-06', code: 1, tempMax: 30, tempMin: 10, rainChance: 10, hours, sunset })

describe('matchWindowHours', () => {
  it('is 4 for T20, 8 for a one-day game and longer, else 6', () => {
    expect(matchWindowHours('T20')).toBe(4)
    expect(matchWindowHours('T50')).toBe(8)
    expect(matchWindowHours('ONE_DAY')).toBe(8)
    expect(matchWindowHours('T30')).toBe(6)
    expect(matchWindowHours(null)).toBe(6)
  })
})

describe('hoursInWindow', () => {
  it('runs from the start hour to start plus N hours, the end hour included on the hour', () => {
    const times = hoursInWindow(day(), '2026-11-06T09:00', 4).map((item) => item.time.slice(11))
    expect(times).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00'])
    expect(hoursInWindow(day(), '2026-11-06T09:30', 4)).toHaveLength(5)
  })
})

describe('summariseMatchHours', () => {
  it('gives the range of the match hours only', () => {
    const summary = summariseMatchHours(forecast(day((h) => ({ temperature: h, rainChance: h === 11 ? 39 : 4 }))), '2026-11-06T09:00', 4)
    expect(summary?.short).toBe('9-13 degrees, rain 4-39%')
  })
  it('says dry for a dry window and one temperature when they match', () => {
    expect(summariseMatchHours(forecast(day()), '2026-11-06T09:00', 4)?.short).toBe('20 degrees, dry')
  })
  it('gives nothing when fewer than two hours fall in the window or there are no hours', () => {
    expect(summariseMatchHours(forecast(day()), '2026-11-06T23:30', 4)).toBeNull()
    expect(summariseMatchHours({ ...forecast([]), hours: undefined }, '2026-11-06T09:00', 4)).toBeNull()
  })
})

describe('matchHoursLines', () => {
  const lines = (patch: (h: number) => Partial<HourSample>, sunset: string | null = null, start = '2026-11-06T09:00', n = 4) =>
    matchHoursLines(hoursInWindow(day(patch), start, n), sunset, start, n)

  it('reads dry for the whole match, or a small chance of showers', () => {
    expect(lines(() => ({}))[0]).toBe('Dry for the whole match')
    expect(lines(() => ({ rainChance: 25 }))[0]).toBe('Small chance of showers (up to 25%)')
  })
  it('says when the rain starts', () => {
    expect(lines((h) => ({ rainChance: h >= 11 ? 60 : 0 }))[0]).toBe('Dry until about 10:00, showers likely after 11:00')
    expect(lines(() => ({ rainChance: 60, rainMm: 3 }))[0]).toBe('Rain likely from the start. Heavy at times')
  })
  it('adds wind, heat, UV and sunset in priority order, four at most', () => {
    const all = lines((h) => ({ gusts: 45, temperature: 36, uv: h >= 11 ? 9 : 2 }), '2026-11-06T13:10')
    expect(all).toEqual(['Dry for the whole match', 'Windy: gusts up to 45 km/h', 'Very hot: 36 degrees, bring water and take drink breaks', 'Very high UV from 11:00, bring sunscreen'])
    expect(lines(() => ({ gusts: 32 }))[1]).toBe('Breezy: gusts up to 32 km/h')
    expect(lines(() => ({ temperature: 8 }))[1]).toBe('Cold: 8 degrees, bring a warm layer')
    expect(lines(() => ({}), '2026-11-06T13:10')[1]).toBe('Sunset 13:10')
    expect(lines(() => ({}), '2026-11-06T18:00')).not.toContain('Sunset 18:00')
  })
})
