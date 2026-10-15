import { isAxiosError } from 'axios'

// docs/specs/104-match-results-import-adaptors.md: a typed reader for the ProblemDetail body of a failed import call, so a
// page never stringifies an object. Lives in api/ because it is the one place that may look inside an axios error.

export interface ImportErrorItem {
  path: string
  code: string
  message: string
}

// What kind of failure it was, which decides the Alert the Source step shows.
export type ImportProblemKind =
  | 'validation' // readable but wrong for the source: a list of errors
  | 'unsupported' // the source does not take this format
  | 'unreadable' // not decodable or not parseable at all: one message
  | 'too-large'
  | 'conflict' // 409: published result, draft without acknowledgement, provider id used elsewhere
  | 'forbidden'
  | 'not-found'
  | 'network' // no response: retryable
  | 'other'

export interface ImportProblem {
  kind: ImportProblemKind
  status: number | null
  message: string
  errors: ImportErrorItem[]
  // How many errors there were before the server capped the list; never below errors.length.
  totalErrors: number
  supported: string[]
  otherMatchId: string | null
}

const FALLBACK = 'Something went wrong. Please try again.'

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function items(value: unknown): ImportErrorItem[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({ path: text(item.path), code: text(item.code), message: text(item.message) }))
    .filter((item) => item.message !== '')
}

export function readImportProblem(error: unknown): ImportProblem {
  if (!isAxiosError(error)) {
    return { kind: 'other', status: null, message: FALLBACK, errors: [], totalErrors: 0, supported: [], otherMatchId: null }
  }
  const status = error.response?.status ?? null
  if (status === null) {
    return {
      kind: 'network',
      status,
      message: "We couldn't reach the server. Check your connection and try again.",
      errors: [],
      totalErrors: 0,
      supported: [],
      otherMatchId: null,
    }
  }
  const body = (error.response?.data ?? {}) as Record<string, unknown>
  const errors = items(body.errors)
  const totalErrors = typeof body.totalErrors === 'number' ? Math.max(body.totalErrors, errors.length) : errors.length
  const supported = Array.isArray(body.supported) ? body.supported.map(String) : []
  const detail = text(body.detail)
  let kind: ImportProblemKind = 'other'
  if (status === 413) kind = 'too-large'
  else if (status === 409) kind = 'conflict'
  else if (status === 403) kind = 'forbidden'
  else if (status === 404) kind = 'not-found'
  else if (status === 400) kind = errors.length > 0 ? 'validation' : supported.length > 0 ? 'unsupported' : 'unreadable'
  return {
    kind,
    status,
    message: detail || FALLBACK,
    errors,
    totalErrors,
    supported,
    otherMatchId: text(body.otherMatchId) || null,
  }
}

export interface VisibleErrors {
  shown: ImportErrorItem[]
  // How many are not shown ("and 2 more"): the ones past the limit plus any the server did not send.
  more: number
}

// The first `limit` errors, and how many are left out (the server's own cap is counted through `totalErrors`).
export function visibleErrors(errors: ImportErrorItem[], totalErrors: number, limit = 20): VisibleErrors {
  const shown = errors.slice(0, limit)
  return { shown, more: Math.max(totalErrors, errors.length) - shown.length }
}
