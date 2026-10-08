import { describe, expect, it } from 'vitest'
import type {
  SectionAvailabilityRoundBracket,
  SectionAvailabilityRoundMatch,
} from '../../../../api/sectionAvailabilityApi'
import {
  answeredCoverage,
  filterByStatus,
  sortPlayerRows,
  statusCountsForSlot,
  filterPlayers,
  groupBySlot,
  hasAnyAnswer,
  playerName,
  slotHeading,
  sortPlayers,
  STATUS_ORDER,
} from './responseHelpers'
import type { ResponseRow } from './responseHelpers'
import { formatBracketLabel } from '../../../../utils/dayPart'

function bracket(windowId: string, windowDate: string, dayPart: 'MORNING' | 'AFTERNOON'): SectionAvailabilityRoundBracket {
  return { windowId, windowDate, dayPart, availableCount: 0, unavailableCount: 0, unsureCount: 0, noResponseCount: 0, coveredMatchCount: 0 }
}

function row(id: string, firstName: string, lastName: string, statuses: Array<'AVAILABLE' | 'UNAVAILABLE' | 'UNSURE' | null>): ResponseRow {
  const windows = ['w1', 'w2']
  return {
    playerProfileId: id,
    firstName,
    lastName,
    jerseyNumber: null,
    statuses: statuses.map((status, index) => ({
      windowId: windows[index],
      dayPart: index === 0 ? 'MORNING' : 'AFTERNOON',
      windowDate: '2026-10-03',
      status,
    })),
  }
}

const matches: SectionAvailabilityRoundMatch[] = [
  { matchId: 'm2', teamId: 't', teamName: 'A', opponentLabel: 'X', matchDate: '2026-10-03T11:00:00Z', venue: null, leagueName: null, dayPart: 'MORNING', windowId: 'w1' },
  { matchId: 'm1', teamId: 't', teamName: 'A', opponentLabel: 'Y', matchDate: '2026-10-03T08:00:00Z', venue: null, leagueName: null, dayPart: 'MORNING', windowId: 'w1' },
  { matchId: 'm3', teamId: 't', teamName: 'B', opponentLabel: 'Z', matchDate: '2026-10-03T14:00:00Z', venue: null, leagueName: null, dayPart: 'AFTERNOON', windowId: 'w2' },
]

const rows = [
  row('p1', 'Jane', 'Smith', ['AVAILABLE', 'UNAVAILABLE']),
  row('p2', 'Bob', 'Jones', ['UNSURE', null]),
  row('p3', 'Amy', 'Lee', [null, null]),
]

