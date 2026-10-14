// The pure rules behind reordering a list of rows by id (docs/specs/076-team-selection.md, reused by the scorecard's
// batting and bowling order, docs/specs/101): moving a row up or down, and moving it to a typed position. Shared by
// hooks/useReorderableRows and components/PlayerRowMenu so the two cannot drift.

// The ids with `id` moved one place in `direction`, or null when it is not listed or already at that end.
export function moveId(ids: string[], id: string, direction: -1 | 1): string[] | null {
  const index = ids.indexOf(id)
  const target = index + direction
  if (index === -1 || target < 0 || target >= ids.length) return null
  const next = [...ids]
  next.splice(index, 1)
  next.splice(target, 0, id)
  return next
}

// The highest position `id` may be typed into: the listed rows (one more when `id` is not listed yet, since it would be
// added), capped by `maxPlaces` when the list has a limit; at least 1.
export function maxPositionFor(ids: string[], id: string, maxPlaces?: number | null): number {
  const listed = ids.includes(id)
  const wanted = ids.length + (listed ? 0 : 1)
  return Math.max(1, maxPlaces == null ? wanted : Math.min(maxPlaces, wanted))
}

// The ids with `id` placed at the typed 1-based position (clamped to 1..max), or null when the text is not a number or
// the row is already there.
export function placeAtPosition(ids: string[], id: string, text: string, maxPlaces?: number | null): string[] | null {
  const parsed = Number(text)
  if (text.trim() === '' || !Number.isFinite(parsed)) return null
  const target = Math.min(Math.max(Math.trunc(parsed), 1), maxPositionFor(ids, id, maxPlaces))
  if (ids.indexOf(id) === target - 1) return null
  const next = ids.filter((candidate) => candidate !== id)
  next.splice(target - 1, 0, id)
  return next
}

// The ids after dropping `id` at slot `index` among the rows as drawn (0..ids.length), or null when nothing changes (or
// a new row would exceed `maxPlaces`).
export function placeAtSlot(ids: string[], id: string, index: number, maxPlaces?: number | null): string[] | null {
  const from = ids.indexOf(id)
  const full = maxPlaces != null && ids.length >= maxPlaces
  if (from === -1 && full) return null
  const target = from !== -1 && from < index ? index - 1 : index
  if (from === target) return null
  const next = ids.filter((candidate) => candidate !== id)
  next.splice(target, 0, id)
  return next
}
