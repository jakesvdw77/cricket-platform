import { describe, expect, it } from 'vitest'
import { toSquadResponsesModel } from './squadResponsesAdapter'
import { groupBySlot, slotHeading } from './responseHelpers'
import { dayPartForDate } from '../../../../utils/dayPart'
import type { Match } from '../../../../api/matchApi'
import type { MatchAvailabilityPollResponses } from '../../../../api/matchAvailabilityApi'
import type { Team } from '../../../../api/teamApi'

const MATCH_DATE = '2030-06-06T09:00:00Z'

const match = {
  id: 'match-1',
  homeTeamId: 'team-home',
  homeTeamName: null,
  awayTeamId: null,
  awayTeamName: 'Rivals CC',
  matchDate: MATCH_DATE,
  venue: 'Home Ground',
} as Match

const responses: MatchAvailabilityPollResponses = {
  pollId: 'poll-1',
  teamId: 'team-home',
  open: true,
  availableCount: 2,
  unavailableCount: 1,
  unsureCount: 0,
  noResponseCount: 1,
  responses: [
    { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', squadJerseyNumber: 7, status: 'AVAILABLE' },
    { playerProfileId: 'p2', firstName: 'Cal', lastName: 'Ng', squadJerseyNumber: null, status: null },
  ],
  publicPath: '/poll/poll-1',
}

const teamsById = new Map<string, Team>([['team-home', { id: 'team-home', name: 'Home Team' } as Team]])
const poll = { id: 'poll-1', teamId: 'team-home' }

describe('toSquadResponsesModel', () => {
  it('builds one bracket keyed by the poll id with the payload counts', () => {
    const { brackets } = toSquadResponsesModel({ responses, poll, match, teamsById })
    const dayPart = dayPartForDate(new Date(MATCH_DATE))

    expect(brackets).toEqual([
      {
        windowId: 'poll-1',
        windowDate: MATCH_DATE,
        dayPart,
        availableCount: 2,
        unavailableCount: 1,
        unsureCount: 0,
        noResponseCount: 1,
        coveredMatchCount: 1,
      },
    ])
  })

  it('maps each player to one status on that window, with the squad jersey number', () => {
    const { rows } = toSquadResponsesModel({ responses, poll, match, teamsById })
    const dayPart = dayPartForDate(new Date(MATCH_DATE))

    expect(rows).toEqual([
      { playerProfileId: 'p1', firstName: 'Jane', lastName: 'Smith', jerseyNumber: 7, statuses: [{ windowId: 'poll-1', dayPart, windowDate: MATCH_DATE, status: 'AVAILABLE' }] },
      { playerProfileId: 'p2', firstName: 'Cal', lastName: 'Ng', jerseyNumber: null, statuses: [{ windowId: 'poll-1', dayPart, windowDate: MATCH_DATE, status: null }] },
    ])
  })

  it('builds one synthetic match with the polled side as the team and the other as the opponent', () => {
    const { matches } = toSquadResponsesModel({ responses, poll, match, teamsById })

    expect(matches).toEqual([
      {
        matchId: 'match-1',
        teamId: 'team-home',
        teamName: 'Home Team',
        opponentLabel: 'Rivals CC',
        matchDate: MATCH_DATE,
        venue: 'Home Ground',
        leagueName: null,
        dayPart: dayPartForDate(new Date(MATCH_DATE)),
        windowId: 'poll-1',
      },
    ])
  })

  it('swaps team and opponent when the poll is for the away side', () => {
    const awayMatch = { ...match, homeTeamId: null, homeTeamName: 'Rivals CC', awayTeamId: 'team-home', awayTeamName: null } as Match
    const { matches } = toSquadResponsesModel({ responses, poll, match: awayMatch, teamsById })

    expect(matches[0].teamName).toBe('Home Team')
    expect(matches[0].opponentLabel).toBe('Rivals CC')
  })

  it('feeds the shared grouping as a single slot with the heading rule of the card', () => {
    const model = toSquadResponsesModel({ responses, poll, match, teamsById })
    const slots = groupBySlot({ brackets: model.brackets, responses: model.rows }, model.matches)

    expect(slots).toHaveLength(1)
    expect(slots[0].available.map((r) => r.firstName)).toEqual(['Jane'])
    expect(slots[0].noResponse.map((r) => r.firstName)).toEqual(['Cal'])
    expect(slots[0].matches).toHaveLength(1)
    expect(slotHeading(slots[0].bracket)).toMatch(/ · (Morning|Afternoon)$/)
  })

  it('splits Morning/Afternoon on the local time of day (before noon is Morning)', () => {
    const at = (date: Date) =>
      toSquadResponsesModel({ responses, poll, match: { ...match, matchDate: date.toISOString() } as Match, teamsById }).brackets[0].dayPart

    expect(at(new Date(2026, 9, 15, 9, 0))).toBe('MORNING')
    expect(at(new Date(2026, 9, 15, 11, 59))).toBe('MORNING')
    expect(at(new Date(2026, 9, 15, 12, 0))).toBe('AFTERNOON')
    expect(at(new Date(2026, 9, 15, 14, 0))).toBe('AFTERNOON')
  })

  it('carries the via link flag onto the synthetic status', () => {
    const withLink = {
      ...responses,
      responses: [{ ...responses.responses[0], viaLink: true }, responses.responses[1]],
    }
    const { rows } = toSquadResponsesModel({ responses: withLink, poll, match, teamsById })
    expect(rows[0].statuses[0].viaLink).toBe(true)
    expect(rows[1].statuses[0].viaLink).toBeUndefined()
  })
})
