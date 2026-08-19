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
