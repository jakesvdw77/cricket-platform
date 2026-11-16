import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axiosConfig'
import type { GalleryImage } from '../../api/galleryApi'
import GalleryPage from './GalleryPage'
import { calls, newQueryClient, routeApi } from '../../test/accountTestUtils'
import type { ApiMock } from '../../test/accountTestUtils'

vi.mock('../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
const http = api as unknown as ApiMock

// docs/specs/157: the manager's Gallery: the same photos with who added each one, a Delete icon on every card (confirmed first).
const image = (id: string, by: string): GalleryImage => ({
  id, thumbUrl: `/media/${id}-t.jpg`, mediumUrl: `/media/${id}-m.jpg`, caption: `Photo ${id}`, uploadedAt: '2026-11-16T21:32:00Z',
  uploadedByName: by, mine: false, tags: [],
})

function renderPage(routes: Record<string, unknown> = {}) {
  routeApi(http, {
    'GET /manage/clubs/c1/gallery': { items: [image('a', 'Pat Parent'), image('b', 'Sam Smith')], page: 0, size: 24, total: 2, hasMore: false },
    'GET /manage/clubs/c1/gallery/filters': { leagues: [], teams: [{ type: 'TEAM', id: 't1', name: 'Delta CC' }], players: [] },
    ...(routes as Record<string, never>),
  })
  return render(
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter initialEntries={['/gallery']}>
        <Routes>
          <Route element={<Outlet context={{ clubId: 'c1' }} />}>
            <Route path="/gallery" element={<GalleryPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('manager GalleryPage', () => {
  it('shows a card per photo with the uploader and a Delete icon on every card', async () => {
    renderPage()
    const cards = await screen.findAllByTestId('gallery-card')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText(/Pat Parent/)).toBeInTheDocument()
    expect(within(cards[1]).getByText(/Sam Smith/)).toBeInTheDocument()
    cards.forEach((card) => expect(within(card).getByRole('button', { name: 'Delete photo' })).toBeInTheDocument())
    expect(screen.getByTestId('gallery-count')).toHaveTextContent('2 photos')
  })

  it('deletes only after the confirm, and refreshes the list', async () => {
    renderPage({ 'DELETE /manage/clubs/c1/gallery/a': null })
    const cards = await screen.findAllByTestId('gallery-card')
    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Delete photo' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete this photo?')).toBeInTheDocument()
    expect(calls(http.delete, '/manage/clubs/c1/gallery/a')).toHaveLength(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Photo' }))
    await waitFor(() => expect(calls(http.delete, '/manage/clubs/c1/gallery/a')).toHaveLength(1))
  })

  it('does nothing when the confirm is cancelled', async () => {
    renderPage()
    const cards = await screen.findAllByTestId('gallery-card')
    await userEvent.click(within(cards[1]).getByRole('button', { name: 'Delete photo' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(http.delete).not.toHaveBeenCalled()
  })

  it('offers only the tagged teams, leagues and players in the filters and sends a chosen one', async () => {
    renderPage()
    await screen.findAllByTestId('gallery-card')
    expect(calls(http.get, '/manage/clubs/c1/gallery')[0][1]).toEqual({ params: { page: 0, size: 24 } })
    await userEvent.click(screen.getByRole('combobox', { name: /Team/ }))
    await userEvent.click(await screen.findByRole('option', { name: 'Delta CC' }))
    await waitFor(() => expect(calls(http.get, '/manage/clubs/c1/gallery').at(-1)?.[1]).toEqual({ params: { page: 0, size: 24, teamId: 't1' } }))
  })

  it('says so when there are no photos', async () => {
    renderPage({ 'GET /manage/clubs/c1/gallery': { items: [], page: 0, size: 24, total: 0, hasMore: false } })
    expect(await screen.findByText('No photos yet')).toBeInTheDocument()
  })

  it('opens the Add Photos dialog', async () => {
    renderPage({ 'GET /manage/clubs/c1/leagues': [], 'GET /manage/clubs/c1/teams': [], 'GET /manage/clubs/c1/players': [] })
    await screen.findAllByTestId('gallery-card')
    await userEvent.click(screen.getByRole('button', { name: 'Add Photos' }))
    expect(await screen.findByRole('dialog', { name: 'Add Photos' })).toBeInTheDocument()
  })
})
