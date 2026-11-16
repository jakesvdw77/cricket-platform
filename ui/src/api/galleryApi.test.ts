import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { deleteGalleryPhoto, getGalleryFilters, getGalleryLatest, getGalleryPage, uploadGalleryPhoto } from './galleryApi'
import type { GalleryScope } from './galleryApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
const http = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }

const hub: GalleryScope = { kind: 'hub', playerKey: 'k1' }
const club: GalleryScope = { kind: 'club', clubId: 'c1' }
const blob = (text: string) => new Blob([text], { type: 'image/jpeg' })

// docs/specs/157: one shape for two scopes, a page of 24 at most, one photo per upload request.
beforeEach(() => {
  vi.clearAllMocks()
  http.get.mockResolvedValue({ data: {} })
  http.post.mockResolvedValue({ data: {} })
  http.delete.mockResolvedValue({ data: undefined })
})

describe('galleryApi', () => {
  it('reads a page from the Hub or the manager path, sending only the filters that are set', async () => {
    await getGalleryPage(hub, { q: ' delta ', leagueId: 'l1', teamId: null, playerId: null }, 2, 24)
    expect(http.get).toHaveBeenLastCalledWith('/me/players/k1/gallery', { params: { page: 2, size: 24, q: 'delta', leagueId: 'l1' } })
    await getGalleryPage(club, { q: '', leagueId: null, teamId: 't1', playerId: 'p1' }, 0, 24)
    expect(http.get).toHaveBeenLastCalledWith('/manage/clubs/c1/gallery', { params: { page: 0, size: 24, teamId: 't1', playerId: 'p1' } })
  })

  it('reads the latest photos with a limit and the filter options', async () => {
    await getGalleryLatest(hub, 12)
    expect(http.get).toHaveBeenLastCalledWith('/me/players/k1/gallery/latest', { params: { limit: 12 } })
    await getGalleryFilters(club)
    expect(http.get).toHaveBeenLastCalledWith('/manage/clubs/c1/gallery/filters')
  })

  it('uploads one photo as a medium and a thumbnail, the Hub tagging its held player and a manager listing players', async () => {
    await uploadGalleryPhoto(hub, { medium: blob('m'), thumb: blob('t') }, { caption: ' Team ', leagueId: 'l1', teamId: null, playerIds: ['p9'], tagMyPlayer: true })
    const hubForm = http.post.mock.calls[0][1] as FormData
    expect(http.post.mock.calls[0][0]).toBe('/me/players/k1/gallery')
    expect(hubForm.get('caption')).toBe('Team')
    expect(hubForm.get('leagueId')).toBe('l1')
    expect(hubForm.get('teamId')).toBeNull()
    expect(hubForm.get('tagMyPlayer')).toBe('true')
    expect(hubForm.getAll('playerId')).toEqual([])
    expect(hubForm.get('medium')).toBeInstanceOf(Blob)
    expect(hubForm.get('thumb')).toBeInstanceOf(Blob)

    await uploadGalleryPhoto(club, { medium: blob('m'), thumb: blob('t') }, { caption: '', leagueId: null, teamId: 't1', playerIds: ['p1', 'p2'], tagMyPlayer: true })
    const clubForm = http.post.mock.calls[1][1] as FormData
    expect(http.post.mock.calls[1][0]).toBe('/manage/clubs/c1/gallery')
    expect(clubForm.get('caption')).toBeNull()
    expect(clubForm.get('tagMyPlayer')).toBeNull()
    expect(clubForm.getAll('playerId')).toEqual(['p1', 'p2'])
  })

  it('deletes a photo by id on either path', async () => {
    await deleteGalleryPhoto(hub, 'i1')
    expect(http.delete).toHaveBeenLastCalledWith('/me/players/k1/gallery/i1')
    await deleteGalleryPhoto(club, 'i2')
    expect(http.delete).toHaveBeenLastCalledWith('/manage/clubs/c1/gallery/i2')
  })
})
