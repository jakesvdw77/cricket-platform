import type { RecordCardBadge } from '../components/RecordCard'
import type { LeagueContact } from '../api/leagueContactApi'

// docs/specs/054-league-contacts.md: identical fullName/badgeFor rules to
// SponsorContactList.tsx's same-named exports, relocated to a standalone module rather than a
// list-page export — League Contacts has no equivalent standalone list page to own them from.
// Three call sites share this: LeagueFormPage's Contacts tab, LeagueDetailPage's Contacts
// section, and LeagueContactDetailPage.
export function fullName(contact: LeagueContact): string {
  return `${contact.contact.firstName} ${contact.contact.lastName}`
}

export function badgeFor(contact: LeagueContact): RecordCardBadge | undefined {
  if (contact.isPrimary) {
    return { label: 'Primary', tone: 'positive' }
  }
  if (!contact.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}
