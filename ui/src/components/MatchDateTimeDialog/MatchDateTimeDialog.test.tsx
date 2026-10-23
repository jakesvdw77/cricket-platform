import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchDateTimeDialog } from './MatchDateTimeDialog'
import * as matchApi from '../../api/matchApi'
import { toDatetimeLocal } from '../../utils/datetimeLocal'

vi.mock('../../api/matchApi')
const getLeagueSeasonDates = vi.fn()
vi.mock('../../api/leagueSeasonDatesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/leagueSeasonDatesApi')>()),
  getLeagueSeasonDates: (...args: unknown[]) => getLeagueSeasonDates(...args),
}))

function renderDialog(onSaved = vi.fn(), onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MatchDateTimeDialog open onClose={onClose} onSaved={onSaved} clubId="c1" matchId="m1" matchDate="2026-10-04T08:00:00.000Z" />
    </QueryClientProvider>,
  )
  return { onSaved, onClose }
}

describe('MatchDateTimeDialog', () => {
  beforeEach(() => vi.resetAllMocks())

  it('saves only the date and closes', async () => {
    vi.mocked(matchApi.updateMatchDateTime).mockResolvedValue({ id: 'm1' } as matchApi.Match)
    const { onSaved, onClose } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(matchApi.updateMatchDateTime).toHaveBeenCalledWith('c1', 'm1', '2026-10-04T08:00:00.000Z')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the league-dates refusal on the field and stays open', async () => {
    const error = new AxiosError('bad', '400', undefined, undefined, {
      status: 400,
      data: { code: 'MATCH_OUTSIDE_LEAGUE_DATES', detail: 'This league runs from 1 Sep to 31 Jul.' },
    } as never)
    vi.mocked(matchApi.updateMatchDateTime).mockRejectedValue(error)
    const { onClose } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('This league runs from 1 Sep to 31 Jul.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('sends nothing on Cancel', async () => {
    const { onClose } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(matchApi.updateMatchDateTime).not.toHaveBeenCalled()
  })

  it('opens prefilled with the match date and time', () => {
    renderDialog()
    const [day, time] = toDatetimeLocal('2026-10-04T08:00:00.000Z').split('T')
    expect(screen.getByLabelText('Match date & time (date)')).toHaveValue(day)
    expect(screen.getByLabelText('Match date & time (time)')).toHaveValue(time)
  })

  it('sends the changed date and time as an instant', async () => {
    vi.mocked(matchApi.updateMatchDateTime).mockResolvedValue({ id: 'm1' } as matchApi.Match)
    renderDialog()
    fireEvent.change(screen.getByLabelText('Match date & time (date)'), { target: { value: '2026-10-11' } })
    fireEvent.change(screen.getByLabelText('Match date & time (time)'), { target: { value: '13:30' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(matchApi.updateMatchDateTime).toHaveBeenCalled())
    expect(matchApi.updateMatchDateTime).toHaveBeenCalledWith('c1', 'm1', new Date('2026-10-11T13:30').toISOString())
  })

  it('shows any other failure in the dialog, which stays open', async () => {
    vi.mocked(matchApi.updateMatchDateTime).mockRejectedValue(new AxiosError('boom', '500', undefined, undefined, { status: 500, data: {} } as never))
    const { onClose, onSaved } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not change the date and time. Please try again.')
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('warns before saving when the chosen day is outside the league season dates, and disables Save', async () => {
    getLeagueSeasonDates.mockResolvedValue({ startDate: '2026-09-01', endDate: '2027-07-31' })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MatchDateTimeDialog open onClose={vi.fn()} onSaved={vi.fn()} clubId="c1" matchId="m1" matchDate="2026-10-04T08:00:00.000Z" leagueId="l1" seasonId="s1" />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalledWith('c1', 'l1', 's1'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Match date & time (date)'), { target: { value: '2027-09-01' } })
    expect(await screen.findByText(/This league runs from/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
