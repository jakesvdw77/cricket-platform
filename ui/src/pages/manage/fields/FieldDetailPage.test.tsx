import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FieldDetailPage from './FieldDetailPage'
import type { PlayingArea } from '../../../api/playingAreaApi'
import { makeField } from '../../../test/fieldFixtures'
import { MANAGE_BUTTON_WIDTH } from '../../../components/ManageMenu'

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

const geocodeFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  geocodeFetch.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ results: [] }) }))
  vi.stubGlobal('fetch', geocodeFetch)
  linkPlayingAreaHome.mockResolvedValue(undefined)
  unlinkPlayingAreaHome.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const openManage = async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Manage Field' }))

async function renderLoaded(field: PlayingArea, search = '') {
  getPlayingArea.mockResolvedValue(field)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/manage/fixtures/fields/${field.id}${search}`]}>
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

// docs/specs/099-fields-directory.md (4) and docs/specs/134
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

  it('shows Open in maps once, as an inline link under the title, when there is a map link', async () => {
    await renderLoaded(makeField())
    const links = screen.getAllByRole('link', { name: 'Open in maps' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://maps.example.com/riverside')
    expect(screen.getByTestId('field-header-title-row')).toContainElement(links[0])
  })

  it('shows no Open in maps without a map link, in the header or the menu', async () => {
    const user = userEvent.setup()
    await renderLoaded(makeField({ mapUrl: null }))
    expect(screen.queryByRole('link', { name: 'Open in maps' })).not.toBeInTheDocument()
    await openManage(user)
    expect(screen.queryByRole('menuitem', { name: /Open In Maps/ })).not.toBeInTheDocument()
  })

  it('has Back alone on the top row, and the title row holds the name, one badge and one filled Manage Field button', async () => {
    await renderLoaded(makeField())

    const top = screen.getByTestId('field-header-top-row')
    expect(within(top).getAllByRole('link')).toHaveLength(1)
    expect(within(top).queryByRole('button')).not.toBeInTheDocument()
    const title = screen.getByTestId('field-header-title-row')
    expect(within(title).getAllByRole('button')).toHaveLength(1)
    const manage = screen.getByRole('button', { name: 'Manage Field' })
    expect(manage).toHaveClass('MuiButton-contained')
    expect(manage).toHaveStyle({ width: `${MANAGE_BUTTON_WIDTH}px` })
    expect(screen.getAllByTestId('field-status-badge')).toHaveLength(1)
    // no separate Edit, Status, Merge, Verify or Open in maps button
    for (const name of ['Edit', 'Status', 'Merge into...', 'Verify', 'Add to our fields']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  })

  it('shows the figures as static compact counters without a pointer, a button or an icon', async () => {
    await renderLoaded(makeField())
    const figures = screen.getByTestId('field-key-figures')
    expect(within(figures).queryByRole('button')).not.toBeInTheDocument()
    expect(within(figures).queryByRole('link')).not.toBeInTheDocument()
    expect(figures.querySelector('svg')).toBeNull()
  })

  it('has flat info cards', async () => {
    await renderLoaded(makeField())
    for (const title of ['Address', 'Details', 'Verification']) {
      const card = screen.getByText(title).closest('.MuiCard-root') as HTMLElement
      expect(getComputedStyle(card).boxShadow).toBe('none')
    }
  })

  it('Manage Field lists Edit Field first, then the Our Fields choice and Open In Maps, with no Share', async () => {
    const user = userEvent.setup()
    await renderLoaded(makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }))

    await openManage(user)

    expect(screen.getAllByRole('menuitem').map((item) => within(item).getByText(/^(Edit Field|Add To Our Fields|Remove From Our Fields|Open In Maps)$/).textContent)).toEqual([
      'Edit Field',
      'Add To Our Fields',
      'Open In Maps',
    ])
    expect(screen.queryByRole('menuitem', { name: /Share/ })).not.toBeInTheDocument()
  })

  it('opens the map in a new tab from the menu', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    await renderLoaded(makeField())

    await openManage(user)
    await user.click(await screen.findByRole('menuitem', { name: /Open In Maps/ }))

    await waitFor(() => expect(open).toHaveBeenCalledWith('https://maps.example.com/riverside', '_blank', 'noopener,noreferrer'))
    open.mockRestore()
  })

  it('Back goes to the origin when there is a returnTo, and Edit Field carries this page as the origin', async () => {
    const user = userEvent.setup()
    await renderLoaded(
      makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }),
      '?returnTo=%2Fmanage%2Ffixtures%2Fmatches&returnLabel=Matches',
    )

    expect(screen.getByRole('link', { name: /Back to Matches/ })).toHaveAttribute('href', '/manage/fixtures/matches')
    await openManage(user)
    const edit = await screen.findByRole('menuitem', { name: /Edit Field/ })
    // the page never copies its own returnTo forward: the origin is this field page only
    expect(edit).toHaveAttribute('href', '/manage/fixtures/fields/field-1/edit?returnTo=%2Fmanage%2Ffixtures%2Ffields%2Ffield-1&returnLabel=Riverside+Oval')
  })

  it('shows the persistent unverified notice with no button, and an enabled Edit Field for the club that captured it', async () => {
    const user = userEvent.setup()
    await renderLoaded(makeField({ verificationStatus: 'UNVERIFIED', createdByClubId: 'club-1' }))

    const notice = screen.getByTestId('field-status-notice')
    expect(notice).toHaveTextContent('This field has not been verified yet. Check the address before you share it with players.')
    expect(within(notice).queryByRole('button')).not.toBeInTheDocument()
    await openManage(user)
    expect(await screen.findByRole('menuitem', { name: /Edit Field/ })).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/fields/field-1/edit'))
  })

  it('shows no notice for a verified field, and Edit Field disabled (not hidden) with the reason', async () => {
    const user = userEvent.setup()
    await renderLoaded(makeField({ verificationStatus: 'VERIFIED' }))

    expect(screen.queryByTestId('field-status-notice')).not.toBeInTheDocument()
    await openManage(user)
    const edit = await screen.findByRole('menuitem', { name: /Edit Field/ })
    expect(edit).toHaveAttribute('aria-disabled', 'true')
    expect(edit).toHaveTextContent('Only a platform admin can change a verified field.')
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

  it('Add To Our Fields links the field', async () => {
    const user = userEvent.setup()
    await renderLoaded(makeField({ linkedHome: false }))
    await openManage(user)
    await user.click(await screen.findByRole('menuitem', { name: /Add To Our Fields/ }))
    await waitFor(() => expect(linkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'field-1'))
  })

  it('offers Remove From Our Fields for one of ours', async () => {
    const user = userEvent.setup()
    await renderLoaded(makeField({ linkedHome: true }))
    await openManage(user)
    await user.click(await screen.findByRole('menuitem', { name: /Remove From Our Fields/ }))
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

  // docs/specs/133
  describe('location and directions', () => {
    const located = (patch: Partial<PlayingArea> = {}) => makeField({ latitude: -29.55, longitude: 30.29, ...patch })

    it('shows the coordinates, the access point and its note in the Address card', async () => {
      await renderLoaded(located({ accessLatitude: -29.551, accessLongitude: 30.291, accessNote: 'Use gate 2 off Main Rd' }))
      expect(screen.getByText('Coordinates')).toBeInTheDocument()
      expect(screen.getByText('-29.55, 30.29')).toBeInTheDocument()
      expect(screen.getByText('Entrance or parking')).toBeInTheDocument()
      expect(screen.getByText('-29.551, 30.291')).toBeInTheDocument()
      expect(screen.getAllByText('Use gate 2 off Main Rd').length).toBeGreaterThan(0)
      expect(screen.queryByTestId('field-approximate-note')).not.toBeInTheDocument()
    })

    it('puts Get Directions in Manage Field right after Edit Field, before Open In Maps, and nothing in the header', async () => {
      const user = userEvent.setup()
      await renderLoaded(located())
      expect(within(screen.getByTestId('field-header-title-row')).queryByRole('button', { name: /Get Directions/ })).not.toBeInTheDocument()
      await openManage(user)
      const titles = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '')
      const edit = titles.findIndex((text) => text.startsWith('Edit Field'))
      const directions = titles.findIndex((text) => text.startsWith('Get Directions'))
      const maps = titles.findIndex((text) => text.startsWith('Open In Maps'))
      expect(directions).toBe(edit + 1)
      expect(directions).toBeLessThan(maps)
    })

    it('opens Google Maps with the stored coordinates in a new tab on a desktop', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      const user = userEvent.setup()
      await renderLoaded(located())
      await openManage(user)
      await user.click(screen.getByRole('menuitem', { name: /Get Directions/ }))
      await waitFor(() => expect(open).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=-29.55,30.29', '_blank', 'noopener,noreferrer'))
    })

    it('goes to the access point when set, and says so in the item description', async () => {
      const open = vi.spyOn(window, 'open').mockReturnValue(null)
      const user = userEvent.setup()
      await renderLoaded(located({ accessLatitude: -29.551, accessLongitude: 30.291 }))
      await openManage(user)
      expect(screen.getByRole('menuitem', { name: /Get Directions/ })).toHaveTextContent('Goes to the entrance or parking point.')
      await user.click(screen.getByRole('menuitem', { name: /Get Directions/ }))
      await waitFor(() => expect(open).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=-29.551,30.291', '_blank', 'noopener,noreferrer'))
    })

    it('hides Get Directions (not disabled) when no point resolves', async () => {
      const user = userEvent.setup()
      await renderLoaded(makeField({ mapUrl: null, address: { number: null, street: null, city: null, provinceState: null, country: 'ZA', postalCode: null } }))
      await openManage(user)
      expect(screen.queryByRole('menuitem', { name: /Get Directions/ })).not.toBeInTheDocument()
    })

    it('reads the position out of the map link when nothing is stored, labelled approximate', async () => {
      const user = userEvent.setup()
      await renderLoaded(makeField({ mapUrl: 'https://www.google.com/maps/@-26.1325,28.0567,17z' }))
      await openManage(user)
      expect(screen.getByRole('menuitem', { name: /Get Directions/ })).toHaveTextContent('Approximate')
    })

    it('falls back to the town centre, labelled approximate, and notes it in the Address card', async () => {
      geocodeFetch.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ results: [{ latitude: -29.5, longitude: 30.3, admin1: 'KwaZulu-Natal' }] }) }))
      const user = userEvent.setup()
      await renderLoaded(makeField({ mapUrl: null }))
      expect(await screen.findByTestId('field-approximate-note')).toHaveTextContent('Approximate')
      await openManage(user)
      expect(await screen.findByRole('menuitem', { name: /Get Directions/ })).toHaveTextContent('Approximate')
    })
  })
})
