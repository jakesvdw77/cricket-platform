import { describe, expect, it } from 'vitest'
import {
  announcedBadges,
  badgeFor,
  clubSideSectionId,
  pollBadgeFor,
  pollDestination,
  selectionRows,
  sideName,
  withPlayingXiTab,
} from './matchCardHelpers'
import { groupPoll, makeMatch, makeTeam, makeTeams, squadPoll } from './matchTestUtils'

const teams = makeTeams(makeTeam('team-1', '1st XI', 'sec-1'), makeTeam('team-2', '2nd XI', 'sec-2'))
const EDIT = '/manage/fixtures/matches/match-1/edit'

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
  it('opens the New poll flow prefilled for the match when there is no poll, with the club side section', () => {
    expect(pollDestination(makeMatch(), teams, EDIT)).toBe(
      '/manage/availability/new?type=group&sectionId=sec-1&matchId=match-1',
    )
  })

  it('uses the away club side section when the home side is not a club team', () => {
    const match = makeMatch({ homeTeamId: null, homeTeamName: 'Them', awayTeamId: 'team-2', awayTeamName: null })
    expect(pollDestination(match, teams, EDIT)).toBe('/manage/availability/new?type=group&sectionId=sec-2&matchId=match-1')
  })

  it('omits sectionId when the club side section is unknown', () => {
    const match = makeMatch({ homeTeamId: 'unknown-team' })
    expect(pollDestination(match, teams, EDIT)).toBe('/manage/availability/new?type=group&matchId=match-1')
  })

  it('opens the group Responses page by round id for a single group poll', () => {
    expect(pollDestination(makeMatch({ polls: [groupPoll({ roundId: 'round-9', pollId: 'ignored' })] }), teams, EDIT)).toBe(
      '/manage/availability/group/round-9',
    )
  })

  it('falls back to the poll id for a group poll without a round id', () => {
    expect(pollDestination(makeMatch({ polls: [groupPoll({ roundId: null, pollId: 'round-7' })] }), teams, EDIT)).toBe(
      '/manage/availability/group/round-7',
    )
  })

  it('opens the squad Responses page for a single squad poll', () => {
    expect(pollDestination(makeMatch({ polls: [squadPoll({ pollId: 'poll-5' })] }), teams, EDIT)).toBe(
      '/manage/availability/squad/match-1/poll-5',
    )
  })

  it('opens the match Availability tab for two polls, deriving the base from the edit route without its query', () => {
    const match = makeMatch({ polls: [squadPoll(), squadPoll({ pollId: 'poll-2', teamId: 'team-2' })] })
    expect(pollDestination(match, teams, EDIT)).toBe(`${EDIT}?tab=availability`)
    expect(pollDestination(match, teams, `${EDIT}?tab=playing-xi`)).toBe(`${EDIT}?tab=availability`)
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

  it('withPlayingXiTab appends once and never duplicates', () => {
    expect(withPlayingXiTab('/a/edit')).toBe('/a/edit?tab=playing-xi')
    expect(withPlayingXiTab('/a/edit?x=1')).toBe('/a/edit?x=1&tab=playing-xi')
    expect(withPlayingXiTab('/a/edit?tab=playing-xi')).toBe('/a/edit?tab=playing-xi')
  })
})
