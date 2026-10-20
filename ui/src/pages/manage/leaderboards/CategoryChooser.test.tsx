import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoryChooser } from './CategoryChooser'
import { AWARD_BOARDS, defaultServer, leaderboardApi } from '../../../test/leaderboardFixtures'
import type { LeaderboardServer } from '../../../test/leaderboardFixtures'

// docs/specs/103-player-stats.md decisions 11 and 18: which categories the club's Awards sheet shows, saved for the whole club.
let server: LeaderboardServer
const apiGet = vi.fn()
const apiPut = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args), put: (...args: unknown[]) => apiPut(...args) },
}))

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

function renderChooser() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <CategoryChooser clubId="club-1" catalogue={AWARD_BOARDS} />
    </QueryClientProvider>,
  )
  return { invalidate }
}

const wait = { timeout: 5000 }
async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'Choose categories' }))
  return screen.findByRole('checkbox', { name: 'Most runs' }, wait)
}

describe('CategoryChooser', () => {
  beforeEach(() => {
    server = defaultServer()
    apiGet.mockReset()
    apiPut.mockReset()
    apiGet.mockImplementation((url: string, config?: unknown) => leaderboardApi(server).get(url, config as never))
    apiPut.mockImplementation((url: string, body: { awardCategories: string[] }) => leaderboardApi(server).put(url, body))
    setPhone(false)
  })
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('lists the defaults under "Shown by default" and the rest under "Also available", ticking what is saved', async () => {
    renderChooser()
    await open()
    const defaults = screen.getByRole('group', { name: 'Shown by default' })
    for (const name of ['Most runs', 'Batting average', 'Economy rate']) expect(within(defaults).getByRole('checkbox', { name })).toBeChecked()
    const extras = screen.getByRole('group', { name: 'Also available' })
    expect(within(extras).getByRole('checkbox', { name: 'Most sixes' })).not.toBeChecked()
  })

  it('saves the ticked categories for the club and closes, refreshing the awards', async () => {
    const { invalidate } = renderChooser()
    await open()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Most sixes' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Economy rate' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save for club' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
    expect(apiPut).toHaveBeenCalledWith('/manage/clubs/club-1/leaderboard-settings', { awardCategories: ['MOST_RUNS', 'BATTING_AVERAGE', 'MOST_SIXES'] })
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Most runs' })).not.toBeInTheDocument())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'leaderboards', 'awards'] })
  })

  it('disables Save and says to choose one when nothing is ticked', async () => {
    renderChooser()
    await open()
    for (const name of ['Most runs', 'Batting average', 'Economy rate']) await userEvent.click(screen.getByRole('checkbox', { name }))
    expect(screen.getByRole('button', { name: 'Save for club' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Choose at least one category.')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Most runs' }))
    expect(screen.getByRole('button', { name: 'Save for club' })).toBeEnabled()
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('Cancel closes without saving', async () => {
    renderChooser()
    await open()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Most sixes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Most runs' })).not.toBeInTheDocument())
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('keeps the form open and says so when saving fails', async () => {
    apiPut.mockRejectedValueOnce(new Error('boom'))
    renderChooser()
    await open()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Most sixes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save for club' }))
    expect(await screen.findByText('Could not save. Please try again.', {}, wait)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Most sixes' })).toBeChecked()
  })

  it('shows a retry when the saved categories cannot be loaded', async () => {
    server.settings = undefined as never
    apiGet.mockImplementation((url: string, config?: unknown) =>
      url.endsWith('/leaderboard-settings') ? Promise.reject(new Error('boom')) : leaderboardApi(server).get(url, config as never),
    )
    renderChooser()
    await userEvent.click(screen.getByRole('button', { name: 'Choose categories' }))
    expect(await screen.findByText(/Could not load the categories/, {}, wait)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save for club' })).toBeDisabled()
  })

  it('opens in a bottom sheet on a phone with the same form', async () => {
    setPhone(true)
    renderChooser()
    await open()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Most sixes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save for club' }))
    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1))
  })
})
