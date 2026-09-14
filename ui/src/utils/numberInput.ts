// Shared string <-> `number | null` round trip for a numeric text `Input` whose local draft state
// is string-based (so a user can freely type/clear the field) while the value it ultimately
// commits is `number | null`. Extracted from SectionDetailPanel.tsx's own inline
// numberToInput/inputToNumber (minAge/maxAge) once a second and third consumer
// (docs/specs/031-jersey-numbers.md's PlayerForm "Jersey number" field and TeamFormPage's
// SquadPlayerCard inline "Squad #" edit) needed the identical conversion — same "extract before
// the second use" reasoning docs/standards/backend.md states outright (frontend.md's nearest
// equivalent is scoped to component reuse, not plain utilities, but the same principle applies
// here per docs/plans/031-jersey-numbers.md's Flag #2). Behavior is unchanged from the original
// inline copies.
export function numberToInput(value: number | null): string {
  return value === null ? '' : String(value)
}

export function inputToNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
