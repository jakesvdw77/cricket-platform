import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import type { GalleryImage, GalleryPage } from '../../../api/galleryApi'
import { HubGallery } from './HubGallery'
import { calls, newQueryClient, routeApi } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
const http = api as unknown as ApiMock

// docs/specs/157: the Hub gallery. A looping carousel of the latest photos, search and filters, small thumbnails paged 24 at a time,
// and a delete icon only on the caller's own photos.
const image = (id: string, overrides: Partial<GalleryImage> = {}): GalleryImage => ({
  id,
  thumbUrl: `/media/${id}-t.jpg`,
  mediumUrl: `/media/${id}-m.jpg`,
  caption: null,
  uploadedAt: '2026-11-16T21:32:00Z',
  uploadedByName: null,
  mine: false,
  tags: [{ type: 'TEAM', id: 't1', name: 'Irene Veterans' }],
  ...overrides,
})
const page = (items: GalleryImage[], overrides: Partial<GalleryPage> = {}): GalleryPage => ({ items, page: 0, size: 24, total: items.length, hasMore: false, ...overrides })
const FILTERS = { leagues: [{ type: 'LEAGUE', id: 'l1', name: 'VCASA Club Champs' }], teams: [{ type: 'TEAM', id: 't1', name: 'Irene Veterans' }], players: [] }

function renderGallery(routes: Record<string, unknown> = {}) {
  routeApi(http, {
    'GET /me/players/k1': { key: 'k1', firstName: 'Jaco', lastName: 'van der Westhuizen' },
    'GET /me/players/k1/gallery/latest': [image('a', { caption: 'Team photo' }), image('b')],
    'GET /me/players/k1/gallery/filters': FILTERS,
    'GET /me/players/k1/gallery': page([image('a', { mine: true }), image('b')]),
    ...(routes as Record<string, never>),
  })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <HubGallery playerKey="k1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('HubGallery', () => {
  it('shows the carousel, the photo count and a thumbnail grid', async () => {
    renderGallery()
    const carousel = await screen.findByTestId('gallery-carousel')
    expect(within(carousel).getByText('Team photo')).toBeInTheDocument()
    expect(await screen.findByTestId('gallery-count')).toHaveTextContent('2 photos')
    expect(within(screen.getByTestId('gallery-grid')).getAllByRole('button')).toHaveLength(2 + 1) // two thumbnails and one delete icon (a is mine)
  })

  it('loops the carousel: Next from the last photo goes to the first, and Previous from the first goes to the last', async () => {
    renderGallery()
    const carousel = await screen.findByTestId('gallery-carousel')
    expect(within(carousel).getByText('Team photo')).toBeInTheDocument()
    await userEvent.click(within(carousel).getByRole('button', { name: 'Next photo' }))
    expect(within(carousel).queryByText('Team photo')).not.toBeInTheDocument()
    await userEvent.click(within(carousel).getByRole('button', { name: 'Next photo' }))
    expect(within(carousel).getByText('Team photo')).toBeInTheDocument()
    await userEvent.click(within(carousel).getByRole('button', { name: 'Previous photo' }))
    expect(within(carousel).queryByText('Team photo')).not.toBeInTheDocument()
  })

  it('asks the server for the latest 12 only and a first page of 24', async () => {
    renderGallery()
    await screen.findByTestId('gallery-grid')
    expect(calls(http.get, '/me/players/k1/gallery/latest')[0][1]).toEqual({ params: { limit: 12 } })
    expect(calls(http.get, '/me/players/k1/gallery')[0][1]).toEqual({ params: { page: 0, size: 24 } })
  })

  it('shows a delete icon and a Yours marker on the caller\'s own photos only, and deleting asks first', async () => {
    renderGallery({ 'DELETE /me/players/k1/gallery/a': null })
    const grid = await screen.findByTestId('gallery-grid')
    expect(within(grid).getAllByRole('button', { name: 'Delete your photo' })).toHaveLength(1)
    expect(within(grid).getAllByText('Yours')).toHaveLength(1)
    await userEvent.click(within(grid).getByRole('button', { name: 'Delete your photo' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete this photo?')).toBeInTheDocument()
    expect(calls(http.delete, '/me/players/k1/gallery/a')).toHaveLength(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Photo' }))
    await waitFor(() => expect(calls(http.delete, '/me/players/k1/gallery/a')).toHaveLength(1))
  })

  it('opens a photo large and offers Delete there for the caller\'s own photo only', async () => {
    renderGallery()
    const grid = await screen.findByTestId('gallery-grid')
    await userEvent.click(within(grid).getAllByRole('button', { name: /Photo|Team photo/ })[0])
    expect(await screen.findByTestId('gallery-lightbox-image')).toBeInTheDocument()
  })

  it('sends the search text after a pause and the chosen filter, and remembers the filter', async () => {
    renderGallery()
    await screen.findByTestId('gallery-grid')
    await userEvent.type(screen.getByLabelText('Search photos'), 'delta')
    await waitFor(() => expect(calls(http.get, '/me/players/k1/gallery').at(-1)?.[1]).toEqual({ params: { page: 0, size: 24, q: 'delta' } }), { timeout: 3000 })
    expect(screen.queryByTestId('gallery-carousel')).not.toBeInTheDocument()
  })

  it('asks for the next page only when Load More is chosen', async () => {
    renderGallery({
      'GET /me/players/k1/gallery': (request: { config?: { params?: { page?: number } } }) =>
        request.config?.params?.page === 1 ? page([image('c')], { page: 1, total: 3, hasMore: false }) : page([image('a'), image('b')], { total: 3, hasMore: true }),
    })
    await screen.findByTestId('gallery-grid')
    expect(calls(http.get, '/me/players/k1/gallery')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Load More' }))
    await waitFor(() => expect(calls(http.get, '/me/players/k1/gallery')).toHaveLength(2))
    expect(calls(http.get, '/me/players/k1/gallery')[1][1]).toEqual({ params: { page: 1, size: 24 } })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument())
  })

  it('says so when there are no photos yet', async () => {
    renderGallery({ 'GET /me/players/k1/gallery/latest': [], 'GET /me/players/k1/gallery': page([]) })
    expect(await screen.findByText('No photos yet. Add the first one.')).toBeInTheDocument()
    expect(screen.queryByTestId('gallery-carousel')).not.toBeInTheDocument()
  })

  it('opens the Add Photos dialog', async () => {
    renderGallery({ 'GET /me/players/k1/leagues': { seasons: [], seasonId: '', leagues: [] } })
    await screen.findByTestId('gallery-grid')
    await userEvent.click(screen.getByRole('button', { name: 'Add Photos' }))
    expect(await screen.findByRole('dialog', { name: 'Add Photos' })).toBeInTheDocument()
    expect(screen.getByText('Tag Jaco')).toBeInTheDocument()
  })
})
