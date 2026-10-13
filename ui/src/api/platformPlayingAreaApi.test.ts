import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import {
  getPlatformPlayingArea,
  getPlatformPlayingAreasSummary,
  listPlatformPlayingAreas,
  mergePlayingArea,
  PLATFORM_FIELDS_KEY,
  platformFieldsSummaryKey,
  rejectPlayingArea,
  reopenPlayingArea,
  updatePlatformPlayingArea,
  verifyPlayingArea,
} from './platformPlayingAreaApi'
import type { PlayingAreaPayload } from './playingAreaApi'
import { fieldPage, makeField } from '../test/fieldFixtures'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const put = vi.mocked(api.put)

const BASE = '/platform/playing-areas'

beforeEach(() => {
  vi.resetAllMocks()
})

// docs/specs/099-fields-directory.md
describe('platformPlayingAreaApi', () => {
  it('lists the queue, sending only the filters that are set', async () => {
    get.mockResolvedValue({ data: fieldPage([makeField()]) })

    await listPlatformPlayingAreas()
    expect(get).toHaveBeenLastCalledWith(BASE, { params: { page: 0, size: 20 } })

    await listPlatformPlayingAreas({ page: 1, verification: 'REJECTED', q: 'oval', category: 'SCHOOL', country: 'ZA', sort: 'createdAt,desc' })
    expect(get).toHaveBeenLastCalledWith(BASE, {
      params: { page: 1, size: 20, verification: 'REJECTED', q: 'oval', category: 'SCHOOL', country: 'ZA', sort: 'createdAt,desc' },
    })
  })

  it('derives linkedClubCount from the linked clubs the server lists, per row', async () => {
    get.mockResolvedValue({
      data: fieldPage([
        makeField({ id: 'a', linkedClubs: [{ id: 'c1', name: 'One' }, { id: 'c2', name: 'Two' }] }),
        makeField({ id: 'b', linkedClubs: [] }),
        makeField({ id: 'c', linkedClubs: undefined }),
      ]),
    })

    const page = await listPlatformPlayingAreas()

    expect(page.content[0].linkedClubCount).toBe(2)
    expect(page.content[1].linkedClubCount).toBe(0)
    expect(page.content[2].linkedClubCount).toBeUndefined()
    expect(page.totalElements).toBe(3)
  })

  it('derives linkedClubCount on a single field and on every moderation result', async () => {
    const withClubs = makeField({ linkedClubs: [{ id: 'c1', name: 'One' }] })
    get.mockResolvedValue({ data: withClubs })
    expect((await getPlatformPlayingArea('f1')).linkedClubCount).toBe(1)
    expect(get).toHaveBeenLastCalledWith(`${BASE}/f1`)

    post.mockResolvedValue({ data: withClubs })
    put.mockResolvedValue({ data: withClubs })
    expect((await verifyPlayingArea('f1')).linkedClubCount).toBe(1)
    expect((await reopenPlayingArea('f1')).linkedClubCount).toBe(1)
    expect((await rejectPlayingArea('f1', 'dup')).linkedClubCount).toBe(1)
    expect((await mergePlayingArea('f1', 'f2')).linkedClubCount).toBe(1)
    expect((await updatePlatformPlayingArea('f1', {} as PlayingAreaPayload)).linkedClubCount).toBe(1)
  })

  it('posts verify, reopen, reject with a reason, and merge with the target id', async () => {
    post.mockResolvedValue({ data: makeField() })

    await verifyPlayingArea('f1')
    expect(post).toHaveBeenLastCalledWith(`${BASE}/f1/verify`)
    await reopenPlayingArea('f1')
    expect(post).toHaveBeenLastCalledWith(`${BASE}/f1/reopen`)
    await rejectPlayingArea('f1', 'Not a cricket field')
    expect(post).toHaveBeenLastCalledWith(`${BASE}/f1/reject`, { reason: 'Not a cricket field' })
    await mergePlayingArea('f1', 'f2')
    expect(post).toHaveBeenLastCalledWith(`${BASE}/f1/merge`, { targetPlayingAreaId: 'f2' })
  })

  it('edits and reads the summary', async () => {
    put.mockResolvedValue({ data: makeField() })
    const payload = { name: 'X' } as PlayingAreaPayload
    await updatePlatformPlayingArea('f1', payload)
    expect(put).toHaveBeenLastCalledWith(`${BASE}/f1`, payload)

    get.mockResolvedValue({ data: { unverified: 4, verified: 9, rejected: 1 } })
    expect(await getPlatformPlayingAreasSummary()).toEqual({ unverified: 4, verified: 9, rejected: 1 })
    expect(get).toHaveBeenLastCalledWith(`${BASE}/summary`)
  })

  it('keeps the summary key under the platform prefix', () => {
    expect(platformFieldsSummaryKey.slice(0, 2)).toEqual([...PLATFORM_FIELDS_KEY])
  })
})
