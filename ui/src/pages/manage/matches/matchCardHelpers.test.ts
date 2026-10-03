import { describe, expect, it } from 'vitest'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import {
  announcedBadge,
  announcedBadges,
  badgeFor,
  clubSideSectionId,
  matchLeagueValue,
  matchPollsFrom,
  NO_CLUB_TEAM_REASON,
  ownSides,
  pickedLegend,
  pollBadgeFor,
  pollDestination,
  selectionRows,
  sideName,
  withPlayingXiTab,
} from './matchCardHelpers'
import { groupPoll, makeMatch, makeTeam, makeTeams, squadPoll } from './matchTestUtils'

const teams = makeTeams(makeTeam('team-1', '1st XI', 'sec-1'), makeTeam('team-2', '2nd XI', 'sec-2'))

describe('pollBadgeFor', () => {
  it('is "Poll open" (open tone) when any poll is open, even if another is closed', () => {
    expect(pollBadgeFor([squadPoll({ open: false }), squadPoll({ pollId: 'p2', teamId: 'team-2', open: true })])).toEqual({
      label: 'Poll open',
      tone: 'open',
    })
  })

  it('is "Poll closed" (closed tone) when there are polls and none is open', () => {
    expect(pollBadgeFor([squadPoll({ open: false })])).toEqual({ label: 'Poll closed', tone: 'closed' })
  })

  it('is "No poll" (noPoll tone) when there are none', () => {
    expect(pollBadgeFor([])).toEqual({ label: 'No poll', tone: 'noPoll' })
  })
})

describe('pollDestination', () => {
  const derby = { awayTeamId: 'team-2', awayTeamName: null }

  it('opens the New poll flow prefilled for the match when there is no poll, with the club side section', () => {
    expect(pollDestination(makeMatch(), teams)).toEqual({
      kind: 'link',
      to: '/manage/availability/new?type=group&sectionId=sec-1&matchId=match-1',
    })
  })

  it('uses the away club side section when the home side is not a club team', () => {
    const match = makeMatch({ homeTeamId: null, homeTeamName: 'Them', awayTeamId: 'team-2', awayTeamName: null })
    expect(pollDestination(match, teams)).toEqual({
      kind: 'link',
      to: '/manage/availability/new?type=group&sectionId=sec-2&matchId=match-1',
    })
  })

  it('omits sectionId when the club side section is unknown', () => {
    const match = makeMatch({ homeTeamId: 'unknown-team' })
    expect(pollDestination(match, teams)).toEqual({
      kind: 'link',
      to: '/manage/availability/new?type=group&matchId=match-1',
    })
  })

  it('opens the group Responses page by round id for a single group poll', () => {
    expect(pollDestination(makeMatch({ polls: [groupPoll({ roundId: 'round-9', pollId: 'ignored' })] }), teams)).toEqual({
      kind: 'link',
      to: '/manage/availability/group/round-9',
    })
  })

  it('falls back to the poll id for a group poll without a round id', () => {
    expect(pollDestination(makeMatch({ polls: [groupPoll({ roundId: null, pollId: 'round-7' })] }), teams)).toEqual({
      kind: 'link',
      to: '/manage/availability/group/round-7',
    })
  })

  it('opens the squad Responses page for a single squad poll', () => {
    expect(pollDestination(makeMatch({ polls: [squadPoll({ pollId: 'poll-5' })] }), teams)).toEqual({
      kind: 'link',
      to: '/manage/availability/squad/match-1/poll-5',
    })
  })

  it('is a menu of Home and Away squad polls for a derby with a poll per side', () => {
    const match = makeMatch({
      ...derby,
      polls: [squadPoll({ pollId: 'poll-1' }), squadPoll({ pollId: 'poll-2', teamId: 'team-2' })],
    })
    expect(pollDestination(match, teams)).toEqual({
      kind: 'menu',
      options: [
        { label: '1st XI · Home poll', to: '/manage/availability/squad/match-1/poll-1' },
        { label: '2nd XI · Away poll', to: '/manage/availability/squad/match-1/poll-2' },
      ],
    })
  })

  it('labels a group poll with the team it covers when the other side has a squad poll', () => {
    const match = makeMatch({
      ...derby,
      polls: [groupPoll({ roundId: 'round-3' }), squadPoll({ pollId: 'poll-2', teamId: 'team-2' })],
    })
    expect(pollDestination(match, teams)).toEqual({
      kind: 'menu',
      options: [
        { label: '1st XI · Group poll', to: '/manage/availability/group/round-3' },
        { label: '2nd XI · Away poll', to: '/manage/availability/squad/match-1/poll-2' },
      ],
    })
  })
})

