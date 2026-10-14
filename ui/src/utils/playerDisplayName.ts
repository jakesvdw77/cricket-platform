// docs/specs/101-match-results-our-side-scorecard.md (Player name display toggle): the ONE function that turns a
// player's name into the label a scorecard screen shows. Pure; no React. Display-only: nothing here is stored.
//
//  - 'full'  : "First Last".
//  - 'first' : the plain first name, plus a short surname tag only where two players in the SAME VIEW share a first name:
//      the first letter of the surname ("Sam V"); for a particle surname the particles' initials in lower case plus the
//      first letter of the main surname ("Sam vdW" for van der Westhuizen). If two tags still collide the tag lengthens
//      one letter at a time ("Sam Va", "Sam Vi"); as a last resort the full surname is shown.
//  - A guest's typed name is split the same way (first word is the first name, the rest the surname), and guests and
//    registered players collide with each other. A name with no surname (a one-word guest) has nothing to tag, so its
//    label is the name as typed.

export type NameMode = 'full' | 'first'

export interface PersonName {
  firstName: string
  lastName: string
  // Identity of the person within the view, so the same player listed twice (batting and bowling rows) counts once.
  // Falls back to the lower-cased full name.
  id?: string | null
}

const PARTICLES = new Set([
  'van', 'der', 'den', 'de', 'du', 'le', 'la', 'von', 'di', 'ten', 'ter', 'da', 'dos', 'del', 'della', 'het', "'t",
])

const clean = (text: string | null | undefined): string => (text ?? '').trim().replace(/\s+/g, ' ')

// "Sam van der Westhuizen" -> first "Sam", last "van der Westhuizen". A single word has no surname.
export function splitName(fullName: string | null | undefined): PersonName {
  const parts = clean(fullName).split(' ').filter(Boolean)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

export function fullName(person: PersonName): string {
  return [clean(person.firstName), clean(person.lastName)].filter(Boolean).join(' ')
}

interface SurnameParts {
  // The particles' initials in lower case: "van der" -> "vd".
  particleInitials: string
  // The main surname as code points: "Westhuizen".
  main: string[]
}

function surnameParts(lastName: string): SurnameParts {
  const tokens = clean(lastName).split(' ').filter(Boolean)
  let split = 0
  while (split < tokens.length - 1 && PARTICLES.has(tokens[split].toLowerCase())) split += 1
  const particleInitials = tokens
    .slice(0, split)
    .map((token) => Array.from(token)[0].toLowerCase())
    .join('')
  return { particleInitials, main: Array.from(tokens.slice(split).join(' ')) }
}

function tagOf(parts: SurnameParts, length: number): string {
  if (parts.main.length === 0) return ''
  const letters = parts.main.slice(0, length)
  letters[0] = letters[0].toUpperCase()
  return parts.particleInitials + letters.join('')
}

const identityOf = (person: PersonName): string => person.id ?? fullName(person).toLowerCase()
const firstKey = (person: PersonName): string => clean(person.firstName).toLowerCase()

// The label of every distinct person of the view in first-name mode, keyed by identity.
function firstNameLabels(view: PersonName[]): Map<string, string> {
  const distinct = new Map<string, PersonName>()
  for (const person of view) {
    if (!distinct.has(identityOf(person))) distinct.set(identityOf(person), person)
  }

  const groups = new Map<string, string[]>()
  for (const [identity, person] of distinct) {
    const key = firstKey(person)
    groups.set(key, [...(groups.get(key) ?? []), identity])
  }

  const labels = new Map<string, string>()
  for (const members of groups.values()) {
    if (members.length === 1) {
      labels.set(members[0], clean(distinct.get(members[0])?.firstName))
      continue
    }
    const parts = new Map(members.map((identity) => [identity, surnameParts(distinct.get(identity)?.lastName ?? '')]))
    const lengths = new Map(members.map((identity) => [identity, 1]))
    const fullSurname = new Set<string>()
    const tagFor = (identity: string) => tagOf(parts.get(identity) as SurnameParts, lengths.get(identity) as number)

    // Lengthen the colliding tags one letter at a time until they are all different.
    for (let guard = 0; guard < 200; guard += 1) {
      const byTag = new Map<string, string[]>()
      for (const identity of members) {
        if (fullSurname.has(identity)) continue
        const tag = tagFor(identity)
        if (tag === '') continue // nothing to tag: a name with no surname
        byTag.set(tag.toLowerCase(), [...(byTag.get(tag.toLowerCase()) ?? []), identity])
      }
      const colliding = [...byTag.values()].filter((identities) => identities.length > 1).flat()
      if (colliding.length === 0) break
      let lengthened = false
      for (const identity of colliding) {
        const own = parts.get(identity) as SurnameParts
        if ((lengths.get(identity) as number) < own.main.length) {
          lengths.set(identity, (lengths.get(identity) as number) + 1)
          lengthened = true
        }
      }
      if (!lengthened) {
        // Nothing left to lengthen: the full surname is the last resort.
        for (const identity of colliding) fullSurname.add(identity)
        break
      }
    }

    for (const identity of members) {
      const person = distinct.get(identity) as PersonName
      const first = clean(person.firstName)
      if (fullSurname.has(identity)) {
        labels.set(identity, fullName(person))
        continue
      }
      const tag = tagFor(identity)
      labels.set(identity, tag === '' ? first : `${first} ${tag}`)
    }
  }
  return labels
}

// The label of `person` in a view whose names are `view` (the person need not be listed in it). Mode 'full' ignores the
// view.
export function playerDisplayName(view: PersonName[], mode: NameMode, person: PersonName): string {
  if (mode === 'full') return fullName(person)
  const labels = firstNameLabels(view.some((candidate) => identityOf(candidate) === identityOf(person)) ? view : [...view, person])
  return labels.get(identityOf(person)) ?? clean(person.firstName)
}

// The labels of a whole view at once (one pass instead of one per row): a function from a person to its label.
export function playerLabeler(view: PersonName[], mode: NameMode): (person: PersonName) => string {
  if (mode === 'full') return fullName
  const labels = firstNameLabels(view)
  return (person) => labels.get(identityOf(person)) ?? playerDisplayName(view, mode, person)
}

// The name of a scorecard player: the registered player's first and last name, or a guest's typed name split the same
// way.
export function scorecardPersonName(player: {
  id?: string | null
  clientKey?: string | null
  playerProfileId?: string | null
  firstName?: string | null
  lastName?: string | null
  displayName?: string | null
}): PersonName {
  const id = player.playerProfileId ?? player.id ?? player.clientKey ?? null
  if (player.playerProfileId || (player.firstName && !player.displayName)) {
    return { id, firstName: player.firstName ?? '', lastName: player.lastName ?? '' }
  }
  return { id, ...splitName(player.displayName ?? fullName({ firstName: player.firstName ?? '', lastName: player.lastName ?? '' })) }
}
