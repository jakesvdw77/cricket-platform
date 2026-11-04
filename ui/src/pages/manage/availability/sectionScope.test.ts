import { describe, expect, it } from 'vitest'
import type { Section } from '../../../api/sectionApi'
import { sectionIdsUnder } from './sectionScope'

const section = (id: string, parentSectionId: string | null): Section =>
  ({ id, parentSectionId, name: id, clubId: 'c', minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null }) as Section

describe('sectionIdsUnder', () => {
  const tree = [section('boys', null), section('u13', 'boys'), section('u13a', 'u13'), section('girls', null)]

  it('includes the section and every section below it', () => {
    expect([...sectionIdsUnder(tree, 'boys')].sort()).toEqual(['boys', 'u13', 'u13a'])
  })

  it('leaves out siblings and parents', () => {
    expect([...sectionIdsUnder(tree, 'u13')].sort()).toEqual(['u13', 'u13a'])
    expect([...sectionIdsUnder(tree, 'girls')]).toEqual(['girls'])
  })
})
