import { AxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import * as shared from './publicAvailabilityShared'
import * as poll from './publicPollApi'
import * as round from './publicSectionAvailabilityApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const put = vi.mocked(api.put)

beforeEach(() => {
  vi.clearAllMocks()
})

const body = { firstName: 'Liam', lastName: 'Carter', dateOfBirth: '1985-03-04' }

describe.each([
  ['squad poll', '/public/polls/id-1', poll.getPoll, poll.verify, poll.getAnswers, poll.putAnswers],
  ['group poll', '/public/section-availability-rounds/id-1', round.getRound, round.verify, round.getAnswers, round.putAnswers],
])('%s api', (_name, base, getHeader, verify, getAnswers, putAnswers) => {
  it('gets the header without any player data', async () => {
    get.mockResolvedValueOnce({ data: { open: true } })
    await expect(getHeader('id-1')).resolves.toEqual({ open: true })
    expect(get).toHaveBeenCalledWith(base)
  })

  it('posts verify and returns every response shape', async () => {
    post.mockResolvedValueOnce({ data: { status: 'PICK', candidates: [] } })
    await expect(verify('id-1', { ...body, playerId: 'p1' })).resolves.toEqual({ status: 'PICK', candidates: [] })
    expect(post).toHaveBeenCalledWith(`${base}/verify`, { ...body, playerId: 'p1' })
  })

  it('reads answers with the token header', async () => {
    get.mockResolvedValueOnce({ data: { answers: [] } })
    await getAnswers('id-1', 'p1', 'tok')
    expect(get).toHaveBeenCalledWith(`${base}/players/p1/answers`, { headers: { 'X-Public-Token': 'tok' } })
  })

  it('writes answers with the token header', async () => {
    put.mockResolvedValueOnce({ data: { answers: [{ windowId: null, status: 'AVAILABLE' }] } })
    const result = await putAnswers('id-1', 'p1', 'tok', [{ windowId: null, status: 'AVAILABLE' }])
    expect(put).toHaveBeenCalledWith(
      `${base}/players/p1/answers`,
      { answers: [{ windowId: null, status: 'AVAILABLE' }] },
      { headers: { 'X-Public-Token': 'tok' } },
    )
    expect(result.answers).toHaveLength(1)
  })
})

function failure(status: number, data: unknown) {
  return new AxiosError('x', 'ERR', undefined, undefined, { status, data } as AxiosResponse)
}

describe('ProblemDetail helpers', () => {
  it('reads triesLeft from a 403', () => {
    const error = failure(403, { detail: 'No match', triesLeft: 2 })
    expect(shared.triesLeftOf(error)).toBe(2)
    expect(shared.httpStatusOf(error)).toBe(403)
    expect(shared.readProblem(error)).toMatchObject({ status: 403, detail: 'No match', triesLeft: 2 })
  })

  it('keeps a triesLeft of zero', () => {
    expect(shared.triesLeftOf(failure(403, { triesLeft: 0 }))).toBe(0)
  })

  it('reads retryAfterSeconds from a 423 and a 429', () => {
    expect(shared.retryAfterSecondsOf(failure(423, { retryAfterSeconds: 900 }))).toBe(900)
    expect(shared.retryAfterSecondsOf(failure(429, { retryAfterSeconds: 60 }))).toBe(60)
  })

  it('ignores missing or wrongly typed fields and non axios errors', () => {
    expect(shared.triesLeftOf(failure(403, { triesLeft: 'two' }))).toBeUndefined()
    expect(shared.retryAfterSecondsOf(failure(429, null))).toBeUndefined()
    expect(shared.readProblem(new Error('boom'))).toEqual({ status: null })
    expect(shared.httpStatusOf(new AxiosError('no response'))).toBeNull()
  })
})
