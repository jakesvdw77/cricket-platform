import { describe, expect, it } from 'vitest'
import type { Sponsor } from '../../api/sponsorApi'
import { inListOrder, offeredSponsors } from './sponsorOrder'

const sponsor = (id: string, patch: Partial<Sponsor> = {}): Sponsor =>
  ({ id, clubId: 'c', name: id, website: null, email: null, phone: null, logoUrl: `/media/${id}.png`, bannerUrl: null, socialLinks: [], active: true, createdAt: '', updatedAt: '', updatedBy: null, ...patch }) as Sponsor

// docs/specs/158: the main sponsor of a team leads, then the club's sponsors, then the team's others.
describe('offeredSponsors', () => {
  it('lists a team\'s main sponsor first, then the club sponsors, then the team\'s other sponsors', () => {
    const club = [sponsor('club-a'), sponsor('club-b')]
    const team = [sponsor('porsche', { main: true }), sponsor('surphics')]
    expect(offeredSponsors(club, team).map((s) => s.id)).toEqual(['porsche', 'club-a', 'club-b', 'surphics'])
  })

  it('lists each sponsor once, even when a club sponsor is also linked to the team', () => {
    const shared = sponsor('shared')
    expect(offeredSponsors([shared, sponsor('club-a')], [{ ...shared, main: true }]).map((s) => s.id)).toEqual(['shared', 'club-a'])
  })

  it('leaves out an inactive sponsor and one without a logo', () => {
    const list = offeredSponsors([sponsor('off', { active: false }), sponsor('nologo', { logoUrl: null }), sponsor('ok')], [])
    expect(list.map((s) => s.id)).toEqual(['ok'])
  })

  it('keeps the order of two teams\' main sponsors (a match of two club teams)', () => {
    expect(offeredSponsors([], [sponsor('a', { main: true }), sponsor('b'), sponsor('c', { main: true })]).map((s) => s.id)).toEqual(['a', 'c', 'b'])
  })
})

describe('inListOrder', () => {
  it('puts the chosen ids in the offered order, not the order they were ticked', () => {
    const offered = [sponsor('porsche'), sponsor('club-a'), sponsor('surphics')]
    expect(inListOrder(['surphics', 'porsche'], offered)).toEqual(['porsche', 'surphics'])
  })

  it('drops an id that is no longer offered', () => {
    expect(inListOrder(['gone', 'a'], [sponsor('a')])).toEqual(['a'])
  })
})
