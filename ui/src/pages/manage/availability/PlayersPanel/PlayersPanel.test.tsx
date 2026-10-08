import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayersPanel } from './PlayersPanel'
import type { PlayersPanelProps, PlayersPanelTab } from './PlayersPanel'
import type { AvailabilitySummaryPlayer, AvailabilitySummaryPlayersPage } from '../../../../api/availabilitySummaryApi'

const listAvailabilitySummaryPlayers = vi.fn()
vi.mock('../../../../api/availabilitySummaryApi', async () => {
  const actual = await vi.importActual<typeof import('../../../../api/availabilitySummaryApi')>('../../../../api/availabilitySummaryApi')
  return { ...actual, listAvailabilitySummaryPlayers: (...args: unknown[]) => listAvailabilitySummaryPlayers(...args) }
})

function player(id: string, displayName: string, polls: AvailabilitySummaryPlayer['polls'] = []): AvailabilitySummaryPlayer {
  return {
    playerProfileId: id,
    displayName,
    polls: polls.length
      ? polls
      : [{ kind: 'SQUAD', id: `poll-${id}`, matchId: `match-${id}`, title: `Lions vs ${displayName} XI` }],
  }
}

function page(content: AvailabilitySummaryPlayer[], number = 0, totalPages = 1): AvailabilitySummaryPlayersPage {
  return { content, totalElements: content.length, totalPages, number, size: 25, last: number + 1 >= totalPages }
}

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  listAvailabilitySummaryPlayers.mockReset()
  listAvailabilitySummaryPlayers.mockResolvedValue(page([player('1', 'Ann Lee')]))
  setPhone(false)
})

function Harness({ initialTab = 'awaiting', onClose, ...rest }: Partial<PlayersPanelProps> & { initialTab?: PlayersPanelTab }) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<PlayersPanelTab>(initialTab)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        opener
      </button>
      <PlayersPanel
        open={open}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        clubId="club-1"
        tab={tab}
        onTabChange={setTab}
        filters={{ leagueId: 'lg-1', type: 'ALL', includeClosed: false }}
        counts={{ responded: 12, awaiting: 6 }}
        scope="Vets › Over 40"
        {...rest}
      />
    </>
  )
}

