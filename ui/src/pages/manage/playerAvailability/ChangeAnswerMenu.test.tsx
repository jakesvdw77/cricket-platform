import { describe, expect, it } from 'vitest'
import { canChangeAnswer } from './ChangeAnswerMenu'
import { makeGame } from './testData'

const cell = (status: 'AVAILABLE' | 'NOT_IN_POLL') => ({ matchId: 'm', status, picked: false })

describe('canChangeAnswer', () => {
  it('is true for a cell of a squad or group game with a poll id', () => {
    expect(canChangeAnswer(makeGame({ pollType: 'SQUAD', pollId: 'p1', roundId: null }), cell('AVAILABLE'))).toBe(true)
    expect(canChangeAnswer(makeGame({ pollType: 'GROUP', pollId: 'r1', roundId: 'r1' }), cell('AVAILABLE'))).toBe(true)
  })

  it('is false without a cell, for NOT_IN_POLL, and for a game without a poll', () => {
    const game = makeGame({ pollType: 'GROUP', pollId: 'r1', roundId: 'r1' })
    expect(canChangeAnswer(game, undefined)).toBe(false)
    expect(canChangeAnswer(game, cell('NOT_IN_POLL'))).toBe(false)
    expect(canChangeAnswer(makeGame({ pollType: null, pollId: null, roundId: null }), cell('AVAILABLE'))).toBe(false)
  })

  it('is false when the poll id is missing, for either kind', () => {
    expect(canChangeAnswer(makeGame({ pollType: 'GROUP', pollId: null, roundId: null }), cell('AVAILABLE'))).toBe(false)
    expect(canChangeAnswer(makeGame({ pollType: 'SQUAD', pollId: null, roundId: null }), cell('AVAILABLE'))).toBe(false)
  })
})
