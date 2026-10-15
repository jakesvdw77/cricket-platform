import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import { readImportProblem, visibleErrors } from './importErrors'

const failure = (status: number | null, data?: unknown) =>
  new AxiosError('failed', String(status), undefined, undefined, status === null ? undefined : ({ status, data } as never))

describe('readImportProblem', () => {
  it('reads a 400 with an error list as a validation failure, keeping path, code and message', () => {
    const problem = readImportProblem(
      failure(400, {
        detail: 'The document is not valid.',
        totalErrors: 3,
        errors: [
          { path: 'teams[0].name', code: 'REQUIRED', message: 'A team needs a name.' },
          { path: 'match.date', code: 'BAD_DATE', message: 'The date must be yyyy-MM-dd.' },
        ],
      }),
    )
    expect(problem.kind).toBe('validation')
    expect(problem.errors).toEqual([
      { path: 'teams[0].name', code: 'REQUIRED', message: 'A team needs a name.' },
      { path: 'match.date', code: 'BAD_DATE', message: 'The date must be yyyy-MM-dd.' },
    ])
    expect(problem.totalErrors).toBe(3)
  })

  it('never reports fewer total errors than it has listed', () => {
    const problem = readImportProblem(failure(400, { errors: [{ path: 'a', code: 'X', message: 'One' }, { path: 'b', code: 'X', message: 'Two' }], totalErrors: 1 }))
    expect(problem.totalErrors).toBe(2)
  })

  it('drops list entries with no message and entries that are not objects', () => {
    const problem = readImportProblem(failure(400, { errors: [{ path: 'a', code: 'X', message: '' }, 'oops', null, { path: 'b', message: 'Kept' }] }))
    expect(problem.errors).toEqual([{ path: 'b', code: '', message: 'Kept' }])
  })

  it('reads a 400 naming supported formats as unsupported, and one with neither as unreadable', () => {
    expect(readImportProblem(failure(400, { detail: 'No PDFs.', supported: ['JSON'] })).kind).toBe('unsupported')
    expect(readImportProblem(failure(400, { detail: 'Not valid JSON at line 2.' })).kind).toBe('unreadable')
    expect(readImportProblem(failure(400, { detail: 'Not valid JSON at line 2.' })).message).toBe('Not valid JSON at line 2.')
  })

  it('maps the other statuses to a kind, and carries the other match of a conflict', () => {
    expect(readImportProblem(failure(413, { detail: 'Too big.' })).kind).toBe('too-large')
    expect(readImportProblem(failure(403)).kind).toBe('forbidden')
    expect(readImportProblem(failure(404)).kind).toBe('not-found')
    expect(readImportProblem(failure(500)).kind).toBe('other')
    const conflict = readImportProblem(failure(409, { detail: 'Already used.', otherMatchId: 'match-9' }))
    expect(conflict.kind).toBe('conflict')
    expect(conflict.otherMatchId).toBe('match-9')
  })

  it('treats no response as a retryable network problem and a non-axios error as a generic one', () => {
    const network = readImportProblem(failure(null))
    expect(network.kind).toBe('network')
    expect(network.status).toBeNull()
    expect(readImportProblem(new Error('boom')).kind).toBe('other')
  })

  it('falls back to a plain sentence when the body has no detail, never an object', () => {
    expect(readImportProblem(failure(500, { detail: { nested: true } })).message).toBe('Something went wrong. Please try again.')
  })
})

describe('visibleErrors', () => {
  const list = (count: number) => Array.from({ length: count }, (_, index) => ({ path: `p${index}`, code: 'X', message: `Message ${index}` }))

  it('shows everything and no "more" when the list is short', () => {
    expect(visibleErrors(list(3), 3)).toEqual({ shown: list(3), more: 0 })
  })

  it('truncates at the limit and counts what is left out', () => {
    const result = visibleErrors(list(25), 25)
    expect(result.shown).toHaveLength(20)
    expect(result.more).toBe(5)
  })

  it('counts errors the server capped before sending', () => {
    expect(visibleErrors(list(50), 73, 20).more).toBe(53)
  })

  it('honours a custom limit', () => {
    expect(visibleErrors(list(5), 5, 2)).toEqual({ shown: list(5).slice(0, 2), more: 3 })
  })
})
