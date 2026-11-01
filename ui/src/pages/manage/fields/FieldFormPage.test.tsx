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

// docs/specs/099-fields-directory.md (5) and docs/specs/134
// Several tests type into many fields with userEvent, which is slow when the whole suite runs in parallel.
describe('FieldFormPage', { timeout: 20000 }, () => {
  describe('Add Field', () => {
    it('defaults Country from the browser time zone, with the hint that it can be changed', async () => {
      renderPage('/manage/fixtures/fields/new')

      expect(await screen.findByRole('heading', { name: 'Add Field' })).toBeInTheDocument()
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
      await user.click(screen.getByRole('button', { name: 'Create Field' }))

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
      await user.click(screen.getByRole('button', { name: 'Create Field' }))

      await waitFor(() => expect(createPlayingArea).toHaveBeenCalledWith('club-1', expect.anything(), true))
    })

    // docs/specs/133
    it('saves typed coordinates and an access point with its note, and blocks a half pair', async () => {
      const user = userEvent.setup()
      createPlayingArea.mockResolvedValue(makeField({ id: 'new-1' }))
      renderPage('/manage/fixtures/fields/new')
      await screen.findByRole('heading', { name: 'Add Field' })
      await fillRequired(user)
      await user.type(screen.getByLabelText('Latitude (optional)'), '-29.55')
      await user.click(screen.getByRole('button', { name: 'Create Field' }))
      expect(await screen.findByText('Enter the longitude too, or clear the latitude')).toBeInTheDocument()
      expect(createPlayingArea).not.toHaveBeenCalled()

      await user.type(screen.getByLabelText('Longitude (optional)'), '30.29')
      await user.click(screen.getByRole('button', { name: 'Entrance Or Parking' }))
      await user.type(screen.getByLabelText('Access latitude (optional)'), '-29.551')
      await user.type(screen.getByLabelText('Access longitude (optional)'), '30.291')
      await user.type(screen.getByLabelText('Access note (optional)'), 'Use gate 2')
      await user.click(screen.getByRole('button', { name: 'Create Field' }))

      await waitFor(() => expect(createPlayingArea).toHaveBeenCalledTimes(1))
      expect(createPlayingArea).toHaveBeenCalledWith(
        'club-1',
        expect.objectContaining({ latitude: -29.55, longitude: 30.29, accessLatitude: -29.551, accessLongitude: 30.291, accessNote: 'Use gate 2' }),
        false,
      )
    })

    it('treats the street as optional, and requires name, owner, city', async () => {
      const user = userEvent.setup()
      renderPage('/manage/fixtures/fields/new')
      await screen.findByRole('heading', { name: 'Add Field' })

      await user.click(screen.getByRole('button', { name: 'Create Field' }))

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
      await screen.findByRole('heading', { name: 'Add Field' })
      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Create Field' }))

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
      await screen.findByRole('heading', { name: 'Add Field' })
      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Create Field' }))

      expect(await screen.findByText('Map link must be https')).toBeInTheDocument()
    })

    it('Cancel and Back go to the Fields list', async () => {
      renderPage('/manage/fixtures/fields/new')
      expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/fields')
      expect(screen.getByRole('link', { name: /Back to Fields/ })).toHaveAttribute('href', '/manage/fixtures/fields')
    })

    it('has a footer with Cancel and a single filled button in the footer, labelled Create Field', async () => {
      renderPage('/manage/fixtures/fields/new')
      await screen.findByRole('heading', { name: 'Add Field' })

      const create = screen.getByRole('button', { name: 'Create Field' })
      expect(create).toHaveClass('MuiButton-contained')
      expect(create).toHaveAttribute('type', 'submit')
      expect(screen.getAllByRole('button').filter((button) => button.classList.contains('MuiButton-contained'))).toHaveLength(1)
      // the compact card's footer: Cancel (white outlined) sits before the one filled button
      expect(screen.getByRole('link', { name: 'Cancel' })).toHaveClass('MuiButton-outlined')
      expect(screen.queryByRole('button', { name: /Deactivate|Delete/ })).not.toBeInTheDocument()
    })

    it('Back, Cancel and Save honour a returnTo', async () => {
      const user = userEvent.setup()
      createPlayingArea.mockResolvedValue(makeField({ id: 'new-1' }))
      renderPage('/manage/fixtures/fields/new?returnTo=%2Fmanage%2Ffixtures%2Ffields%3Fx%3D1&returnLabel=Fields')

      expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/fields?x=1')
      expect(screen.getByRole('link', { name: /Back to Fields/ })).toHaveAttribute('href', '/manage/fixtures/fields?x=1')
      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Create Field' }))

      expect(await screen.findByText('At: /manage/fixtures/fields')).toBeInTheDocument()
    })

    it('ignores an invalid returnTo and saves to the new field\'s page', async () => {
      const user = userEvent.setup()
      createPlayingArea.mockResolvedValue(makeField({ id: 'new-1' }))
      renderPage('/manage/fixtures/fields/new?returnTo=https%3A%2F%2Fevil.example%2F&returnLabel=Evil')

      expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/fields')
      await fillRequired(user)
      await user.click(screen.getByRole('button', { name: 'Create Field' }))

      expect(await screen.findByText('At: /manage/fixtures/fields/new-1')).toBeInTheDocument()
    })
  })

  describe('Edit Field', () => {
    it('opens an unverified field this club captured, without the "our field" switch, and saves the update', async () => {
      const user = userEvent.setup()
      const field = makeField({ id: 'f-1', verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1', name: 'Hilton Oval' })
      getPlayingArea.mockResolvedValue(field)
      updatePlayingArea.mockResolvedValue(field)
      renderPage('/manage/fixtures/fields/f-1/edit')

      expect(await screen.findByRole('heading', { name: 'Edit Field' })).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('Hilton Oval')
      expect(screen.queryByRole('checkbox', { name: /one of our fields/ })).not.toBeInTheDocument()
      expect(findSimilarPlayingAreas).not.toHaveBeenCalled()

      await user.clear(screen.getByLabelText('Name'))
      await user.type(screen.getByLabelText('Name'), 'Hilton Oval 2')
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      await waitFor(() => expect(updatePlayingArea).toHaveBeenCalledWith('club-1', 'f-1', expect.objectContaining({ name: 'Hilton Oval 2' })))
      expect(await screen.findByText('At: /manage/fixtures/fields/f-1')).toBeInTheDocument()
    })

    it('the default Back of an edit is the field page', async () => {
      const field = makeField({ id: 'f-1', verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' })
      getPlayingArea.mockResolvedValue(field)
      updatePlayingArea.mockResolvedValue(field)
      renderPage('/manage/fixtures/fields/f-1/edit')
      expect(await screen.findByRole('link', { name: 'Back to Field' })).toHaveAttribute('href', '/manage/fixtures/fields/f-1')
    })

    it('Save returns to the origin when there is a returnTo', async () => {
      const user = userEvent.setup()
      const field = makeField({ id: 'f-1', verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' })
      getPlayingArea.mockResolvedValue(field)
      updatePlayingArea.mockResolvedValue(field)
      renderPage('/manage/fixtures/fields/f-1/edit?returnTo=%2Fmanage%2Ffixtures%2Ffields&returnLabel=Fields')

      expect(await screen.findByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/manage/fixtures/fields')
      await user.click(screen.getByRole('button', { name: 'Save Changes' }))

      expect(await screen.findByText('At: /manage/fixtures/fields')).toBeInTheDocument()
    })

    it('opens a verified field read-only with the reason and no Save', async () => {
      getPlayingArea.mockResolvedValue(makeField({ verificationStatus: 'VERIFIED' }))
      renderPage('/manage/fixtures/fields/field-1/edit')

      expect(await screen.findByText('Only a platform admin can change a verified field.')).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
    })

    it('opens another club\'s unverified field read-only', async () => {
      getPlayingArea.mockResolvedValue(makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-2' }))
      renderPage('/manage/fixtures/fields/field-1/edit')

      expect(await screen.findByText(/club that captured this field/)).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
    })

    it('shows an error when the field cannot be loaded', async () => {
      getPlayingArea.mockRejectedValue(new Error('boom'))
      renderPage('/manage/fixtures/fields/f-1/edit')
      expect(await screen.findByText("Couldn't load this field")).toBeInTheDocument()
    })
  })
})
