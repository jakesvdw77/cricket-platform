import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchDateTimeDialog } from './MatchDateTimeDialog'
import * as matchApi from '../../api/matchApi'

vi.mock('../../api/matchApi')

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
})
