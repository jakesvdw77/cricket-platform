import { isAxiosError } from 'axios'
import type { ResultIssue } from '../api/matchResultApi'

// The backend's GlobalExceptionHandler returns RFC 7807 ProblemDetail bodies — { detail: "..." }
// carries the specific reason (e.g. a reserved slug, a duplicate slug). Falls back to a generic
// message when the response isn't shaped that way — same pattern SubscriptionFormPage originally
// established, extracted here once ManageClubProfilePage (docs/specs/020-club-manager-access.md)
// became a second consumer alongside ClubFormPage.
export function errorDetail(error: unknown, fallback: string): string {
  if (isAxiosError(error) && typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail
  }
  return fallback
}

// True when the server answered 404 - lets a page tell "does not exist" apart from a failed load without importing axios.
export function isNotFound(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404
}

// The HTTP status of a failed request, or null when the error did not come from a server response.
export function errorStatus(error: unknown): number | null {
  return isAxiosError(error) ? (error.response?.status ?? null) : null
}

// The `errors` array some endpoints put on a failure body (e.g. publish validation), as strings; null when absent.
export function errorList(error: unknown): string[] | null {
  if (!isAxiosError(error)) return null
  const errors = (error.response?.data as { errors?: unknown } | undefined)?.errors
  return Array.isArray(errors) && errors.length > 0 ? errors.map(String) : null
}

// The typed `issues` (code, step, side, severity, message) a failed result save or publish carries; empty when absent.
export function errorIssues(error: unknown): ResultIssue[] {
  if (!isAxiosError<{ issues?: unknown }>(error)) return []
  const issues = error.response?.data?.issues
  return Array.isArray(issues) ? (issues as ResultIssue[]).filter((issue) => issue && typeof issue.message === 'string') : []
}
