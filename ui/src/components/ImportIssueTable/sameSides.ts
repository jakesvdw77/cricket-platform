import type { ImportEditLayout } from './ImportRowEdit'

// Case-insensitive, trimmed, inner spaces collapsed.
export const squash = (value: string | undefined) => (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

// Whether the two sides of the layout's differentPair hold the same name (empty never counts): a team cannot play itself.
export function playsItself(values: Record<string, string>, layout?: ImportEditLayout): boolean {
  const pair = layout?.differentPair
  return Boolean(pair) && squash(values[pair![0]]) !== '' && squash(values[pair![0]]) === squash(values[pair![1]])
}
