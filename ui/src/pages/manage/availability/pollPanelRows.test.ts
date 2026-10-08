import { describe, expect, it } from 'vitest'
import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { SectionAvailabilityRound } from '../../../api/sectionAvailabilityApi'
import { answeredText, closesWithin48Hours, groupPollRow, pollsPanelHeader, sortPollRows, squadPollRow } from './pollPanelRows'
import type { PollPanelRow } from './pollPanelRows'

const NOW = new Date('2026-06-01T10:00:00Z').getTime()
const at = (hours: number, extraMs = 0) => new Date(NOW + hours * 3_600_000 + extraMs).toISOString()

function row(overrides: Partial<PollPanelRow> = {}): PollPanelRow {
  return { key: 'k', kind: 'SQUAD', title: 'T', open: true, autoClose: true, scheduledCloseAt: at(10), answered: 1, total: 2, path: '/p', ...overrides }
}

describe('closesWithin48Hours', () => {
  it('is true for an open auto-closing poll closing in (now, now + 48 h], boundary included', () => {
    expect(closesWithin48Hours(row({ scheduledCloseAt: at(10) }), NOW)).toBe(true)
    expect(closesWithin48Hours(row({ scheduledCloseAt: at(48) }), NOW)).toBe(true)
    expect(closesWithin48Hours(row({ scheduledCloseAt: at(48, 1000) }), NOW)).toBe(false)
    expect(closesWithin48Hours(row({ scheduledCloseAt: at(-1) }), NOW)).toBe(false)
  })

  it('is false for a closed poll, a manual poll and one without a close time', () => {
    expect(closesWithin48Hours(row({ open: false }), NOW)).toBe(false)
    expect(closesWithin48Hours(row({ autoClose: false }), NOW)).toBe(false)
    expect(closesWithin48Hours(row({ scheduledCloseAt: null }), NOW)).toBe(false)
  })
})

describe('sortPollRows', () => {
  it('puts open polls first by soonest close (no close time last), then closed polls, latest closed first', () => {
    const sorted = sortPollRows([
      row({ key: 'closed-old', open: false, scheduledCloseAt: at(-50) }),
      row({ key: 'late', scheduledCloseAt: at(100) }),
      row({ key: 'manual', title: 'Z', autoClose: false, scheduledCloseAt: null }),
      row({ key: 'closed-new', open: false, scheduledCloseAt: at(-5) }),
      row({ key: 'soon', scheduledCloseAt: at(3) }),
    ])
    expect(sorted.map((r) => r.key)).toEqual(['soon', 'late', 'manual', 'closed-new', 'closed-old'])
  })

  it('does not change its input', () => {
    const input = [row({ key: 'b', scheduledCloseAt: at(9) }), row({ key: 'a', scheduledCloseAt: at(1) })]
    sortPollRows(input)
    expect(input.map((r) => r.key)).toEqual(['b', 'a'])
  })
})

describe('pollsPanelHeader', () => {
  const rows = [row({ open: true }), row({ open: true }), row({ open: false })]
  it('spells out open and closed for Polls shown', () => {
    expect(pollsPanelHeader('all', rows, true)).toBe('3 polls shown, 2 open and 1 closed')
    expect(pollsPanelHeader('all', [row({ open: false })], true)).toBe('1 poll shown, 0 open and 1 closed')
  })
  it('counts the open polls when Show closed is off', () => {
    expect(pollsPanelHeader('all', [row(), row()], false)).toBe('2 open polls')
    expect(pollsPanelHeader('all', [row()], false)).toBe('1 open poll')
  })
  it('names the 48-hour scope', () => {
    expect(pollsPanelHeader('closing-soon', [row()], false)).toBe('1 open poll closing within 48 hours')
    expect(pollsPanelHeader('closing-soon', [], false)).toBe('0 open polls closing within 48 hours')
  })
})

describe('row builders', () => {
  it('builds a squad row with the title, route and N of M answered', () => {
    const poll = {
      pollId: 'p1', matchId: 'm1', teamId: 't', homeTeamId: null, homeTeamName: 'Lions', awayTeamId: null, awayTeamName: 'Rivals',
      autoClose: true, scheduledCloseAt: at(5), availableCount: 4, unsureCount: 1, unavailableCount: 2, noResponseCount: 3,
    } as OpenAvailabilityPoll
    const built = squadPollRow(poll, true, new Map())
    expect(built).toMatchObject({ kind: 'SQUAD', title: 'Lions vs Rivals', open: true, answered: 7, total: 10, path: '/manage/availability/squad/m1/p1' })
  })

  it('builds a group row, reporting its best-answered slot', () => {
    const round = {
      id: 'r1', description: 'Thursday fixtures', open: false, autoClose: false, scheduledCloseAt: null,
      brackets: [
        { availableCount: 2, unsureCount: 0, unavailableCount: 0, noResponseCount: 8 },
        { availableCount: 5, unsureCount: 1, unavailableCount: 1, noResponseCount: 3 },
      ],
    } as SectionAvailabilityRound
    expect(groupPollRow(round)).toMatchObject({ kind: 'GROUP', title: 'Thursday fixtures', open: false, answered: 7, total: 10, path: '/manage/availability/group/r1' })
  })

  it('marks a multi-slot group row as best slot and a single-slot or squad row as exact', () => {
    const slot = { availableCount: 1, unsureCount: 0, unavailableCount: 0, noResponseCount: 1 }
    const base = { id: 'r', description: 'D', open: true, autoClose: false, scheduledCloseAt: null }
    expect(answeredText(groupPollRow({ ...base, brackets: [slot, slot] } as unknown as SectionAvailabilityRound))).toBe('1 of 2 answered (best slot)')
    expect(answeredText(groupPollRow({ ...base, brackets: [slot] } as unknown as SectionAvailabilityRound))).toBe('1 of 2 answered')
  })

  it('has no figure for a round with no slots or nobody to count', () => {
    const round = { id: 'r', description: 'D', open: true, autoClose: false, scheduledCloseAt: null, brackets: [] } as unknown as SectionAvailabilityRound
    expect(groupPollRow(round)).toMatchObject({ answered: 0, total: 0 })
    expect(answeredText(groupPollRow(round))).toBeNull()
  })
})