describe('ownSides', () => {
  it('lists the sides with a team id, home first', () => {
    expect(ownSides(makeMatch({ awayTeamId: 'team-2', awayTeamName: null }))).toEqual([
      { side: 'home', teamId: 'team-1' },
      { side: 'away', teamId: 'team-2' },
    ])
    expect(ownSides(makeMatch({ homeTeamId: null, homeTeamName: 'X', awayTeamId: 'team-2' }))).toEqual([
      { side: 'away', teamId: 'team-2' },
    ])
    expect(ownSides(makeMatch({ homeTeamId: null, homeTeamName: 'X' }))).toEqual([])
  })
})

describe('matchPollsFrom', () => {
  const covered = { windowId: 'w-1', roundId: 'round-1', windowOpen: true }
  const uncovered = { windowId: null, roundId: null, windowOpen: false }

  it('gives one group poll when a group poll covers both own sides (deduplicated by round)', () => {
    const squads = new Map([
      ['team-1', covered],
      ['team-2', covered],
    ])
    expect(matchPollsFrom(['team-1', 'team-2'], [], squads)).toEqual([
      { type: 'GROUP', teamId: null, pollId: 'round-1', roundId: 'round-1', open: true },
    ])
  })

  it('gives a squad poll per own side that is not group-covered', () => {
    const squadPolls = [
      { id: 'p1', teamId: 'team-1', open: true },
      { id: 'p2', teamId: 'team-2', open: false },
    ]
    const squads = new Map([
      ['team-1', uncovered],
      ['team-2', uncovered],
    ])
    expect(matchPollsFrom(['team-1', 'team-2'], squadPolls, squads)).toEqual([
      { type: 'SQUAD', teamId: 'team-1', pollId: 'p1', roundId: null, open: true },
      { type: 'SQUAD', teamId: 'team-2', pollId: 'p2', roundId: null, open: false },
    ])
  })

  it('is mutually exclusive per side: a group-covered side ignores its own squad poll', () => {
    const squadPolls = [
      { id: 'p1', teamId: 'team-1', open: true },
      { id: 'p2', teamId: 'team-2', open: true },
    ]
    const squads = new Map([
      ['team-1', covered],
      ['team-2', uncovered],
    ])
    expect(matchPollsFrom(['team-1', 'team-2'], squadPolls, squads)).toEqual([
      { type: 'GROUP', teamId: null, pollId: 'round-1', roundId: 'round-1', open: true },
      { type: 'SQUAD', teamId: 'team-2', pollId: 'p2', roundId: null, open: true },
    ])
  })

  it('is empty with no polls and treats a side with no squad data as not group-covered', () => {
    expect(matchPollsFrom(['team-1'], [], new Map())).toEqual([])
    expect(matchPollsFrom(['team-1'], [{ id: 'p1', teamId: 'team-1', open: true }], new Map())).toHaveLength(1)
  })
})

describe('matchLeagueValue', () => {
  const leagues = new Map([['league-1', { id: 'league-1', name: 'Premier' } as League]])
  const seasons = new Map([['season-1', { id: 'season-1', label: '2026' } as Season]])

  it('joins league and season, or gives whichever is known, or empty', () => {
    expect(matchLeagueValue(makeMatch({ leagueId: 'league-1' }), leagues, seasons)).toBe('Premier · 2026')
    expect(matchLeagueValue(makeMatch(), leagues, seasons)).toBe('2026')
    expect(matchLeagueValue(makeMatch({ seasonId: 'nope' }), leagues, seasons)).toBe('')
  })
})

describe('pickedLegend', () => {
  it('counts down to the XI size and says squad complete at or over it', () => {
    expect(pickedLegend(7, 11)).toBe('7 picked · 4 to go')
    expect(pickedLegend(11, 11)).toBe('squad complete')
    expect(pickedLegend(12, 11)).toBe('squad complete')
  })
})

