import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminFieldDetailPage from './AdminFieldDetailPage'
import type { PlatformPlayingArea } from '../../../api/platformPlayingAreaApi'
import { fieldPage, makeField } from '../../../test/fieldFixtures'
import { problem } from '../../../test/publicAvailabilityTestUtils'

const getPlatformPlayingArea = vi.fn()
const listPlatformPlayingAreas = vi.fn()
const mergePlayingArea = vi.fn()
const verifyPlayingArea = vi.fn()
const rejectPlayingArea = vi.fn()
const reopenPlayingArea = vi.fn()

vi.mock('../../../api/platformPlayingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/platformPlayingAreaApi')>()
  return {
    ...actual,
    getPlatformPlayingArea: (id: string) => getPlatformPlayingArea(id),
    listPlatformPlayingAreas: (params: unknown) => listPlatformPlayingAreas(params),
    mergePlayingArea: (id: string, targetId: string) => mergePlayingArea(id, targetId),
    verifyPlayingArea: (id: string) => verifyPlayingArea(id),
    rejectPlayingArea: (id: string, reason: string) => rejectPlayingArea(id, reason),
    reopenPlayingArea: (id: string) => reopenPlayingArea(id),
  }
})

const SOURCE: PlatformPlayingArea = makeField({
  id: 'dup-1',
  name: 'Hilton Oval (dup)',
  verificationStatus: 'UNVERIFIED',
  matchCount: 3,
  linkedClubs: [{ id: 'c1', name: 'Riverside CC' }, { id: 'c2', name: 'Oakfield CC' }],
  linkedClubCount: 2,
  possibleDuplicates: [{ id: 'keep-1', name: 'Hilton Oval' }],
})
const TARGET = makeField({ id: 'keep-1', name: 'Hilton Oval', verificationStatus: 'VERIFIED', ownerName: 'Hilton College', matchCount: 9 })
const FAR_AWAY = makeField({
  id: 'far-1',
  name: 'Hilton Oval Far',
  verificationStatus: 'VERIFIED',
  address: { number: null, street: null, city: 'Leeds', provinceState: null, country: 'GB', postalCode: null },
})

beforeEach(() => {
  vi.clearAllMocks()
  getPlatformPlayingArea.mockResolvedValue(SOURCE)
  listPlatformPlayingAreas.mockImplementation((params: { verification?: string }) =>
    Promise.resolve(fieldPage(params.verification === 'VERIFIED' ? [TARGET, FAR_AWAY, makeField({ id: 'dup-1', name: 'Hilton Oval (dup)' })] : [])),
  )
  mergePlayingArea.mockResolvedValue(TARGET)
  for (const fn of [verifyPlayingArea, rejectPlayingArea, reopenPlayingArea]) fn.mockResolvedValue({})
})

function LocationProbe() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

