import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminFieldFormPage from './AdminFieldFormPage'
import { makeField } from '../../../test/fieldFixtures'
import { problem } from '../../../test/publicAvailabilityTestUtils'

const getPlatformPlayingArea = vi.fn()
const updatePlatformPlayingArea = vi.fn()

vi.mock('../../../api/platformPlayingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/platformPlayingAreaApi')>()
  return {
    ...actual,
    getPlatformPlayingArea: (id: string) => getPlatformPlayingArea(id),
    updatePlatformPlayingArea: (id: string, payload: unknown) => updatePlatformPlayingArea(id, payload),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/fields/field-1/edit']}>
        <Routes>
          <Route path="/admin/fields/:fieldId/edit" element={<AdminFieldFormPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// docs/specs/099-fields-directory.md (9): the platform admin edits any field in any state.
describe('AdminFieldFormPage', () => {
  it('edits a verified field (a manager could not) with no Did you mean lookup, and returns to the field', async () => {
    const user = userEvent.setup()
    getPlatformPlayingArea.mockResolvedValue(makeField({ verificationStatus: 'VERIFIED', name: 'Hilton Oval' }))
    updatePlatformPlayingArea.mockResolvedValue(makeField())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Edit field' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeEnabled()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Hilton Oval Ground')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(updatePlatformPlayingArea).toHaveBeenCalledWith('field-1', expect.objectContaining({ name: 'Hilton Oval Ground' })))
    expect(await screen.findByText('At: /admin/fields/field-1')).toBeInTheDocument()
  })

  it('validates before saving', async () => {
    const user = userEvent.setup()
    getPlatformPlayingArea.mockResolvedValue(makeField())
    renderPage()
    await screen.findByRole('heading', { name: 'Edit field' })

    await user.clear(screen.getByLabelText('Name'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(updatePlatformPlayingArea).not.toHaveBeenCalled()
  })

  it('shows the server\'s message when saving fails', async () => {
    const user = userEvent.setup()
    getPlatformPlayingArea.mockResolvedValue(makeField())
    updatePlatformPlayingArea.mockRejectedValue(problem(400, { detail: 'Map link must be https' }))
    renderPage()
    await screen.findByRole('heading', { name: 'Edit field' })

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Map link must be https')).toBeInTheDocument()
  })

  it('shows an error when the field cannot be loaded', async () => {
    getPlatformPlayingArea.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByText("Couldn't load this field")).toBeInTheDocument()
  })
})
