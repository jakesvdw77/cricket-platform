import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FieldDetailPage from './FieldDetailPage'
import type { PlayingArea } from '../../../api/playingAreaApi'
import { makeField } from '../../../test/fieldFixtures'

const getPlayingArea = vi.fn()
const linkPlayingAreaHome = vi.fn()
const unlinkPlayingAreaHome = vi.fn()

vi.mock('../../../api/playingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/playingAreaApi')>()
  return {
    ...actual,
    getPlayingArea: (clubId: string, id: string) => getPlayingArea(clubId, id),
    linkPlayingAreaHome: (clubId: string, id: string) => linkPlayingAreaHome(clubId, id),
    unlinkPlayingAreaHome: (clubId: string, id: string) => unlinkPlayingAreaHome(clubId, id),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  linkPlayingAreaHome.mockResolvedValue(undefined)
  unlinkPlayingAreaHome.mockResolvedValue(undefined)
})

async function renderLoaded(field: PlayingArea) {
  getPlayingArea.mockResolvedValue(field)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/manage/fixtures/fields/${field.id}`]}>
        <Routes>
          <Route element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="/manage/fixtures/fields/:fieldId" element={<FieldDetailPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { level: 1, name: field.name })
}

// docs/specs/099-fields-directory.md (4)
describe('FieldDetailPage', () => {
  it('shows the title with the verification badge, Back to Fields, the key figures and the three cards', async () => {
    await renderLoaded(makeField({ linkedHome: true, matchCount: 4 }))

    expect(screen.getByTestId('field-status-badge')).toHaveTextContent('Verified')
    expect(screen.getByRole('link', { name: /Back to Fields/ })).toHaveAttribute('href', '/manage/fixtures/fields')
    expect(screen.getByTestId('field-figure-type')).toHaveTextContent('Club')
    expect(screen.getByTestId('field-figure-owner')).toHaveTextContent('Riverside CC')
    expect(screen.getByTestId('field-figure-city')).toHaveTextContent('Hilton, KwaZulu-Natal')
    expect(screen.getByTestId('field-figure-matches')).toHaveTextContent('4')
    expect(screen.getByTestId('field-figure-ours')).toHaveTextContent('Yes')
    for (const title of ['Address', 'Details', 'Verification']) expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.getByText('Province')).toBeInTheDocument()
    expect(screen.getByText('South Africa')).toBeInTheDocument()
  })

  it('shows Open in maps as a real button-link twice (header and Address card) when there is a map link', async () => {
    await renderLoaded(makeField())
    const links = screen.getAllByRole('link', { name: 'Open in maps' })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', 'https://maps.example.com/riverside')
  })

  it('shows no Open in maps without a map link', async () => {
    await renderLoaded(makeField({ mapUrl: null }))
    expect(screen.queryByRole('link', { name: 'Open in maps' })).not.toBeInTheDocument()
  })

  it('shows the persistent unverified notice and an enabled filled Edit for the club that captured it', async () => {
    await renderLoaded(makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }))

    expect(screen.getByTestId('field-status-notice')).toHaveTextContent('This field has not been verified yet. Check the address before you share it with players.')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/fixtures/fields/field-1/edit')
  })

  it('shows no notice for a verified field, and Edit disabled (not hidden) with the reason', async () => {
    await renderLoaded(makeField({ verificationStatus: 'VERIFIED' }))

    expect(screen.queryByTestId('field-status-notice')).not.toBeInTheDocument()
    const edit = screen.getByRole('button', { name: 'Edit' })
    expect(edit).toBeDisabled()
    expect(edit.closest('span[title]')).toHaveAttribute('title', 'Only a platform admin can change a verified field.')
  })

  it('shows the red rejected notice with the reason, and Rejection reason on the Verification card', async () => {
    await renderLoaded(makeField({ verificationStatus: 'REJECTED', rejectionReason: 'Not a cricket field' }))

    const notice = screen.getByTestId('field-status-notice')
    expect(notice).toHaveAttribute('data-tone', 'closed')
    expect(notice).toHaveTextContent('Reason: Not a cricket field')
    expect(screen.getByText('Rejection reason')).toBeInTheDocument()
  })

  it('shows the dash for details not on file', async () => {
    await renderLoaded(makeField({ locationNotes: null, address: { number: null, street: null, city: 'Hilton', provinceState: null, country: 'ZA', postalCode: null } }))
    const address = screen.getByText('Address').closest('.MuiCard-root') as HTMLElement
    expect(within(address).getAllByText('–').length).toBeGreaterThanOrEqual(3)
  })

  it('Add to our fields links the field; Remove from our fields unlinks it', async () => {
    const user = userEvent.setup()
    await renderLoaded(makeField({ linkedHome: false }))
    await user.click(screen.getByRole('button', { name: 'Add to our fields' }))
    await waitFor(() => expect(linkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'field-1'))
  })

  it('offers Remove from our fields for one of ours', async () => {
    const user = userEvent.setup()
    await renderLoaded(makeField({ linkedHome: true }))
    await user.click(screen.getByRole('button', { name: 'Remove from our fields' }))
    await waitFor(() => expect(unlinkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'field-1'))
  })

  it('shows an error when the field cannot be loaded', async () => {
    getPlayingArea.mockRejectedValue(new Error('boom'))
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/manage/fixtures/fields/x']}>
          <Routes>
            <Route element={<Outlet context={{ clubId: 'club-1' }} />}>
              <Route path="/manage/fixtures/fields/:fieldId" element={<FieldDetailPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText("Couldn't load this field")).toBeInTheDocument()
  })
})
