import { isAxiosError } from 'axios'

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
