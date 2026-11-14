import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OurFieldsCard } from './OurFieldsCard'
import { PermissionsProvider } from '../../auth/permissions'
import { fieldPage, makeField } from '../../test/fieldFixtures'

const listPlayingAreas = vi.fn()
const linkPlayingAreaHome = vi.fn()
const unlinkPlayingAreaHome = vi.fn()

vi.mock('../../api/playingAreaApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/playingAreaApi')>()
  return {
    ...actual,
    listPlayingAreas: (clubId: string, params: unknown) => listPlayingAreas(clubId, params),
    linkPlayingAreaHome: (clubId: string, id: string) => linkPlayingAreaHome(clubId, id),
    unlinkPlayingAreaHome: (clubId: string, id: string) => unlinkPlayingAreaHome(clubId, id),
  }
})

const editor = { personId: 'p', personStatus: 'ACTIVE' as const, platformAdmin: false, clubAdminClubIds: ['club-1'], permissions: [{ clubId: 'club-1', clubWide: true, items: [{ key: 'MATCHES_EDIT', sectionIds: null }] }] }
const viewer = { ...editor, permissions: [{ clubId: 'club-1', clubWide: true, items: [{ key: 'MATCHES_VIEW', sectionIds: null }] }] }

function renderCard(access = editor) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PermissionsProvider access={access} clubId="club-1">
          <OurFieldsCard clubId="club-1" leaveTo={(destination) => destination} />
        </PermissionsProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const ours = makeField({ id: 'f1', name: 'Irene Oval A', linkedHome: true, address: { number: '12', street: 'River Road', city: 'Irene', provinceState: 'Gauteng', country: 'ZA', postalCode: null } })

beforeEach(() => {
  vi.clearAllMocks()
  linkPlayingAreaHome.mockResolvedValue(undefined)
  unlinkPlayingAreaHome.mockResolvedValue(undefined)
  listPlayingAreas.mockImplementation(async (_club: string, params: { mine?: boolean; q?: string }) =>
    params.mine ? fieldPage([ours]) : fieldPage([ours, makeField({ id: 'f2', name: 'Hilton Oval', linkedHome: false }), makeField({ id: 'f3', name: 'Centurion Park', linkedHome: false })]),
  )
})

// docs/specs/151, slice F: the club's own fields on the Club Profile page.
describe('OurFieldsCard', () => {
  it('lists the club\'s own fields with their street and town, each opening the field page', async () => {
    renderCard()

    const row = await screen.findByTestId('our-field-row')
    expect(listPlayingAreas).toHaveBeenCalledWith('club-1', expect.objectContaining({ mine: true }))
    expect(within(row).getByRole('link', { name: 'Irene Oval A' })).toHaveAttribute('href', '/manage/fixtures/fields/f1')
    expect(within(row).getByText('12 River Road, Irene, Gauteng')).toBeInTheDocument()
  })

  it('says there are no fields yet and invites linking one', async () => {
    listPlayingAreas.mockResolvedValue(fieldPage([]))

    renderCard()

    expect(await screen.findByText(/No fields yet\. Link the fields your club plays on\./)).toBeInTheDocument()
  })

  it('gives a manager without Matches Edit the list and no buttons', async () => {
    renderCard(viewer)

    await screen.findByTestId('our-field-row')
    expect(screen.queryByTestId('link-field')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove .* from Our Fields/ })).not.toBeInTheDocument()
  })

  it('removes a field from the shortlist', async () => {
    renderCard()

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Irene Oval A from Our Fields' }))

    await waitFor(() => expect(unlinkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'f1'))
  })

  it('searches the whole directory and links a field, leaving out the fields already linked', async () => {
    renderCard()

    await userEvent.click(await screen.findByTestId('link-field'))
    const dialog = await screen.findByRole('dialog', { name: 'Link A Field To Your Club' })
    const results = await within(dialog).findAllByTestId('link-field-result')
    expect(results.map((result) => within(result).getByText(/Oval|Park/).textContent)).toEqual(['Hilton Oval', 'Centurion Park'])

    await userEvent.click(within(results[0]).getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(linkPlayingAreaHome).toHaveBeenCalledWith('club-1', 'f2'))
  })

  it('sends what is typed as the search, after a short pause', async () => {
    renderCard()
    await userEvent.click(await screen.findByTestId('link-field'))
    const dialog = await screen.findByRole('dialog')

    await userEvent.type(within(dialog).getByLabelText('Search fields'), 'Hilton')

    await waitFor(() => expect(listPlayingAreas).toHaveBeenCalledWith('club-1', expect.objectContaining({ q: 'Hilton' })))
  })

  it('offers Create New Field when nothing matches', async () => {
    listPlayingAreas.mockImplementation(async (_club: string, params: { mine?: boolean }) => (params.mine ? fieldPage([ours]) : fieldPage([])))
    renderCard()

    await userEvent.click(await screen.findByTestId('link-field'))

    const empty = await screen.findByTestId('link-field-empty')
    expect(within(empty).getByRole('link', { name: 'Create New Field' })).toHaveAttribute('href', '/manage/fixtures/fields/new')
  })

  it('closes with Done', async () => {
    renderCard()
    await userEvent.click(await screen.findByTestId('link-field'))
    await screen.findByRole('dialog')

    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
