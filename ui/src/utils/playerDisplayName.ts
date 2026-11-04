// docs/specs/101-match-results-our-side-scorecard.md (Player name display toggle), revised by docs/specs/138 (owner, 2026-11-05): the ONE
// function that turns a player's name into the label a scorecard screen shows. Pure; no React. Display-only: nothing here is stored.
//
//  - 'full'     : "First Last".
//  - 'initials' : the first initial plus the whole surname ("J. Smith", "S. van der Westhuizen"), the same form every shared result uses
//      (utils/share/shareName), so the page and the exports agree. A guest's typed name is split the same way. A one-word name shows
//      its initial ("S.").

import { shareName } from './share/shareName'

export type NameMode = 'full' | 'initials'

export interface PersonName {
  firstName: string
  lastName: string
  // Identity of the person within the view, so the same player listed twice (batting and bowling rows) counts once.
  // Falls back to the lower-cased full name.
  id?: string | null
}

const clean = (text: string | null | undefined): string => (text ?? '').trim().replace(/\s+/g, ' ')

// "Sam van der Westhuizen" -> first "Sam", last "van der Westhuizen". A single word has no surname.
export function splitName(fullName: string | null | undefined): PersonName {
  const parts = clean(fullName).split(' ').filter(Boolean)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

export function fullName(person: PersonName): string {
  return [clean(person.firstName), clean(person.lastName)].filter(Boolean).join(' ')
}

// The label of `person` in the given mode. `view` is kept in the signature for the callers; initials never depend on who else is shown.
export function playerDisplayName(_view: PersonName[], mode: NameMode, person: PersonName): string {
  return mode === 'initials' ? shareName(person, true) || clean(person.firstName) : fullName(person)
}

// The labels of a whole view at once: a function from a person to its label.
export function playerLabeler(view: PersonName[], mode: NameMode): (person: PersonName) => string {
  return (person) => playerDisplayName(view, mode, person)
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
