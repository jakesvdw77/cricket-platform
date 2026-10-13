import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FieldFormPage from './FieldFormPage'
import { makeField } from '../../../test/fieldFixtures'
import { problem } from '../../../test/publicAvailabilityTestUtils'

const getPlayingArea = vi.fn()
const createPlayingArea = vi.fn()
const updatePlayingArea = vi.fn()
const linkPlayingAreaHome = vi.fn()
const findSimilarPlayingAreas = vi.fn()

vi.mock('../../../api/playingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/playingAreaApi')>()
  return {
    ...actual,
    getPlayingArea: (clubId: string, id: string) => getPlayingArea(clubId, id),
    createPlayingArea: (clubId: string, payload: unknown, linkHome?: boolean) => createPlayingArea(clubId, payload, linkHome),
    updatePlayingArea: (clubId: string, id: string, payload: unknown) => updatePlayingArea(clubId, id, payload),
    linkPlayingAreaHome: (clubId: string, id: string) => linkPlayingAreaHome(clubId, id),
    findSimilarPlayingAreas: (clubId: string, params: unknown) => findSimilarPlayingAreas(clubId, params),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  findSimilarPlayingAreas.mockResolvedValue([])
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Africa/Johannesburg' } as Intl.ResolvedDateTimeFormatOptions)
})

afterEach(() => vi.restoreAllMocks())

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

function renderPage(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="/manage/fixtures/fields/new" element={<FieldFormPage />} />
            <Route path="/manage/fixtures/fields/:fieldId/edit" element={<FieldFormPage />} />
          </Route>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Hilton Oval')
  await user.type(screen.getByLabelText('Owner'), 'Hilton College')
  await user.type(screen.getByLabelText('City'), 'Hilton')
}

