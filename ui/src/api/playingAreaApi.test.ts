import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import {
  createPlayingArea,
  findSimilarPlayingAreas,
  getPlayingArea,
  getPlayingAreasSummary,
  linkPlayingAreaHome,
  listPlayingAreaFilterOptions,
  listPlayingAreas,
  playingAreasKey,
  playingAreasSummaryKey,
  unlinkPlayingAreaHome,
  updatePlayingArea,
} from './playingAreaApi'
import type { PlayingAreaPayload } from './playingAreaApi'
import { fieldPage, makeField } from '../test/fieldFixtures'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const put = vi.mocked(api.put)
const del = vi.mocked(api.delete)

const BASE = '/manage/clubs/club-1/playing-areas'

beforeEach(() => {
  vi.resetAllMocks()
})

// docs/specs/099-fields-directory.md
describe('playingAreaApi', () => {
  it('lists with paging and the cricket-field area type, sending only the filters that are set', async () => {
    get.mockResolvedValue({ data: fieldPage([makeField()]) })

    await listPlayingAreas('club-1')
    expect(get).toHaveBeenLastCalledWith(BASE, { params: { page: 0, size: 20, areaType: 'CRICKET_FIELD' } })

    await listPlayingAreas('club-1', {
      page: 2,
      size: 5,
      q: 'river',
      category: 'SCHOOL',
      country: 'ZA',
      province: '',
      city: undefined,
      verification: 'UNVERIFIED',
      mine: true,
      sort: 'name,desc',
    })
    expect(get).toHaveBeenLastCalledWith(BASE, {
      params: { page: 2, size: 5, areaType: 'CRICKET_FIELD', q: 'river', category: 'SCHOOL', country: 'ZA', verification: 'UNVERIFIED', mine: true, sort: 'name,desc' },
    })
  })

  it('sends usedByClub only when true', async () => {
    get.mockResolvedValue({ data: fieldPage([]) })
    await listPlayingAreas('club-1', { usedByClub: true })
    expect(get).toHaveBeenLastCalledWith(BASE, { params: { page: 0, size: 20, areaType: 'CRICKET_FIELD', usedByClub: true } })
    await listPlayingAreas('club-1', { usedByClub: false })
    expect(get).toHaveBeenLastCalledWith(BASE, { params: { page: 0, size: 20, areaType: 'CRICKET_FIELD' } })
  })

  it('does not send mine=false (the unfiltered list)', async () => {
    get.mockResolvedValue({ data: fieldPage([]) })
    await listPlayingAreas('club-1', { mine: false })
    expect(get).toHaveBeenLastCalledWith(BASE, { params: { page: 0, size: 20, areaType: 'CRICKET_FIELD' } })
  })

  it('reads the summary and the filter options with the same filters and area type', async () => {
    get.mockResolvedValue({ data: { ourFields: 1, inDirectory: 5, unverified: 2 } })
    expect(await getPlayingAreasSummary('club-1', { q: 'x', city: 'Hilton' })).toEqual({ ourFields: 1, inDirectory: 5, unverified: 2 })
    expect(get).toHaveBeenLastCalledWith(`${BASE}/summary`, { params: { areaType: 'CRICKET_FIELD', q: 'x', city: 'Hilton' } })

    get.mockResolvedValue({ data: { countries: ['ZA'], provinces: [], cities: [] } })
    await listPlayingAreaFilterOptions('club-1', { country: 'ZA' })
    expect(get).toHaveBeenLastCalledWith(`${BASE}/filter-options`, { params: { areaType: 'CRICKET_FIELD', country: 'ZA' } })
  })

  it('looks up similar fields by name, city and country', async () => {
    get.mockResolvedValue({ data: [makeField()] })
    await findSimilarPlayingAreas('club-1', { name: 'Riverside', city: 'Hilton', country: 'ZA' })
    expect(get).toHaveBeenLastCalledWith(`${BASE}/similar`, { params: { areaType: 'CRICKET_FIELD', name: 'Riverside', city: 'Hilton', country: 'ZA' } })
  })

  it('gets one field', async () => {
    get.mockResolvedValue({ data: makeField({ id: 'f9' }) })
    expect((await getPlayingArea('club-1', 'f9')).id).toBe('f9')
    expect(get).toHaveBeenLastCalledWith(`${BASE}/f9`)
  })

  it('create never links the field home unless asked, and sends linkHome as a query parameter', async () => {
    post.mockResolvedValue({ data: makeField() })
    const payload = { name: 'X' } as PlayingAreaPayload

    await createPlayingArea('club-1', payload)
    expect(post).toHaveBeenLastCalledWith(BASE, payload, { params: { linkHome: false } })

    await createPlayingArea('club-1', payload, true)
    expect(post).toHaveBeenLastCalledWith(BASE, payload, { params: { linkHome: true } })
  })

  it('updates, links and unlinks', async () => {
    put.mockResolvedValue({ data: makeField() })
    const payload = { name: 'X' } as PlayingAreaPayload
    await updatePlayingArea('club-1', 'f1', payload)
    expect(put).toHaveBeenLastCalledWith(`${BASE}/f1`, payload)

    await linkPlayingAreaHome('club-1', 'f1')
    expect(put).toHaveBeenLastCalledWith(`${BASE}/f1/home`)
    await unlinkPlayingAreaHome('club-1', 'f1')
    expect(del).toHaveBeenLastCalledWith(`${BASE}/f1/home`)
  })

  it('keys every query under the club prefix so one invalidation refreshes the list, counters, picker and a single field', () => {
    expect(playingAreasKey('club-1')).toEqual(['managed-club', 'club-1', 'playing-areas'])
    expect(playingAreasSummaryKey('club-1', { q: 'x' }).slice(0, 3)).toEqual(playingAreasKey('club-1'))
  })
})
