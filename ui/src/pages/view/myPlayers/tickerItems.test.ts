import { describe, expect, it } from 'vitest'
import { ctx, NOW, pollRow, resultRow } from '../../../test/tickerFixtures'
import { matchList, summary } from '../../../test/hubMatchFixtures'
import { buildTickerItems } from './tickerItems'
import { partsText } from './tickerText'
import type { TickerItem } from './tickerTypes'
import { liveSource } from './tickerSources/liveSource'
import { closesPhrase, pollsSource } from './tickerSources/pollsSource'
import { resultsSource } from './tickerSources/resultsSource'
import { upcomingSource } from './tickerSources/upcomingSource'

// docs/specs/146 section 3: each source, the privacy rules and the copy rules. Time is fixed: Saturday 7 November 2026, 12:00 local.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute)
const dateOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const timeOf = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
const startsAt = (date: Date, over = {}) => summary({ matchId: 'u1', phase: 'UPCOMING', date: dateOf(date), time: timeOf(date), home: { name: 'Villagers' }, away: { name: 'Eagles' }, venue: 'Main Oval', ...over })
const tail = (entry: TickerItem) => entry.parts.filter((part) => part.type === 'muted').map((part) => part.text).join(' ')

describe('resultsSource', () => {
  it('turns a result into a Result item that links to the Hub Result page', () => {
    const [entry] = resultsSource(ctx({ results: [resultRow()] }))
    expect(entry).toMatchObject({ kind: 'result', id: 'r1', to: '/account/players/k1/results/r1', weight: 3 })
    expect(partsText(entry.parts)).toBe('Villagers beat Rovers by 24 runs, Over 40, Thu')
    expect(entry.parts.filter((part) => part.type === 'strong').map((part) => part.text)).toEqual(['Villagers', 'Rovers'])
    expect(entry.label).toBe('Villagers beat Rovers by 24 runs, Over 40, Thursday')
  })

  it('calls a friendly Friendly and falls back to the team names when there is no result line', () => {
    const [entry] = resultsSource(ctx({ results: [resultRow({ competition: 'FRIENDLY', leagueName: null, resultLine: null })] }))
    expect(partsText(entry.parts)).toBe('Villagers v Rovers, Won, Friendly, Thu')
  })

  it('drops a result older than 14 days and keeps at most 5, newest first', () => {
    const rows = [
      resultRow({ matchId: 'old', matchDate: '2026-10-20' }),
      ...['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((matchDate, index) => resultRow({ matchId: `r${index}`, matchDate })),
    ]
    const out = resultsSource(ctx({ results: rows }))
    expect(out.map((entry) => entry.id)).toEqual(['r5', 'r4', 'r3', 'r2', 'r1'])
  })

  it('shows only what the read returned: nothing without results', () => {
    expect(resultsSource(ctx())).toEqual([])
    expect(resultsSource(ctx({ results: [] }))).toEqual([])
  })
})

describe('liveSource', () => {
  it('pins a live match with the elapsed label and no score', () => {
    const [entry] = liveSource(ctx({ matches: matchList({ live: [summary({ matchId: 'l1', phase: 'LIVE', home: { name: 'Villagers' }, away: { name: 'Rovers' }, startedAt: at(7, 10, 40).toISOString(), hasLiveScore: true })] }) }))
    expect(entry).toMatchObject({ kind: 'live', id: 'l1', pinned: true, to: '/account/players/k1/schedule/matches/l1', weight: 5 })
    expect(entry.parts).toEqual([{ type: 'strong', text: 'Villagers v Rovers' }, { type: 'muted', text: 'Started 1h 20m ago' }])
  })

  it('takes at most 3 and ignores a row that is not live', () => {
    const rows = ['a', 'b', 'c', 'd'].map((matchId) => summary({ matchId, phase: 'LIVE' }))
    expect(liveSource(ctx({ matches: matchList({ live: [...rows, summary({ matchId: 'x', phase: 'UPCOMING' })] }) }))).toHaveLength(3)
  })
})

describe('upcomingSource', () => {
  it('shows a day and time with a day count outside 24 hours', () => {
    const [entry] = upcomingSource(ctx({ matches: matchList({ upcoming: [startsAt(at(9, 14))] }) }))
    expect(entry).toMatchObject({ kind: 'upcoming', id: 'u1', to: '/account/players/k1/schedule/matches/u1' })
    expect(partsText(entry.parts)).toBe('Mon 14:00 Villagers v Eagles, Main Oval, starts in 2 days')
  })

  it('reads as a countdown inside 24 hours and changes form at the boundary', () => {
    const start = at(8, 12) // exactly 24 hours after NOW
    const before = upcomingSource(ctx({ now: new Date(start.getTime() - 24 * 3_600_000 + 60_000), matches: matchList({ upcoming: [startsAt(start)] }) }))
    expect(tail(before[0])).toBe('Main Oval, starts in 23h 59m')
    const at24 = upcomingSource(ctx({ now: new Date(start.getTime() - 24 * 3_600_000), matches: matchList({ upcoming: [startsAt(start)] }) }))
    expect(tail(at24[0])).toBe('Main Oval, starts tomorrow')
    const soon = upcomingSource(ctx({ matches: matchList({ upcoming: [startsAt(at(7, 15, 10)), startsAt(at(7, 12, 45), { matchId: 'u2' })] }) }))
    expect(soon.map(tail)).toEqual(['Main Oval, starts in 45m', 'Main Oval, starts in 3h 10m'])
  })

  it('limits to 3 matches within 7 days, soonest first, and leaves a started match out', () => {
    const rows = [at(13, 10), at(9, 10), at(8, 10), at(7, 18), at(7, 11)].map((date, index) => startsAt(date, { matchId: `u${index}` }))
    const out = upcomingSource(ctx({ matches: matchList({ upcoming: [...rows, startsAt(at(20, 10), { matchId: 'far' })] }) }))
    expect(out.map((entry) => entry.id)).toEqual(['u3', 'u2', 'u1'])
  })

  it('has a countdown label of days only when the match has no time', () => {
    const [entry] = upcomingSource(ctx({ matches: matchList({ upcoming: [startsAt(at(7, 12), { time: null })] }) }))
    expect(tail(entry)).toBe('Main Oval, starts today')
  })

  it('carries the kickoff as expiresAt, and the builder drops it once it has started', () => {
    const start = at(7, 12, 30)
    const matches = matchList({ upcoming: [startsAt(start)] })
    expect(upcomingSource(ctx({ matches }))[0].expiresAt).toBe(start.toISOString())
    expect(buildTickerItems(ctx({ matches }))).toHaveLength(1)
    expect(buildTickerItems(ctx({ matches, now: at(7, 12, 30) }))).toHaveLength(0)
  })
})

describe('pollsSource', () => {
  it('shows an unanswered open poll closing within 48 hours', () => {
    const [entry] = pollsSource(ctx({ polls: [pollRow()] }))
    expect(entry).toMatchObject({ kind: 'poll', id: 'p1', to: '/account/players/k1/availability', weight: 2 })
    expect(partsText(entry.parts)).toBe('Availability for Saturday closes tonight')
  })

  it('leaves out a poll the held player answered, one closing after 48 hours, and one already closed', () => {
    const polls = [
      pollRow({ pollId: 'answered', answers: [{ windowId: null, status: 'AVAILABLE' }] }),
      pollRow({ pollId: 'late', scheduledCloseAt: at(10, 13).toISOString() }),
      pollRow({ pollId: 'closed', scheduledCloseAt: at(7, 11).toISOString() }),
      pollRow({ pollId: 'none', scheduledCloseAt: null }),
      pollRow({ pollId: 'ok', scheduledCloseAt: at(9, 11).toISOString() }),
    ]
    expect(pollsSource(ctx({ polls })).map((entry) => entry.id)).toEqual(['ok'])
  })

  it('counts a group poll as answered only when every open window has an answer', () => {
    const windows = [{ windowId: 'w1', windowDate: '2026-11-14', dayPart: 'AM', open: true, matches: [] }, { windowId: 'w2', windowDate: '2026-11-15', dayPart: 'AM', open: true, matches: [] }] as never
    const partly = pollRow({ pollId: 'g1', kind: 'GROUP', windows, answers: [{ windowId: 'w1', status: 'AVAILABLE' }] })
    const fully = pollRow({ pollId: 'g2', kind: 'GROUP', windows, answers: [{ windowId: 'w1', status: 'AVAILABLE' }, { windowId: 'w2', status: 'UNAVAILABLE' }] })
    expect(pollsSource(ctx({ polls: [partly, fully] })).map((entry) => entry.id)).toEqual(['g1'])
  })

  it('takes at most 3, soonest closing first', () => {
    const polls = [20, 18, 16, 14].map((hour, index) => pollRow({ pollId: `p${index}`, scheduledCloseAt: at(7, hour).toISOString() }))
    expect(pollsSource(ctx({ polls })).map((entry) => entry.id)).toEqual(['p3', 'p2', 'p1'])
  })

  it('words the close time', () => {
    expect(closesPhrase(at(7, 12, 45), NOW)).toBe('in 45m')
    expect(closesPhrase(at(7, 17, 10), NOW)).toBe('in 5h 10m')
    expect(closesPhrase(at(7, 20), NOW)).toBe('tonight')
    expect(closesPhrase(at(8, 18), NOW)).toBe('tomorrow 18:00')
    expect(closesPhrase(at(9, 9), NOW)).toBe('Mon 09:00')
  })
})

describe('buildTickerItems', () => {
  const everything = ctx({
    results: [resultRow()],
    matches: matchList({ live: [summary({ matchId: 'l1', phase: 'LIVE', startedAt: at(7, 11).toISOString() })], upcoming: [startsAt(at(9, 14))] }),
    polls: [pollRow()],
  })

  it('composes the four built kinds', () => {
    expect(buildTickerItems(everything).map((entry) => entry.kind).sort()).toEqual(['live', 'poll', 'result', 'upcoming'])
  })

  it('returns nothing while the reads are loading or failed (undefined)', () => {
    expect(buildTickerItems(ctx())).toEqual([])
  })

  it('drops an item whose expiresAt has passed, without a refetch', () => {
    const polls = [pollRow({ scheduledCloseAt: at(7, 13).toISOString() })]
    expect(buildTickerItems(ctx({ polls }))).toHaveLength(1)
    expect(buildTickerItems(ctx({ polls, now: at(7, 13, 1) }))).toHaveLength(0)
  })

  it('never says "you" or "your" in item text', () => {
    for (const entry of buildTickerItems(everything)) {
      expect(partsText(entry.parts)).not.toMatch(/\byou(r|rs)?\b/i)
      expect(entry.label ?? '').not.toMatch(/\byou(r|rs)?\b/i)
    }
  })

  it('links to the exact paths, all under the route player', () => {
    const links = Object.fromEntries(buildTickerItems(everything).map((entry) => [entry.kind, entry.to]))
    expect(links).toEqual({
      result: '/account/players/k1/results/r1',
      live: '/account/players/k1/schedule/matches/l1',
      upcoming: '/account/players/k1/schedule/matches/u1',
      poll: '/account/players/k1/availability',
    })
  })

  it('reads only the context it is given: two players, each sees only their own items', () => {
    const mine = ctx({ playerKey: 'k1', results: [resultRow({ matchId: 'mine' })], polls: [pollRow({ pollId: 'pm' })] })
    const theirs = ctx({ playerKey: 'k2', results: [resultRow({ matchId: 'theirs' })], polls: [pollRow({ pollId: 'pt' })] })
    const first = buildTickerItems(mine)
    const second = buildTickerItems(theirs)
    expect(first.map((entry) => entry.id).sort()).toEqual(['mine', 'pm'])
    expect(second.map((entry) => entry.id).sort()).toEqual(['pt', 'theirs'])
    expect(first.every((entry) => entry.to?.startsWith('/account/players/k1/'))).toBe(true)
    expect(second.every((entry) => entry.to?.startsWith('/account/players/k2/'))).toBe(true)
  })
})