// docs/specs/099-fields-directory.md (5)
// Several tests type into many fields with userEvent, which is slow when the whole suite runs in parallel.
describe('FieldFormPage', { timeout: 20000 }, () => {
  describe('Add field', () => {
    it('defaults Country from the browser time zone, with the hint that it can be changed', async () => {
      renderPage('/manage/fixtures/fields/new')

      expect(await screen.findByRole('heading', { name: 'Add field' })).toBeInTheDocument()
      expect(screen.getByLabelText('Country')).toHaveTextContent('South Africa')
      expect(screen.getByText('Chosen from your browser. Change it if it is wrong.')).toBeInTheDocument()
    })

    it('has the "one of our fields" switch off by default, and a new field is created without linking it home', async () => {
      const user = userEvent.setup()
      createPlayingArea.mockResolvedValue(makeField({ id: 'new-1' }))
      renderPage('/manage/fixtures/fields/new')

      const ownSwitch = await screen.findByRole('checkbox', { name: /This is one of our fields/ })
      expect(ownSwitch).not.toBeChecked()
      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Add field' }))

      await waitFor(() => expect(createPlayingArea).toHaveBeenCalledTimes(1))
      expect(createPlayingArea).toHaveBeenCalledWith('club-1', expect.objectContaining({ name: 'Hilton Oval', ownerName: 'Hilton College' }), false)
      expect(await screen.findByText('At: /manage/fixtures/fields/new-1')).toBeInTheDocument()
    })

    it('sends linkHome=true only when the manager turned the switch on', async () => {
      const user = userEvent.setup()
      createPlayingArea.mockResolvedValue(makeField({ id: 'new-1' }))
      renderPage('/manage/fixtures/fields/new')

      await user.click(await screen.findByRole('checkbox', { name: /This is one of our fields/ }))
      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Add field' }))

      await waitFor(() => expect(createPlayingArea).toHaveBeenCalledWith('club-1', expect.anything(), true))
    })

    it('treats the street as optional, and requires name, owner, city', async () => {
      const user = userEvent.setup()
      renderPage('/manage/fixtures/fields/new')
      await screen.findByRole('heading', { name: 'Add field' })

      await user.click(screen.getByRole('button', { name: 'Add field' }))

      expect(await screen.findByText('Name is required')).toBeInTheDocument()
      expect(screen.getByText('Owner is required')).toBeInTheDocument()
      expect(screen.getByText('City is required')).toBeInTheDocument()
      expect(screen.queryByText('Street is required')).not.toBeInTheDocument()
      expect(createPlayingArea).not.toHaveBeenCalled()
    })

    it('on a 409 duplicate offers the existing field, and Use this field only opens it, never linking the club', async () => {
      const user = userEvent.setup()
      const existing = makeField({ id: 'dup-1', name: 'Hilton Oval' })
      createPlayingArea.mockRejectedValue(problem(409, { existingPlayingAreaId: 'dup-1' }))
      getPlayingArea.mockResolvedValue(existing)
      renderPage('/manage/fixtures/fields/new')
      await screen.findByRole('heading', { name: 'Add field' })
      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Add field' }))

      const panel = await screen.findByRole('region', { name: 'Did you mean' })
      expect(within(panel).getByText('This field already exists.')).toBeInTheDocument()
      await user.click(within(panel).getByRole('button', { name: 'Use this field' }))

      expect(await screen.findByText('At: /manage/fixtures/fields/dup-1')).toBeInTheDocument()
      expect(linkPlayingAreaHome).not.toHaveBeenCalled()
    })

    it('shows the server\'s message when saving fails for another reason', async () => {
      const user = userEvent.setup()
      createPlayingArea.mockRejectedValue(problem(400, { detail: 'Map link must be https' }))
      renderPage('/manage/fixtures/fields/new')
      await screen.findByRole('heading', { name: 'Add field' })
      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Add field' }))

      expect(await screen.findByText('Map link must be https')).toBeInTheDocument()
    })

    it('Cancel goes back to the Fields list', async () => {
      renderPage('/manage/fixtures/fields/new')
      expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/fields')
    })
  })

  describe('Edit field', () => {
    it('opens an unverified field this club captured, without the "our field" switch, and saves the update', async () => {
      const user = userEvent.setup()
      const field = makeField({ id: 'f-1', verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1', name: 'Hilton Oval' })
      getPlayingArea.mockResolvedValue(field)
      updatePlayingArea.mockResolvedValue(field)
      renderPage('/manage/fixtures/fields/f-1/edit')

      expect(await screen.findByRole('heading', { name: 'Edit field' })).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('Hilton Oval')
      expect(screen.queryByRole('checkbox', { name: /one of our fields/ })).not.toBeInTheDocument()
      expect(findSimilarPlayingAreas).not.toHaveBeenCalled()

      await user.clear(screen.getByLabelText('Name'))
      await user.type(screen.getByLabelText('Name'), 'Hilton Oval 2')
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      await waitFor(() => expect(updatePlayingArea).toHaveBeenCalledWith('club-1', 'f-1', expect.objectContaining({ name: 'Hilton Oval 2' })))
      expect(await screen.findByText('At: /manage/fixtures/fields/f-1')).toBeInTheDocument()
    })

    it('opens a verified field read-only with the reason and no Save', async () => {
      getPlayingArea.mockResolvedValue(makeField({ verificationStatus: 'VERIFIED' }))
      renderPage('/manage/fixtures/fields/field-1/edit')

      expect(await screen.findByText('Only a platform admin can change a verified field.')).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    })

    it('opens another club\'s unverified field read-only', async () => {
      getPlayingArea.mockResolvedValue(makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-2' }))
      renderPage('/manage/fixtures/fields/field-1/edit')

      expect(await screen.findByText(/club that captured this field/)).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    })

    it('shows an error when the field cannot be loaded', async () => {
      getPlayingArea.mockRejectedValue(new Error('boom'))
      renderPage('/manage/fixtures/fields/f-1/edit')
      expect(await screen.findByText("Couldn't load this field")).toBeInTheDocument()
    })
  })
})