function renderPanel(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Harness {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlayersPanel (084)', () => {
  it('shows both tabs with the counter figures, pre-selected, and switches without losing the others', async () => {
    const user = userEvent.setup()
    renderPanel({ initialTab: 'awaiting' })

    expect(await screen.findByRole('tab', { name: 'Still to answer · 6' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Responded · 12' })).toHaveAttribute('aria-selected', 'false')
    await waitFor(() => expect(listAvailabilitySummaryPlayers).toHaveBeenCalledTimes(1))
    expect(listAvailabilitySummaryPlayers.mock.calls[0][1]).toMatchObject({ kind: 'awaiting', leagueId: 'lg-1' })
    expect(listAvailabilitySummaryPlayers.mock.calls[0][1]).not.toHaveProperty('closingSoon')

    await user.click(screen.getByRole('tab', { name: 'Responded · 12' }))
    expect(screen.getByRole('tab', { name: 'Responded · 12' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(listAvailabilitySummaryPlayers).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ kind: 'responded' }), 0))
  })

  it('lists each player once with a poll count; on desktop the poll links expand on demand and go to both Responses routes', async () => {
    const user = userEvent.setup()
    listAvailabilitySummaryPlayers.mockResolvedValue(
      page([
        player('1', 'Ann Lee', [
          { kind: 'SQUAD', id: 'p1', matchId: 'm1', title: 'Lions vs Rivals' },
          { kind: 'GROUP', id: 'r1', matchId: null, title: 'Sat fixtures' },
        ]),
        player('2', 'Bob Ray'),
      ]),
    )
    renderPanel()

    const rows = await screen.findAllByTestId('players-panel-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('2 polls')).toBeInTheDocument()
    expect(within(rows[1]).getByText('1 poll')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Lions vs Rivals' })).not.toBeInTheDocument()

    await user.click(within(rows[0]).getByRole('button', { name: 'Ann Lee, 2 polls' }))
    expect(within(rows[0]).getByRole('button', { name: 'Ann Lee, 2 polls' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Lions vs Rivals' })).toHaveAttribute('href', '/manage/availability/squad/m1/p1')
    expect(screen.getByRole('link', { name: 'Sat fixtures' })).toHaveAttribute('href', '/manage/availability/group/r1')
  })

  it('on a phone the poll links sit beneath the name, in a bottom sheet', async () => {
    setPhone(true)
    listAvailabilitySummaryPlayers.mockResolvedValue(
      page([player('1', 'Ann Lee', [{ kind: 'GROUP', id: 'r1', matchId: null, title: 'Sat fixtures' }])]),
    )
    renderPanel()

    expect(await screen.findByRole('link', { name: 'Sat fixtures' })).toHaveAttribute('href', '/manage/availability/group/r1')
    expect(document.querySelector('.MuiDrawer-paperAnchorBottom')).toHaveAttribute('aria-label', 'Players')
    expect(document.querySelector('.MuiDrawer-paperAnchorRight')).not.toBeInTheDocument()
  })

  it('on desktop is a right-anchored drawer named Players', async () => {
    renderPanel()

    await screen.findByText('Ann Lee')
    expect(document.querySelector('.MuiDrawer-paperAnchorRight')).toHaveAttribute('aria-label', 'Players')
    expect(screen.getByTestId('players-panel-scope')).toHaveTextContent('Showing: Vets › Over 40')
  })

  it('omits the scope line when no shared filter is set', async () => {
    renderPanel({ scope: '', filters: { type: 'ALL', includeClosed: false } })

    await screen.findByText('Ann Lee')
    expect(screen.queryByTestId('players-panel-scope')).not.toBeInTheDocument()
  })

  it('keeps the search text when the window crosses the phone breakpoint', async () => {
    const user = userEvent.setup()
    const listeners = new Set<() => void>()
    let phone = false
    window.matchMedia = ((query: string) => ({
      get matches() {
        return phone && query.includes('max-width')
      },
      media: query,
      onchange: null,
      addListener: (listener: () => void) => listeners.add(listener),
      removeListener: (listener: () => void) => listeners.delete(listener),
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    renderPanel()
    await screen.findByText('Ann Lee')
    await user.type(screen.getByRole('textbox', { name: 'Search players' }), 'an')

    phone = true
    act(() => listeners.forEach((listener) => listener()))

    await waitFor(() => expect(document.querySelector('.MuiDrawer-paperAnchorBottom')).toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Search players' })).toHaveValue('an')
  })

  it('sends the trimmed search after a pause, not on every keystroke', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Ann Lee')

    await user.type(screen.getByRole('textbox', { name: 'Search players' }), ' an ')

    await waitFor(() => expect(listAvailabilitySummaryPlayers).toHaveBeenLastCalledWith('club-1', expect.objectContaining({ search: 'an' }), 0))
    const searches = listAvailabilitySummaryPlayers.mock.calls.map((call) => call[1].search)
    expect(searches).toEqual(['', 'an'])
  })

  it('shows skeleton rows inside the panel while loading', async () => {
    listAvailabilitySummaryPlayers.mockReturnValue(new Promise(() => undefined))
    renderPanel()

    expect(await screen.findByTestId('players-panel-loading')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Still to answer/ })).toBeInTheDocument()
  })

  it('says "Everyone has answered." on Still to answer and "No answers yet." on Responded when empty', async () => {
    const user = userEvent.setup()
    listAvailabilitySummaryPlayers.mockResolvedValue(page([]))
    renderPanel()

    expect(await screen.findByText('Everyone has answered.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Responded/ }))
    expect(await screen.findByText('No answers yet.')).toBeInTheDocument()
  })

  it('says no players match when a search finds nobody', async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Ann Lee')
    listAvailabilitySummaryPlayers.mockResolvedValue(page([]))

    await user.type(screen.getByRole('textbox', { name: 'Search players' }), 'zz')

    expect(await screen.findByText('No players match "zz".')).toBeInTheDocument()
  })

  it('shows an error with Retry inside the panel, and Retry reloads', async () => {
    const user = userEvent.setup()
    listAvailabilitySummaryPlayers.mockRejectedValueOnce(new Error('boom'))
    renderPanel()

    expect(await screen.findByText("We couldn't load the players.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Ann Lee')).toBeInTheDocument()
  })

  it('loads the next page with Show more, appending to the list, until there is no more', async () => {
    const user = userEvent.setup()
    listAvailabilitySummaryPlayers
      .mockResolvedValueOnce(page([player('1', 'Ann Lee')], 0, 2))
      .mockResolvedValueOnce(page([player('2', 'Bob Ray')], 1, 2))
    renderPanel()

    await screen.findByText('Ann Lee')
    await user.click(screen.getByRole('button', { name: 'Show more' }))

    expect(await screen.findByText('Bob Ray')).toBeInTheDocument()
    expect(screen.getByText('Ann Lee')).toBeInTheDocument()
    expect(listAvailabilitySummaryPlayers).toHaveBeenLastCalledWith('club-1', expect.anything(), 1)
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('closes with Escape and the close button, and returns focus to the opener', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPanel({ onClose })
    await screen.findByText('Ann Lee')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('tab')).not.toBeInTheDocument())
    expect(onClose).toHaveBeenCalledTimes(1)

    const opener = screen.getByRole('button', { name: 'opener' })
    await user.click(opener)
    await screen.findByText('Ann Lee')
    await user.click(screen.getByRole('button', { name: 'Close players list' }))
    await waitFor(() => expect(screen.queryByRole('tab')).not.toBeInTheDocument())
    expect(onClose).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('makes no request while closed', () => {
    renderPanel({ open: false })

    expect(listAvailabilitySummaryPlayers).not.toHaveBeenCalled()
  })
})
