import { formatDateOfBirth } from '../../../utils/playerFormat'

// docs/specs/119 Part 3: wording helpers for the link request cards.
export function waitingText(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return 'Not recorded'
  const minutes = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 60000))
  if (minutes < 60) return 'Less than an hour'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export function bornText(dateOfBirth: string, age: number | null): string {
  const born = formatDateOfBirth(dateOfBirth)
  return age === null ? born : `${born} (age ${age})`
}

export function countText(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

// docs/specs/119: a name-only suggestion whose stored date of birth differs from the typed one.
export function dobDiffers(request: { typedDateOfBirth: string; suggestedPlayer?: { exactMatch?: boolean } | null }): boolean {
  return request.suggestedPlayer?.exactMatch === false
}

export function dobDiffersText(typedDateOfBirth: string): string {
  return `Date of birth differs from the request (${formatDateOfBirth(typedDateOfBirth)}). Check before approving.`
}
