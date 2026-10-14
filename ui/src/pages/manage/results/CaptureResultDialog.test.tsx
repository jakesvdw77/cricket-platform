import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CaptureResultDialog } from './CaptureResultDialog'
import { makeMatch, makePage, makeTeam, makeTeams } from './resultTestUtils'

const listAwaitingResults = vi.fn()

vi.mock('../../../api/matchResultApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchResultApi')>()
  return { ...actual, listAwaitingResults: (clubId: string, params: unknown) => listAwaitingResults(clubId, params) }
})

const teams = makeTeams(makeTeam('team-1', '1st XI'), makeTeam('team-2', '2nd XI'))
const onClose = vi.fn()

function Where() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/results']}>
        <Routes>
          <Route path="/results" element={<CaptureResultDialog open onClose={onClose} clubId="club-1" teamsById={teams} leaguesById={new Map()} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const m1 = makeMatch({ id: 'match-1', matchDate: '2026-10-03T10:00:00Z' })
const derby = makeMatch({ id: 'match-2', matchDate: '2026-10-03T14:00:00Z', awayTeamId: 'team-2', awayTeamName: null })
const earlier = makeMatch({ id: 'match-3', matchDate: '2026-09-26T10:00:00Z', awayTeamName: 'Hillcrest CC' })

beforeEach(() => {
  vi.clearAllMocks()
  listAwaitingResults.mockResolvedValue(makePage([m1, derby, earlier]))
})

describe('CaptureResultDialog', () => {
  it('lists the awaiting matches newest first by default, past only, grouped under date headings', async () => {
    renderDialog()

    expect(await screen.findAllByTestId('awaiting-match')).toHaveLength(3)
    expect(listAwaitingResults).toHaveBeenCalledWith('club-1', expect.objectContaining({ sort: 'matchDate,desc', page: 0 }))
    expect(listAwaitingResults.mock.calls[0][1].includeUpcoming).toBeUndefined()
    // two matches on 3 Oct share a heading, the 26 Sep one has its own
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
    expect(screen.getByText(/3 matches waiting/)).toBeInTheDocument()
  })

  it('marks a match between two of the club teams as Both ours', async () => {
    renderDialog()

    const rows = await screen.findAllByTestId('awaiting-match')
    expect(within(rows[1]).getByText('Both ours')).toBeInTheDocument()
    expect(within(rows[0]).queryByText('Both ours')).not.toBeInTheDocument()
  })

  it('sends the typed search after the debounce', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findAllByTestId('awaiting-match')

    await user.type(screen.getByLabelText('Search teams or league'), 'Hill')

    await waitFor(() => expect(listAwaitingResults).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ search: 'Hill' })))
  })

  it('narrows to one team', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findAllByTestId('awaiting-match')

    await user.click(screen.getByRole('combobox', { name: 'Team' }))
    await user.click(await screen.findByRole('option', { name: '2nd XI' }))

    await waitFor(() => expect(listAwaitingResults).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ teamId: 'team-2' })))
  })

  it('asks for upcoming matches when Include upcoming is switched on', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findAllByTestId('awaiting-match')

    await user.click(screen.getByRole('checkbox', { name: 'Include upcoming' }))

    await waitFor(() => expect(listAwaitingResults).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ includeUpcoming: true })))
  })

  it('opens the wizard for the picked match and closes the picker', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click((await screen.findAllByTestId('awaiting-match'))[2])

    expect(await screen.findByText('At: /manage/results/match-3/capture')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('explains an empty past list and points at Include upcoming', async () => {
    listAwaitingResults.mockResolvedValue(makePage([]))
    renderDialog()

    expect(await screen.findByText('No past matches are waiting for a result. Include upcoming to see the rest.')).toBeInTheDocument()
  })

  it('says every match has a result when upcoming are included and nothing is left', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findAllByTestId('awaiting-match')
    listAwaitingResults.mockResolvedValue(makePage([]))

    await user.click(screen.getByRole('checkbox', { name: 'Include upcoming' }))

    expect(await screen.findByText('Every match already has a result.')).toBeInTheDocument()
  })

  it('offers a retry when the matches cannot be loaded', async () => {
    const user = userEvent.setup()
    listAwaitingResults.mockRejectedValueOnce(new Error('boom'))
    renderDialog()

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the matches.")
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findAllByTestId('awaiting-match')).toHaveLength(3)
  })

  it('loads the next page on Show more', async () => {
    const user = userEvent.setup()
    listAwaitingResults.mockImplementation((_club: string, params: { page: number }) =>
      Promise.resolve(params.page === 0 ? makePage([m1], { totalPages: 2, totalElements: 2 }) : makePage([earlier], { number: 1, totalPages: 2, totalElements: 2 })),
    )
    renderDialog()

    await user.click(await screen.findByRole('button', { name: 'Show more' }))

    expect(await screen.findAllByTestId('awaiting-match')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })
})
