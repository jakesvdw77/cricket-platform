import { describe, expect, it } from 'vitest'
import type { ResultIssue } from '../../../../api/matchResultApi'
import { isScorecardStep, issuesOf, stepIdForIssue } from './reviewIssues'

describe('stepIdForIssue', () => {
  it('maps each wizard step to the page step id', () => {
    expect(stepIdForIssue('RESULT')).toBe('outcome')
    expect(stepIdForIssue('TOSS')).toBe('toss')
    expect(stepIdForIssue('SCORES')).toBe('scores')
    expect(stepIdForIssue('BATTING')).toBe('batting')
    expect(stepIdForIssue('BOWLING')).toBe('bowling')
    expect(stepIdForIssue('AWARDS')).toBe('awards')
    expect(stepIdForIssue('TEAMS')).toBe('teams')
  })

  it('sends who-played codes to Teams whichever step the server filed them under', () => {
    expect(stepIdForIssue('BATTING', 'PLAYER_ON_BOTH_SIDES')).toBe('teams')
    expect(stepIdForIssue('AWARDS', 'GUEST_ON_BOTH_SIDES')).toBe('teams')
    expect(stepIdForIssue('BOWLING', 'PLAYER_NOT_IN_SQUAD')).toBe('teams')
    expect(stepIdForIssue('BATTING', 'IMPORTED_NAME_UNCONFIRMED')).toBe('teams')
    expect(stepIdForIssue('BATTING', 'BATTER_RUNS_MISSING')).toBe('batting')
  })

  it('is null without a step', () => {
    expect(stepIdForIssue(null)).toBeNull()
    expect(stepIdForIssue(undefined, 'X')).toBeNull()
  })
})

describe('isScorecardStep', () => {
  it('is true for the four scorecard steps only', () => {
    expect(['TEAMS', 'BATTING', 'BOWLING', 'AWARDS'].every((step) => isScorecardStep(step as never))).toBe(true)
    expect(isScorecardStep('RESULT')).toBe(false)
    expect(isScorecardStep('SCORES')).toBe(false)
    expect(isScorecardStep(null)).toBe(false)
  })
})

describe('issuesOf', () => {
  it('uses the typed issues when the server sent them', () => {
    const typed: ResultIssue[] = [{ code: 'OUR_TEAM_NOT_SELECTED', step: 'TEAMS', side: 'HOME', severity: 'INFO', message: 'No team' }]
    expect(issuesOf({ errors: ['x'], warnings: ['y'], issues: typed })).toBe(typed)
  })

  it('reads plain error and warning lines as code-less issues when there are no typed ones', () => {
    expect(issuesOf({ errors: ['bad'], warnings: ['careful'], issues: [] })).toEqual([
      { code: '', step: null, side: null, severity: 'ERROR', message: 'bad' },
      { code: '', step: null, side: null, severity: 'WARNING', message: 'careful' },
    ])
    expect(issuesOf({ errors: [], warnings: [] })).toEqual([])
  })
})
