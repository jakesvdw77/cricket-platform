import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeagueSeasonDatesBlock } from './LeagueSeasonDatesBlock'

const getLeagueSeasonDates = vi.fn()
const putLeagueSeasonDates = vi.fn()
vi.mock('../../../api/leagueSeasonDatesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueSeasonDatesApi')>()),
  getLeagueSeasonDates: (...args: unknown[]) => getLeagueSeasonDates(...args),
  putLeagueSeasonDates: (...args: unknown[]) => putLeagueSeasonDates(...args),
}))

function serverError(status: number, detail: string) {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data: { detail } } as never)
}

function m(matchDate: string, active = true) {
  return { id: matchDate, matchDate, active } as never
}

function renderBlock(seasonId = 'season-1', matches?: unknown[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <LeagueSeasonDatesBlock clubId="club-1" leagueId="league-1" seasonId={seasonId} seasonLabel="2026/2027" matches={matches as never} />
    </QueryClientProvider>,
  )
  return { invalidate }
}

const start = () => screen.getByLabelText(/Start date/)
const end = () => screen.getByLabelText(/End date/)

describe('LeagueSeasonDatesBlock (docs/specs/111)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLeagueSeasonDates.mockResolvedValue({ startDate: '2026-09-01', endDate: '2027-07-31' })
  })

  it('shows the saved dates and no banner', async () => {
    renderBlock()
    await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
    expect(end()).toHaveValue('2027-07-31')
    expect(screen.queryByTestId('season-dates-banner')).not.toBeInTheDocument()
    expect(getLeagueSeasonDates).toHaveBeenCalledWith('club-1', 'league-1', 'season-1')
  })

  it('shows the amber banner when no dates exist, and requires both dates', async () => {
    const user = userEvent.setup()
    getLeagueSeasonDates.mockResolvedValue(null)
    renderBlock()
    expect(await screen.findByTestId('season-dates-banner')).toHaveTextContent('Set the start and end date for 2026/2027.')

    await user.click(screen.getByRole('button', { name: 'Save Season Dates' }))
    expect(screen.getByText('Start date is required')).toBeInTheDocument()
    expect(screen.getByText('End date is required')).toBeInTheDocument()
    expect(putLeagueSeasonDates).not.toHaveBeenCalled()
  })

  it('refuses a start date after the end date without calling the server', async () => {
    const user = userEvent.setup()
    renderBlock()
    await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
    fireEvent.change(start(), { target: { value: '2027-08-01' } })

    expect(screen.getByText('Start date must be on or before the end date')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save Season Dates' }))
    expect(putLeagueSeasonDates).not.toHaveBeenCalled()
  })

  it('saves the dates and refreshes the dates, age reference and matches', async () => {
    const user = userEvent.setup()
    getLeagueSeasonDates.mockResolvedValue(null)
    putLeagueSeasonDates.mockResolvedValue({ startDate: '2026-09-01', endDate: '2027-07-31' })
    const { invalidate } = renderBlock()
    await screen.findByTestId('season-dates-banner')

    fireEvent.change(start(), { target: { value: '2026-09-01' } })
    fireEvent.change(end(), { target: { value: '2027-07-31' } })
    await user.click(screen.getByRole('button', { name: 'Save Season Dates' }))

    await waitFor(() =>
      expect(putLeagueSeasonDates).toHaveBeenCalledWith('club-1', 'league-1', 'season-1', {
        startDate: '2026-09-01',
        endDate: '2027-07-31',
      }),
    )
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'leagues', 'league-1'] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'matches'] })
    expect(await screen.findByText('Season dates saved.')).toBeInTheDocument()
  })

  it('shows the 409 message verbatim', async () => {
    const user = userEvent.setup()
    const message = '2 matches would fall outside these dates (from 5 Sep 2026 to 2 Aug 2027).'
    putLeagueSeasonDates.mockRejectedValue(serverError(409, message))
    renderBlock()
    await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
    fireEvent.change(end(), { target: { value: '2027-01-01' } })
    await user.click(screen.getByRole('button', { name: 'Save Season Dates' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('shows a 400 message verbatim', async () => {
    const user = userEvent.setup()
    putLeagueSeasonDates.mockRejectedValue(serverError(400, 'The start date must not be after the end date.'))
    renderBlock()
    await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
    await user.click(screen.getByRole('button', { name: 'Save Season Dates' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The start date must not be after the end date.')
  })

  it('reloads the inputs for another season', async () => {
    renderBlock('season-2')
    await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
    expect(getLeagueSeasonDates).toHaveBeenCalledWith('club-1', 'league-1', 'season-2')
  })

  it('has no Season select (the header pill chooses the season) and names the season', async () => {
    renderBlock()
    await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
    expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Season dates' })).toBeInTheDocument()
  })

  it('shows the two buttons at the same compact height, Use First and Last Match as the white secondary', async () => {
    renderBlock('season-1', [m(new Date(2026, 9, 6).toISOString())])
    await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
    const useBtn = screen.getByRole('button', { name: 'Use First and Last Match' })
    const saveBtn = screen.getByRole('button', { name: 'Save Season Dates' })
    expect(useBtn).toHaveClass('MuiButton-outlined')
    expect(saveBtn).toHaveClass('MuiButton-contained')
    expect(useBtn.className).toContain('MuiButton-sizeSmall')
    expect(saveBtn.className).toContain('MuiButton-sizeSmall')
  })

  describe('Use First and Last Match', () => {
    const btn = () => screen.getByRole('button', { name: 'Use First and Last Match' })

    it('fills the fields from the earliest and latest active match, without saving, and the note clears on edit', async () => {
      const user = userEvent.setup()
      getLeagueSeasonDates.mockResolvedValue(null)
      // 23:30 local must keep its local date (no UTC slicing); the inactive match is ignored.
      const late = new Date(2027, 2, 29, 23, 30).toISOString()
      const early = new Date(2026, 9, 6, 0, 15).toISOString()
      renderBlock('season-1', [m(late), m(early), m(new Date(2025, 0, 1).toISOString(), false)])
      expect(await screen.findByTestId('season-dates-banner')).toHaveTextContent('or use the first and last match')
      await user.click(btn())
      expect(start()).toHaveValue('2026-10-06')
      expect(end()).toHaveValue('2027-03-29')
      expect(screen.getByTestId('season-dates-range-note')).toHaveTextContent('From 6 Oct 2026 to 29 Mar 2027, 2 matches')
      expect(putLeagueSeasonDates).not.toHaveBeenCalled()
      fireEvent.change(end(), { target: { value: '2027-04-01' } })
      expect(screen.queryByTestId('season-dates-range-note')).not.toBeInTheDocument()
    })

    it('is disabled with no active matches', async () => {
      renderBlock('season-1', [m(new Date(2026, 9, 6).toISOString(), false)])
      await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
      expect(btn()).toBeDisabled()
    })

    it('stays available when dates are already saved', async () => {
      const user = userEvent.setup()
      renderBlock('season-1', [m(new Date(2026, 9, 6).toISOString())])
      await waitFor(() => expect(start()).toHaveValue('2026-09-01'))
      await user.click(btn())
      expect(start()).toHaveValue('2026-10-06')
      expect(end()).toHaveValue('2026-10-06')
    })
  })
})
