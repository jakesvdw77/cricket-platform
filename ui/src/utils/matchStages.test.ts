import { describe, expect, it } from 'vitest'
import { STAGE_SUGGESTIONS, stageOf, stagesIn, tbcText } from './matchStages'

describe('matchStages (spec 155)', () => {
  it('offers the general stage list', () => {
    expect(STAGE_SUGGESTIONS).toEqual(['Playoff', 'Quarter-final', 'Semi-final', 'Third place', 'Final'])
  })

  it('treats an empty, blank or missing stage as a pool match', () => {
    expect(stageOf({ stage: null })).toBeNull()
    expect(stageOf({ stage: '   ' })).toBeNull()
    expect(stageOf({ stage: ' Final ' })).toBe('Final')
  })

  it('writes a TBC side as "TBC: text"', () => {
    expect(tbcText('3rd in the pool')).toBe('TBC: 3rd in the pool')
    expect(tbcText(null)).toBe('TBC:')
  })

  it('lists the stages in use once each, in first-seen order, leaving out pool matches', () => {
    expect(stagesIn([{ stage: null }, { stage: 'Semi-final' }, { stage: 'Final' }, { stage: 'Semi-final' }, { stage: ' ' }])).toEqual(['Semi-final', 'Final'])
  })
})
