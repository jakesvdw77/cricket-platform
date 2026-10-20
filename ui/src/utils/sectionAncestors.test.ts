import { describe, expect, it } from 'vitest'
import type { Section } from '../api/sectionApi'
import { sectionsWithAncestors } from './sectionAncestors'

const section = (id: string, parentSectionId: string | null): Section => ({
  id, clubId: 'c', parentSectionId, name: id, minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null,
})

// club > seniors > firsts ; club > juniors > u15 > u15a ; unrelated
const all = [section('club', null), section('seniors', 'club'), section('firsts', 'seniors'), section('juniors', 'club'), section('u15', 'juniors'), section('u15a', 'u15'), section('other', null)]

describe('sectionsWithAncestors', () => {
  it('keeps the given sections plus every ancestor, in the club order', () => {
    expect(sectionsWithAncestors(all, ['u15a', 'firsts']).map((s) => s.id)).toEqual(['club', 'seniors', 'firsts', 'juniors', 'u15', 'u15a'])
  })

  it('leaves out siblings, descendants and unrelated sections', () => {
    expect(sectionsWithAncestors(all, ['u15']).map((s) => s.id)).toEqual(['club', 'juniors', 'u15'])
  })

  it('returns nothing for no ids and ignores unknown ids', () => {
    expect(sectionsWithAncestors(all, [])).toEqual([])
    expect(sectionsWithAncestors(all, ['ghost'])).toEqual([])
  })

  it('does not loop on a parent that is missing from the list', () => {
    expect(sectionsWithAncestors([section('orphan', 'gone')], ['orphan']).map((s) => s.id)).toEqual(['orphan'])
  })
})
