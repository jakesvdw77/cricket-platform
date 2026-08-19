// Mirrors the backend's CreateClubRequest/UpdateClubRequest @Pattern — lowercase alphanumeric
// segments joined by single hyphens, no leading/trailing/doubled hyphens.
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

// Best-effort derivation for the auto-suggest below — always produces something matching
// SLUG_PATTERN's shape (or an empty string), though the backend's reserved-word/uniqueness
// rules still apply and the admin can freely overwrite the result.
export function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Full submit-time slug validation (required + length + format), shared by ClubForm and
// SubscriptionForm (for its inline new-club draft) — both need the identical three-tier check
// ClubForm.validate() originally had. Callers that want live-while-typing feedback without
// nagging over an empty, not-yet-touched field should guard the blank case themselves before
// calling this (see ClubPicker's own local liveSlugError).
export function validateSlug(slug: string): string | undefined {
  const trimmed = slug.trim()
  if (!trimmed) {
    return 'Slug is required'
  }
  if (trimmed.length < 3 || trimmed.length > 63) {
    return 'Slug must be between 3 and 63 characters'
  }
  if (!SLUG_PATTERN.test(trimmed)) {
    return 'Use lowercase letters, numbers, and single hyphens, e.g. riverside-cc'
  }
  return undefined
}