async function renderLoaded(field: PlatformPlayingArea = SOURCE) {
  getPlatformPlayingArea.mockResolvedValue(field)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/fields/${field.id}`]}>
        <LocationProbe />
        <Routes>
          <Route path="/admin/fields/:fieldId" element={<AdminFieldDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: field.name })
}

// An option's name is its name, place and details run together.
const KEEP = /^Hilton Oval\s*Hilton,/
const FAR = /^Hilton Oval Far/

async function openMergeAndPick(user: ReturnType<typeof userEvent.setup>, target: RegExp) {
  await user.click(screen.getByRole('button', { name: 'Merge into...' }))
  const dialog = await screen.findByRole('dialog', { name: 'Merge into another field' })
  await user.click(within(dialog).getByLabelText('Field to keep'))
  await user.click(await screen.findByRole('option', { name: target }))
  return dialog
}

// docs/specs/099-fields-directory.md (9)
describe('AdminFieldDetailPage', () => {
  it('shows the admin key figures (clubs using it), the clubs on the Details card and the possible duplicates', async () => {
    await renderLoaded()

    expect(screen.getByTestId('field-figure-clubs')).toHaveTextContent('2')
    expect(screen.getByTestId('field-figure-matches')).toHaveTextContent('3')
    expect(screen.getByText('Riverside CC, Oakfield CC')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hilton Oval' })).toHaveAttribute('href', '/admin/fields/keep-1')
    expect(screen.getByTestId('field-status-notice')).toHaveTextContent('Check the details, then verify or reject it.')
  })

  it('has Edit (always enabled), Merge into... and Status', async () => {
    await renderLoaded(makeField({ verificationStatus: 'VERIFIED' }) as PlatformPlayingArea)

    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/admin/fields/field-1/edit')
    expect(screen.getByRole('button', { name: 'Merge into...' })).toBeEnabled()
  })

  it('Status lists Verify and Reject… for an unverified field, and Verify acts at once', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Status' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Verify', 'Reject…'])
    await user.click(screen.getByRole('menuitem', { name: 'Verify' }))

    await waitFor(() => expect(verifyPlayingArea).toHaveBeenCalledWith('dup-1'))
  })

  it('has a Verify button on the notice of an unverified field', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(within(screen.getByTestId('field-status-notice')).getByRole('button', { name: 'Verify' }))

    await waitFor(() => expect(verifyPlayingArea).toHaveBeenCalledWith('dup-1'))
  })

  it('disables Status, with a tooltip, for a verified field; a rejected one offers Reopen', async () => {
    await renderLoaded({ ...SOURCE, verificationStatus: 'VERIFIED' })
    const status = screen.getByRole('button', { name: 'Status' })
    expect(status).toBeDisabled()
    expect(status.closest('span[title]')).toHaveAttribute('title', 'A verified field has no status changes.')
  })

  it('a rejected field offers only Reopen', async () => {
    const user = userEvent.setup()
    await renderLoaded({ ...SOURCE, verificationStatus: 'REJECTED', rejectionReason: 'Duplicate' })

    await user.click(screen.getByRole('button', { name: 'Status' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Reopen'])
    await user.click(screen.getByRole('menuitem', { name: 'Reopen' }))
    await waitFor(() => expect(reopenPlayingArea).toHaveBeenCalledWith('dup-1'))
  })

  it('Reject needs a reason', async () => {
    const user = userEvent.setup()
    await renderLoaded()

    await user.click(screen.getByRole('button', { name: 'Status' }))
    await user.click(screen.getByRole('menuitem', { name: /Reject/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Reject this field?' })
    expect(within(dialog).getByRole('button', { name: 'Reject field' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText(/Reason for rejecting/), 'Spam')
    await user.click(within(dialog).getByRole('button', { name: 'Reject field' }))

    await waitFor(() => expect(rejectPlayingArea).toHaveBeenCalledWith('dup-1', 'Spam'))
  })

  describe('Merge into...', () => {
    it('searches verified and unverified fields except itself, and shows both fields side by side once one is picked', async () => {
      const user = userEvent.setup()
      await renderLoaded()

      await openMergeAndPick(user, KEEP)

      expect(listPlatformPlayingAreas).toHaveBeenCalledWith(expect.objectContaining({ verification: 'VERIFIED' }))
      expect(listPlatformPlayingAreas).toHaveBeenCalledWith(expect.objectContaining({ verification: 'UNVERIFIED' }))
      const goes = screen.getByTestId('merge-facts-goes')
      const stays = screen.getByTestId('merge-facts-stays')
      expect(goes).toHaveTextContent('Goes away')
      expect(goes).toHaveTextContent('Hilton Oval (dup)')
      expect(goes).toHaveTextContent('Unverified')
      expect(goes).toHaveTextContent('3 matches, 2 clubs')
      expect(stays).toHaveTextContent('Stays')
      expect(stays).toHaveTextContent('Hilton College')
      expect(stays).toHaveTextContent('Verified')
      expect(stays).toHaveTextContent('9 matches')
      expect(screen.queryByTestId('merge-different-place')).not.toBeInTheDocument()
    })

    it('does not offer the field itself as the one to keep', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      await user.click(screen.getByRole('button', { name: 'Merge into...' }))
      const dialog = await screen.findByRole('dialog', { name: 'Merge into another field' })
      await user.click(within(dialog).getByLabelText('Field to keep'))

      await screen.findByRole('option', { name: /Hilton Oval Far/ })
      expect(screen.queryByRole('option', { name: /Hilton Oval \(dup\)/ })).not.toBeInTheDocument()
    })

    it('warns when the two fields are in different places', async () => {
      const user = userEvent.setup()
      await renderLoaded()

      await openMergeAndPick(user, FAR)

      expect(screen.getByTestId('merge-different-place')).toHaveTextContent('These fields are in different places (Hilton, South Africa and Leeds, United Kingdom)')
    })

    it('Merge… is disabled until a field is chosen, and calls no API until the explicit confirmation', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      await user.click(screen.getByRole('button', { name: 'Merge into...' }))
      const dialog = await screen.findByRole('dialog', { name: 'Merge into another field' })
      expect(within(dialog).getByRole('button', { name: 'Merge…' })).toBeDisabled()

      await user.click(within(dialog).getByLabelText('Field to keep'))
      await user.click(await screen.findByRole('option', { name: KEEP }))
      await user.click(within(dialog).getByRole('button', { name: 'Merge…' }))

      // the confirmation states the counts and shows both sides again, and nothing has been merged yet
      const confirm = await screen.findByRole('dialog', { name: 'Merge these fields?' })
      expect(confirm).toHaveTextContent('3 matches and 2 clubs will move to Hilton Oval')
      expect(within(confirm).getByTestId('merge-facts-goes')).toBeInTheDocument()
      expect(within(confirm).getByTestId('merge-facts-stays')).toBeInTheDocument()
      expect(mergePlayingArea).not.toHaveBeenCalled()
    })

    it('Cancel on the confirmation merges nothing', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      const dialog = await openMergeAndPick(user, KEEP)
      await user.click(within(dialog).getByRole('button', { name: 'Merge…' }))
      const confirm = await screen.findByRole('dialog', { name: 'Merge these fields?' })

      await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Merge these fields?' })).not.toBeInTheDocument())
      expect(mergePlayingArea).not.toHaveBeenCalled()
    })

    it('confirming merges the field into the chosen one and opens the one that stays', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      const dialog = await openMergeAndPick(user, KEEP)
      await user.click(within(dialog).getByRole('button', { name: 'Merge…' }))
      const confirm = await screen.findByRole('dialog', { name: 'Merge these fields?' })

      await user.click(within(confirm).getByRole('button', { name: 'Merge' }))

      await waitFor(() => expect(mergePlayingArea).toHaveBeenCalledWith('dup-1', 'keep-1'))
      expect(await screen.findByText('At: /admin/fields/keep-1')).toBeInTheDocument()
    })

    it('shows the server\'s refusal in the confirmation and keeps it open', async () => {
      const user = userEvent.setup()
      mergePlayingArea.mockRejectedValue(problem(409, { detail: 'Target is merged away' }))
      await renderLoaded()
      const dialog = await openMergeAndPick(user, KEEP)
      await user.click(within(dialog).getByRole('button', { name: 'Merge…' }))
      const confirm = await screen.findByRole('dialog', { name: 'Merge these fields?' })

      await user.click(within(confirm).getByRole('button', { name: 'Merge' }))

      expect(await within(confirm).findByText('Target is merged away')).toBeInTheDocument()
    })
  })

  it('shows an error when the field cannot be loaded', async () => {
    getPlatformPlayingArea.mockRejectedValue(new Error('boom'))
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/admin/fields/x']}>
          <Routes>
            <Route path="/admin/fields/:fieldId" element={<AdminFieldDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText("Couldn't load this field")).toBeInTheDocument()
  })
})
