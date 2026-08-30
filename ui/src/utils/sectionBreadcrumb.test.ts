import { describe, expect, it } from 'vitest'
import { breadcrumbFor } from './sectionBreadcrumb'
import type { Section } from '../api/sectionApi'

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    clubId: 'club-1',
    parentSectionId: null,
    name: 'Section',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

describe('breadcrumbFor', () => {
  it('returns an empty trail for a root section with no parent', () => {
    const root = makeSection({ id: 'root', name: 'Juniors', parentSectionId: null })
    const sectionsById = new Map([[root.id, root]])

    expect(breadcrumbFor(root, sectionsById)).toEqual([])
  })

  it('returns a root-first trail of ancestor names for a deeply-nested section', () => {
    const juniors = makeSection({ id: 'juniors', name: 'Juniors', parentSectionId: null })
    const boys = makeSection({ id: 'boys', name: 'Boys', parentSectionId: 'juniors' })
    const o15 = makeSection({ id: 'o15', name: 'O/15', parentSectionId: 'boys' })
    const sectionsById = new Map([
      [juniors.id, juniors],
      [boys.id, boys],
      [o15.id, o15],
    ])

    expect(breadcrumbFor(o15, sectionsById)).toEqual(['Juniors', 'Boys'])
  })

  it('returns just the immediate parent for a one-level-deep section', () => {
    const juniors = makeSection({ id: 'juniors', name: 'Juniors', parentSectionId: null })
    const boys = makeSection({ id: 'boys', name: 'Boys', parentSectionId: 'juniors' })
    const sectionsById = new Map([
      [juniors.id, juniors],
      [boys.id, boys],
    ])

    expect(breadcrumbFor(boys, sectionsById)).toEqual(['Juniors'])
  })

  it('stops walking (without throwing) when a parentSectionId points at a section missing from the map', () => {
    const orphan = makeSection({ id: 'orphan', name: 'Orphan', parentSectionId: 'missing-parent' })
    const sectionsById = new Map([[orphan.id, orphan]])

    expect(breadcrumbFor(orphan, sectionsById)).toEqual([])
  })
})
