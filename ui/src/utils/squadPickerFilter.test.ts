import { describe, expect, it } from 'vitest'
import type { Player } from '../api/playerApi'
import { filterSquadCandidates } from './squadPickerFilter'

const player = (id: string, firstName: string, lastName: string, sectionIds: string[]) => ({ id, firstName, lastName, sectionIds }) as Player

const players = [player('1', 'Jano', 'Van Der Westhuizen', ['u15']), player('2', 'Carl', 'Mellos', ['vet']), player('3', 'Anna', 'Mellos', ['u15', 'vet'])]

describe('filterSquadCandidates', () => {
  it('keeps everyone with no filters, sorted by last then first name', () => {
    expect(filterSquadCandidates(players, { search: '', sectionId: '' }).map((p) => p.id)).toEqual(['3', '2', '1'])
  })
  it('filters by section', () => {
    expect(filterSquadCandidates(players, { search: '', sectionId: 'u15' }).map((p) => p.id)).toEqual(['3', '1'])
  })
  it('searches part of either name, ignoring case', () => {
    expect(filterSquadCandidates(players, { search: ' mell ', sectionId: '' }).map((p) => p.id)).toEqual(['3', '2'])
    expect(filterSquadCandidates(players, { search: 'jan', sectionId: 'vet' })).toEqual([])
  })
})
