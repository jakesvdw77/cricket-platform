import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayoffGamesDialog } from './PlayoffGamesDialog'
import type { Match } from '../../api/matchApi'

const previewPlayoffs = vi.fn()
const createPlayoffs = vi.fn()
vi.mock('../../api/playoffApi', () => ({
  previewPlayoffs: (...args: unknown[]) => previewPlayoffs(...args),
  createPlayoffs: (...args: unknown[]) => createPlayoffs(...args),
}))
// The field search needs its own API; the dialog only passes the chosen field through.
vi.mock('../FieldPicker', () => ({ FieldPicker: () => <div data-testid="field-picker" /> }))

const ownTeams = [{ id: 't1', name: 'Irene Veterans' }] as never
const leagueTeams = [{ id: 'lt1', name: 'Paarl Heat' }, { id: 'lt2', name: 'Midlands CC' }, { id: 'lt3', name: 'Boland' }] as never

const created = (patch: Partial<Match>): Match =>
  ({ id: 'm1', homeTeamName: '1st in the pool', awayTeamName: '2nd in the pool', homePlaceholder: true, awayPlaceholder: true, matchDate: '2026-11-21T10:00:00', venue: null, stage: 'Playoff', ...patch }) as Match

function renderDialog(props: Partial<React.ComponentProps<typeof PlayoffGamesDialog>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = vi.fn()
  const onCreated = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <PlayoffGamesDialog open onClose={onClose} onCreated={onCreated} clubId="c1" leagueId="l1" seasonId="s1" ownTeams={ownTeams} leagueTeams={leagueTeams} {...props} />
    </QueryClientProvider>,
  )
  return { onClose, onCreated }
}

const rows = () => screen.getAllByTestId('playoff-row')

beforeEach(() => {
  vi.clearAllMocks()
  previewPlayoffs.mockResolvedValue([created({ id: 'm1' }), created({ id: 'm2', homeTeamName: '3rd in the pool', awayTeamName: '4th in the pool' })])
  createPlayoffs.mockResolvedValue([created({ id: 'm1' })])
})

describe('PlayoffGamesDialog (spec 155)', () => {
  it('starts with one empty game and Review disabled until it is complete', () => {
    renderDialog()
    expect(rows()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled()
  })

  it('fills one game per finishing pair from the team count (4 teams make 2 games)', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Fill 1v2, 3v4...' }))
    expect(rows()).toHaveLength(2)
    expect(within(rows()[1]).getByDisplayValue('3rd v 4th')).toBeInTheDocument()
    expect(within(rows()[1]).getByDisplayValue('3rd in the pool')).toBeInTheDocument()
  })

  it('fills two semi-finals and a final', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Fill Semi-finals And Final' }))
    expect(rows()).toHaveLength(3)
    expect(within(rows()[2]).getByLabelText('Stage')).toHaveValue('Final')
    expect(within(rows()[2]).getByLabelText('Label')).toHaveValue('Final')
    expect(within(rows()[2]).getByDisplayValue('Winner of semi-final 1')).toBeInTheDocument()
  })

  it('adds and removes games', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Add Game' }))
    expect(rows()).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Remove game 1' }))
    expect(rows()).toHaveLength(1)
  })

  it('writes nothing on Review, shows the confirm step, and only Create Games writes', async () => {
    const { onCreated, onClose } = renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Fill 1v2, 3v4...' }))
    for (const row of rows()) fireEvent.change(within(row).getByLabelText('Date & time (date)'), { target: { value: '2026-11-21' } })
    for (const row of rows()) fireEvent.change(within(row).getByLabelText('Date & time (time)'), { target: { value: '10:00' } })

    await userEvent.click(screen.getByRole('button', { name: 'Review' }))
    await waitFor(() => expect(screen.getByText('Create 2 games?')).toBeInTheDocument())
    expect(previewPlayoffs).toHaveBeenCalledTimes(1)
    expect(createPlayoffs).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('playoff-review-row')).toHaveLength(2)
    expect(screen.getByText('Nothing has been created yet.', { exact: false })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Create 2 Games' }))
    await waitFor(() => expect(createPlayoffs).toHaveBeenCalledTimes(1))
    const round = createPlayoffs.mock.calls[0][3]
    expect(round.stage).toBe('Playoff')
    expect(round.games[0]).toMatchObject({ label: '1st v 2nd', home: { placeholder: '1st in the pool' }, away: { placeholder: '2nd in the pool' } })
    expect(onCreated).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('Back returns to the games without writing', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Fill 1v2, 3v4...' }))
    for (const row of rows()) {
      fireEvent.change(within(row).getByLabelText('Date & time (date)'), { target: { value: '2026-11-21' } })
      fireEvent.change(within(row).getByLabelText('Date & time (time)'), { target: { value: '10:00' } })
    }
    await userEvent.click(screen.getByRole('button', { name: 'Review' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Back' }))
    expect(rows()).toHaveLength(2)
    expect(createPlayoffs).not.toHaveBeenCalled()
  })

  it('shows the server message when the review is refused and stays on the games', async () => {
    previewPlayoffs.mockRejectedValue({ response: { data: { detail: 'This league runs from 19 Nov 2026 to 21 Nov 2026.' } } })
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Fill 1v2, 3v4...' }))
    for (const row of rows()) {
      fireEvent.change(within(row).getByLabelText('Date & time (date)'), { target: { value: '2026-12-05' } })
      fireEvent.change(within(row).getByLabelText('Date & time (time)'), { target: { value: '10:00' } })
    }
    await userEvent.click(screen.getByRole('button', { name: 'Review' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(rows()).toHaveLength(2)
  })

  it('keeps Review disabled when a TBC side has no text', async () => {
    renderDialog()
    const row = rows()[0]
    fireEvent.change(within(row).getByLabelText('Date & time (date)'), { target: { value: '2026-11-21' } })
    fireEvent.change(within(row).getByLabelText('Date & time (time)'), { target: { value: '10:00' } })
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled()
    expect(screen.getByText('Every TBC side needs its text, for example 1st in the pool.')).toBeInTheDocument()
  })
})
