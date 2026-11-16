import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './axiosConfig'

// docs/specs/157-photo-gallery.md: the club photo gallery. Two scopes share one shape: the Player Hub (a held player's club,
// `/me/players/{playerKey}/gallery`) and a manager (`/manage/clubs/{clubId}/gallery`). Lists are always a page; the carousel
// is capped by the server. Mirrors GalleryImageDto, GalleryPageDto and GalleryFiltersDto.

export type GalleryTagType = 'LEAGUE' | 'TEAM' | 'PLAYER'

export interface GalleryTag {
  type: GalleryTagType
  id: string
  name: string
}

export interface GalleryImage {
  id: string
  thumbUrl: string
  mediumUrl: string
  caption: string | null
  uploadedAt: string
  // Managers only.
  uploadedByName: string | null
  mine: boolean
  tags: GalleryTag[]
}

export interface GalleryPage {
  items: GalleryImage[]
  page: number
  size: number
  total: number
  hasMore: boolean
}

export interface GalleryFilterOptions {
  leagues: GalleryTag[]
  teams: GalleryTag[]
  players: GalleryTag[]
}

export interface GalleryParams {
  q: string
  leagueId: string | null
  teamId: string | null
  playerId: string | null
}

export type GalleryScope = { kind: 'hub'; playerKey: string } | { kind: 'club'; clubId: string }

export const GALLERY_PAGE_SIZE = 24
export const GALLERY_CAROUSEL_LIMIT = 12
export const GALLERY_MAX_FILES = 10
export const EMPTY_GALLERY_PARAMS: GalleryParams = { q: '', leagueId: null, teamId: null, playerId: null }

const basePath = (scope: GalleryScope) => (scope.kind === 'hub' ? `/me/players/${scope.playerKey}/gallery` : `/manage/clubs/${scope.clubId}/gallery`)
const scopeId = (scope: GalleryScope) => (scope.kind === 'hub' ? scope.playerKey : scope.clubId)
const galleryKey = (scope: GalleryScope) => ['gallery', scope.kind, scopeId(scope)] as const

export const galleryKeys = {
  all: galleryKey,
  page: (scope: GalleryScope, params: GalleryParams) => [...galleryKey(scope), 'page', params.q, params.leagueId, params.teamId, params.playerId] as const,
  latest: (scope: GalleryScope) => [...galleryKey(scope), 'latest'] as const,
  filters: (scope: GalleryScope) => [...galleryKey(scope), 'filters'] as const,
}

export async function getGalleryPage(scope: GalleryScope, params: GalleryParams, page: number, size: number): Promise<GalleryPage> {
  const query: Record<string, string | number> = { page, size }
  if (params.q.trim()) query.q = params.q.trim()
  if (params.leagueId) query.leagueId = params.leagueId
  if (params.teamId) query.teamId = params.teamId
  if (params.playerId) query.playerId = params.playerId
  const { data } = await api.get<GalleryPage>(basePath(scope), { params: query })
  return data
}

export async function getGalleryLatest(scope: GalleryScope, limit: number): Promise<GalleryImage[]> {
  const { data } = await api.get<GalleryImage[]>(`${basePath(scope)}/latest`, { params: { limit } })
  return data
}

export async function getGalleryFilters(scope: GalleryScope): Promise<GalleryFilterOptions> {
  const { data } = await api.get<GalleryFilterOptions>(`${basePath(scope)}/filters`)
  return data
}

export interface GalleryUploadTags {
  caption: string
  leagueId: string | null
  teamId: string | null
  // A manager tags players by id; the Hub only tags its held player.
  playerIds: string[]
  tagMyPlayer: boolean
}

// One photo per request (the browser makes the medium and the thumbnail), so a batch shows per photo progress and a failed photo
// can be sent again without the others.
export async function uploadGalleryPhoto(scope: GalleryScope, photo: { medium: Blob; thumb: Blob }, tags: GalleryUploadTags): Promise<GalleryImage> {
  const form = new FormData()
  form.append('medium', photo.medium, 'medium.jpg')
  form.append('thumb', photo.thumb, 'thumb.jpg')
  if (tags.caption.trim()) form.append('caption', tags.caption.trim())
  if (tags.leagueId) form.append('leagueId', tags.leagueId)
  if (tags.teamId) form.append('teamId', tags.teamId)
  if (scope.kind === 'hub') form.append('tagMyPlayer', String(tags.tagMyPlayer))
  else tags.playerIds.forEach((id) => form.append('playerId', id))
  const { data } = await api.post<GalleryImage>(basePath(scope), form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function deleteGalleryPhoto(scope: GalleryScope, imageId: string): Promise<void> {
  await api.delete(`${basePath(scope)}/${imageId}`)
}

// The photos, page by page: Load More asks the server for the next page and the pages are flattened here. Nothing is sliced in the browser.
export function useGallery(scope: GalleryScope | null, params: GalleryParams) {
  const query = useInfiniteQuery({
    queryKey: scope ? galleryKeys.page(scope, params) : ['gallery', 'none'],
    queryFn: ({ pageParam }) => getGalleryPage(scope as GalleryScope, params, pageParam, GALLERY_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: scope !== null,
    retry: false,
    placeholderData: keepPreviousData,
  })
  const pages = query.data?.pages ?? []
  return { ...query, total: pages[pages.length - 1]?.total ?? 0, items: pages.flatMap((page) => page.items) }
}

export function useGalleryLatest(scope: GalleryScope | null) {
  return useQuery({
    queryKey: scope ? galleryKeys.latest(scope) : ['gallery', 'none', 'latest'],
    queryFn: () => getGalleryLatest(scope as GalleryScope, GALLERY_CAROUSEL_LIMIT),
    enabled: scope !== null,
    retry: false,
  })
}

export function useGalleryFilters(scope: GalleryScope | null) {
  return useQuery({
    queryKey: scope ? galleryKeys.filters(scope) : ['gallery', 'none', 'filters'],
    queryFn: () => getGalleryFilters(scope as GalleryScope),
    enabled: scope !== null,
    retry: false,
  })
}

export function useDeleteGalleryPhoto(scope: GalleryScope) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageId: string) => deleteGalleryPhoto(scope, imageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: galleryKeys.all(scope) }),
  })
}

export function useUploadGalleryPhoto(scope: GalleryScope) {
  // The lists are refreshed once the whole batch is done (useInvalidateGallery), not after every photo.
  return useMutation({
    mutationFn: ({ photo, tags }: { photo: { medium: Blob; thumb: Blob }; tags: GalleryUploadTags }) => uploadGalleryPhoto(scope, photo, tags),
  })
}

export function useInvalidateGallery(scope: GalleryScope) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: galleryKeys.all(scope) })
}
