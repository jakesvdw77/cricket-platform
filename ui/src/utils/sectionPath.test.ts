import { describe, expect, it } from 'vitest'
import type { Section } from '../api/sectionApi'
import { sectionPath } from './sectionPath'

const section = (id: string, name: string, parentSectionId: string | null): Section => ({
  id, clubId: 'c', parentSectionId, name, minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null,
})

describe('sectionPath', () => {
  const tree = [section('s', 'Seniors', null), section('u', 'Under 15', 's'), section('x', 'Girls', 'u')]

  it('joins a section with its parents, root first', () => {
    expect(sectionPath(tree, 'x')).toBe('Seniors > Under 15 > Girls')
    expect(sectionPath(tree, 's')).toBe('Seniors')
  })

  it('is empty for an unknown or missing section', () => {
    expect(sectionPath(tree, 'nope')).toBe('')
    expect(sectionPath(tree, null)).toBe('')
  })

  it('stops on a loop in the data', () => {
    expect(sectionPath([section('a', 'A', 'b'), section('b', 'B', 'a')], 'a')).toBe('B > A')
  })
})
