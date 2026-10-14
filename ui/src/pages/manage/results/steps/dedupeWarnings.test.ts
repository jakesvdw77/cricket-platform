import { describe, expect, it } from 'vitest'
import type { MarginCheck } from '../../../../utils/marginCheck'
import { dedupeWarnings } from './dedupeWarnings'

// The wording below is copied from the warnings in backend ResultValidator.java (names substituted). If the server's
// text changes, the matching case here must change with it - and this test fails until the dedupe patterns do.
const MARGIN_WARNINGS = [
  'The scores differ by 22 runs, but the margin is 30 runs.',
  '1st XI lost 4 wickets, but the margin is 5 wickets.',
  '1st XI won by runs but batted second.',
  '1st XI won by wickets but batted first.',
  'The match is recorded as a tie but the two innings are not level.',
  'Riverside scored more, but 1st XI is marked as the winner.',
  'The scores are level. Was it a tie, or decided in a super over?',
  'Riverside scored more in the super over, but 1st XI is marked as the winner.',
  'The super over is level too; add another super over.',
  '1st XI won chasing a DLS target of 180, but scored 170.',
  'Riverside reached the DLS target of 180, but 1st XI is marked as the winner.',
]

const UNRELATED_WARNINGS = [
  'Both innings scores have not been entered.',
  'The DLS revised target and revised overs have not been entered.',
  '1st XI won the toss and chose to bat, but Riverside batted first.',
  'Innings 1 is longer than the scheduled 20.0 overs.',
  'Innings 2 is marked all out with 7 wickets.',
]

const mismatch: MarginCheck = { status: 'mismatch', reason: 'The scores differ by 22 runs.', suggestion: null, expected: null }
const match: MarginCheck = { status: 'match', reason: 'Agrees.', suggestion: null, expected: null }

describe('dedupeWarnings', () => {
  it.each(MARGIN_WARNINGS)('drops the server margin wording when the client check found a mismatch: %s', (line) => {
    expect(dedupeWarnings([line], mismatch)).toEqual([])
  })

  it.each(MARGIN_WARNINGS)('keeps the server wording when the client check did not find a mismatch: %s', (line) => {
    expect(dedupeWarnings([line], match)).toEqual([line])
  })

  it.each(UNRELATED_WARNINGS)('always keeps a warning the client check does not cover: %s', (line) => {
    expect(dedupeWarnings([line], mismatch)).toEqual([line])
  })
})
