import { splitGuestName } from '../guestNameSplit'
import type { PersonName } from '../playerDisplayName'

// docs/specs/114-share-result.md (Initials only): the ONE function that turns a player's name into the label a shared
// result shows, in every format and every generated text. Pure; no React. Display-only: nothing here is stored.
//
//  - Off: initial plus surname, particles kept: "M. Naidoo", "S. van der Westhuizen".
//  - On : initial plus the initial of the surname's main part, particles dropped: "M. N.", "S. W.".
//  - A double or hyphenated first name contributes its first letter only.
//  - A name with no surname part (a one-word guest): "S." on, as typed off.

// Leading surname words that are not the main part of the surname. Same family as guestNameSplit's list, plus the
// registered-player forms ("den", "der", "ten", "ter", "het").
const PARTICLES = new Set([
  'van', 'von', 'de', 'du', 'le', 'la', 'di', 'da', 'vd', 'vander', 'vanden', 'der', 'den', 'ten', 'ter', 'dos', 'del',
  'della', 'het', "'t",
])

const clean = (text: string | null | undefined): string => (text ?? '').trim().replace(/\s+/g, ' ')

const firstLetter = (text: string): string => {
  const letter = Array.from(text.replace(/^[^\p{L}]+/u, ''))[0] ?? ''
  return letter.toLocaleUpperCase()
}

// "van der Westhuizen" -> "Westhuizen". A surname made only of particles keeps its last word.
function mainSurname(lastName: string): string {
  const words = lastName.split(' ').filter(Boolean)
  let start = 0
  while (start < words.length - 1 && PARTICLES.has(words[start].toLowerCase())) start += 1
  return words.slice(start).join(' ')
}

// The person's name as the share shows it; '' when there is no name at all.
export function shareName(person: PersonName, initialsOnly: boolean): string {
  const first = clean(person.firstName)
  const last = clean(person.lastName)
  if (!first && !last) return ''

  // One word only (a one-word guest arrives from splitGuestName as the surname).
  if (!first || !last) {
    const word = first || last
    return initialsOnly ? `${firstLetter(mainSurname(word))}.` : word
  }

  const initial = `${firstLetter(first)}.`
  return initialsOnly ? `${initial} ${firstLetter(mainSurname(last))}.` : `${initial} ${last}`
}

// A guest's typed name as a PersonName, split the way the rest of the product splits it (particle aware).
export function guestPersonName(displayName: string | null | undefined, id?: string | null): PersonName {
  return { id: id ?? null, ...splitGuestName(displayName) }
}

const identityOf = (person: PersonName): string =>
  person.id ?? `${clean(person.firstName)} ${clean(person.lastName)}`.trim().toLowerCase()

// The initials ("S. K.") that two or more DIFFERENT players of the result share, in order of first appearance. People
// are told apart by id (else by lower-cased full name), so one player listed twice does not collide with himself.
export function initialsCollisions(people: PersonName[]): string[] {
  const owners = new Map<string, Set<string>>()
  for (const person of people) {
    const initials = shareName(person, true)
    if (!initials) continue
    const set = owners.get(initials) ?? new Set<string>()
    set.add(identityOf(person))
    owners.set(initials, set)
  }
  return [...owners].filter(([, set]) => set.size > 1).map(([initials]) => initials)
}