describe('selectionRows', () => {
  it('gives one row for a match with a single club side', () => {
    expect(selectionRows(makeMatch({ homePickedCount: 7 }), teams)).toEqual([
      { teamName: '1st XI', picked: 7, playingXiSize: 11 },
    ])
  })

  it('gives two rows (home then away) for a derby', () => {
    const match = makeMatch({ awayTeamId: 'team-2', awayTeamName: null, homePickedCount: 11, awayPickedCount: 3 })
    expect(selectionRows(match, teams)).toEqual([
      { teamName: '1st XI', picked: 11, playingXiSize: 11 },
      { teamName: '2nd XI', picked: 3, playingXiSize: 11 },
    ])
  })

  it('carries a null playing XI size through for a match with no league', () => {
    expect(selectionRows(makeMatch({ playingXiSize: null, homePickedCount: 4 }), teams)).toEqual([
      { teamName: '1st XI', picked: 4, playingXiSize: null },
    ])
  })

  it('skips a free-text side and a side whose count is null (another club\'s team)', () => {
    const match = makeMatch({ homeTeamId: 'other-club-team', homePickedCount: null, awayTeamId: null, awayPickedCount: null })
    expect(selectionRows(match, teams)).toEqual([])
  })

  it('is empty when neither side is a club team', () => {
    const match = makeMatch({ homeTeamId: null, homeTeamName: 'A', homePickedCount: null })
    expect(selectionRows(match, teams)).toEqual([])
  })
})

describe('clubSideSectionId', () => {
  it('prefers the home side', () => {
    const match = makeMatch({ awayTeamId: 'team-2', awayTeamName: null })
    expect(clubSideSectionId(match, teams)).toBe('sec-1')
  })

  it('falls back to the away side', () => {
    expect(clubSideSectionId(makeMatch({ homeTeamId: null, homeTeamName: 'X', awayTeamId: 'team-2' }), teams)).toBe('sec-2')
  })

  it('is undefined when no club side resolves', () => {
    expect(clubSideSectionId(makeMatch({ homeTeamId: null, homeTeamName: 'X' }), teams)).toBeUndefined()
  })
})

describe('moved helpers', () => {
  it('sideName resolves a team id, a free-text name, or TBC', () => {
    expect(sideName('team-1', null, teams)).toBe('1st XI')
    expect(sideName('nope', null, teams)).toBe('Unknown team')
    expect(sideName(null, 'Free', teams)).toBe('Free')
    expect(sideName(null, null, teams)).toBe('TBC')
  })

  it('badgeFor marks only an inactive match', () => {
    expect(badgeFor(makeMatch())).toBeUndefined()
    expect(badgeFor(makeMatch({ active: false }))).toEqual({ label: 'Inactive', tone: 'muted' })
  })

  it('announcedBadges uses "Not announced" and prefixes only when both sides are club teams', () => {
    expect(announcedBadges(makeMatch(), teams)).toEqual([{ label: 'Not announced', tone: 'neutral' }])
    const derby = makeMatch({ awayTeamId: 'team-2', awayTeamName: null, homeSideAnnounced: true })
    expect(announcedBadges(derby, teams)).toEqual([
      { label: '1st XI: Announced', tone: 'positive' },
      { label: '2nd XI: Not announced', tone: 'neutral' },
    ])
  })

  it('announcedBadge builds one badge with an optional prefix', () => {
    expect(announcedBadge(true, '')).toEqual({ label: 'Announced', tone: 'positive' })
    expect(announcedBadge(false, 'A: ')).toEqual({ label: 'A: Not announced', tone: 'neutral' })
  })

  it('exposes the shared no-club-team reason', () => {
    expect(NO_CLUB_TEAM_REASON).toBe('None of your teams is playing in this match')
  })

  it('withPlayingXiTab appends once and never duplicates', () => {
    expect(withPlayingXiTab('/a/edit')).toBe('/a/edit?tab=playing-xi')
    expect(withPlayingXiTab('/a/edit?x=1')).toBe('/a/edit?x=1&tab=playing-xi')
    expect(withPlayingXiTab('/a/edit?tab=playing-xi')).toBe('/a/edit?tab=playing-xi')
  })
})
