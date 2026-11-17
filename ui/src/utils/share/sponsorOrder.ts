import type { Sponsor } from '../../api/sponsorApi'

// docs/specs/158-main-sponsor.md: the order a poster shows its sponsors in. The sponsors a share dialog offers are listed main sponsor
// first, so a manager's tick order no longer decides it: whatever is chosen is drawn in the list's order.

// Active sponsors with a logo, each once: the teams' main sponsors, then the club's sponsors, then the teams' other sponsors.
export function offeredSponsors(clubSponsors: Sponsor[], teamSponsors: Sponsor[]): Sponsor[] {
  const seen = new Set<string>()
  const list: Sponsor[] = []
  const add = (sponsor: Sponsor) => {
    if (!sponsor.active || !sponsor.logoUrl || seen.has(sponsor.id)) return
    seen.add(sponsor.id)
    list.push(sponsor)
  }
  teamSponsors.filter((sponsor) => sponsor.main).forEach(add)
  clubSponsors.forEach(add)
  teamSponsors.forEach(add)
  return list
}

// The chosen ids in the order of the offered list (an id the list does not offer is dropped).
export function inListOrder(ids: string[], offered: { id: string }[]): string[] {
  const chosen = new Set(ids)
  return offered.map((sponsor) => sponsor.id).filter((id) => chosen.has(id))
}