describe('responseHelpers', () => {
  it('orders statuses Available, Unsure, Unavailable', () => {
    expect(STATUS_ORDER).toEqual(['AVAILABLE', 'UNSURE', 'UNAVAILABLE'])
  })

  it('formats the slot heading with a dot separator', () => {
    const heading = slotHeading(bracket('w1', '2026-10-03', 'MORNING'))
    expect(heading).toContain('·')
    expect(heading.endsWith('Morning')).toBe(true)
    expect(heading).toBe(formatBracketLabel('2026-10-03', 'MORNING', ' · '))
  })

  it('groups players per slot, so one player can sit in different groups in different slots', () => {
    const slots = groupBySlot({ brackets: [bracket('w1', '2026-10-03', 'MORNING'), bracket('w2', '2026-10-03', 'AFTERNOON')], responses: rows }, matches)

    expect(slots[0].available.map(playerName)).toEqual(['Jane Smith'])
    expect(slots[0].unsure.map(playerName)).toEqual(['Bob Jones'])
    expect(slots[0].noResponse.map(playerName)).toEqual(['Amy Lee'])
    expect(slots[1].unavailable.map(playerName)).toEqual(['Jane Smith'])
    expect(slots[1].noResponse.map(playerName)).toEqual(['Bob Jones', 'Amy Lee'])
  })

  it('orders slots by date then Morning before Afternoon and sorts each slot\'s matches by time', () => {
    const slots = groupBySlot(
      {
        brackets: [bracket('w2', '2026-10-03', 'AFTERNOON'), bracket('w3', '2026-10-04', 'MORNING'), bracket('w1', '2026-10-03', 'MORNING')],
        responses: [],
      },
      matches,
    )

    expect(slots.map((slot) => slot.bracket.windowId)).toEqual(['w1', 'w2', 'w3'])
    expect(slots[0].matches.map((match) => match.matchId)).toEqual(['m1', 'm2'])
  })

  it('filters by first or last name, case-insensitively, and keeps everyone for a blank query', () => {
    expect(filterPlayers(rows, 'JAN').map(playerName)).toEqual(['Jane Smith'])
    expect(filterPlayers(rows, 'jones').map(playerName)).toEqual(['Bob Jones'])
    expect(filterPlayers(rows, '  ')).toHaveLength(3)
    expect(filterPlayers(rows, 'zzz')).toHaveLength(0)
  })

  it('detects a player with no answer in any slot', () => {
    expect(rows.filter(hasAnyAnswer).map(playerName)).toEqual(['Jane Smith', 'Bob Jones'])
  })

  it('sorts players by last then first name', () => {
    expect(sortPlayers(rows).map(playerName)).toEqual(['Bob Jones', 'Amy Lee', 'Jane Smith'])
  })

  describe('answeredCoverage (085)', () => {
    const two = [bracket('w1', '2026-10-03', 'MORNING'), bracket('w2', '2026-10-03', 'AFTERNOON')]

    it('counts players who answered every slot, some slots and none', () => {
      expect(answeredCoverage(rows, two)).toEqual({ all: 1, some: 1, none: 1 })
    })

    it('ignores answers for windows that are not in the brackets and null answers', () => {
      const stray: ResponseRow = {
        ...row('p4', 'Stray', 'Answer', ['AVAILABLE', null]),
        statuses: [
          { windowId: 'other', dayPart: 'MORNING', windowDate: '2026-10-03', status: 'AVAILABLE' },
          { windowId: 'w1', dayPart: 'MORNING', windowDate: '2026-10-03', status: 'AVAILABLE' },
          { windowId: 'w2', dayPart: 'AFTERNOON', windowDate: '2026-10-03', status: null },
        ],
      }
      expect(answeredCoverage([stray], two)).toEqual({ all: 0, some: 1, none: 0 })
    })

    it('with a single slot a player either answered it or not', () => {
      expect(answeredCoverage(rows, [two[0]])).toEqual({ all: 2, some: 0, none: 1 })
    })

    it('is empty for no rows', () => {
      expect(answeredCoverage([], two)).toEqual({ all: 0, some: 0, none: 0 })
    })
  })

  describe('Player tab chips and sorting (085 J)', () => {
    // w1: Jane AVAILABLE, Bob UNSURE, Amy none; w2: Jane UNAVAILABLE, Bob none, Amy none.
    it('counts every answer of one slot over all players', () => {
      expect(statusCountsForSlot(rows, 'w1')).toEqual({ all: 3, AVAILABLE: 1, UNSURE: 1, UNAVAILABLE: 0, NONE: 1 })
      expect(statusCountsForSlot(rows, 'w2')).toEqual({ all: 3, AVAILABLE: 0, UNSURE: 0, UNAVAILABLE: 1, NONE: 2 })
      expect(statusCountsForSlot([], 'w1')).toEqual({ all: 0, AVAILABLE: 0, UNSURE: 0, UNAVAILABLE: 0, NONE: 0 })
    })

    it('filters by the slot\'s answer, with No response meaning no answer, and null keeping everyone', () => {
      expect(filterByStatus(rows, 'w1', 'AVAILABLE').map(playerName)).toEqual(['Jane Smith'])
      expect(filterByStatus(rows, 'w2', 'NONE').map(playerName)).toEqual(['Bob Jones', 'Amy Lee'])
      expect(filterByStatus(rows, 'w1', null)).toBe(rows)
    })

    it('sorts by name A to Z by default and reversed', () => {
      expect(sortPlayerRows(rows, { key: 'player', direction: 'asc' }).map(playerName)).toEqual(['Bob Jones', 'Amy Lee', 'Jane Smith'])
      expect(sortPlayerRows(rows, { key: 'player', direction: 'desc' }).map(playerName)).toEqual(['Jane Smith', 'Amy Lee', 'Bob Jones'])
    })

    it('sorts by a slot\'s answer in the order Available, Unsure, Unavailable, No response, keeping name order within one answer', () => {
      expect(sortPlayerRows(rows, { key: 'status', windowId: 'w1', direction: 'asc' }).map(playerName)).toEqual(['Jane Smith', 'Bob Jones', 'Amy Lee'])
      expect(sortPlayerRows(rows, { key: 'status', windowId: 'w2', direction: 'asc' }).map(playerName)).toEqual(['Jane Smith', 'Bob Jones', 'Amy Lee'])
      expect(sortPlayerRows(rows, { key: 'status', windowId: 'w1', direction: 'desc' }).map(playerName)).toEqual(['Amy Lee', 'Bob Jones', 'Jane Smith'])
    })

    it('does not change its input', () => {
      const copy = [...rows]
      sortPlayerRows(rows, { key: 'status', windowId: 'w1', direction: 'desc' })
      expect(rows).toEqual(copy)
    })
  })
})
