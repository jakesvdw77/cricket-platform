import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DuplicateLeagueDialog } from './DuplicateLeagueDialog'
import type { Season } from '../../../api/seasonApi'

const mocks = vi.hoisted(() => ({ duplicateLeague: vi.fn() }))

vi.mock('../../../api/leagueApi', () => ({
  duplicateLeague: (clubId: string, leagueId: string, request: unknown) => mocks.duplicateLeague(clubId, leagueId, request),
}))

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'club-1',
    label: '2025',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

const SEASONS = [
  makeSeason({ id: 'season-1', label: '2024', startDate: '2024-01-01', endDate: '2024-12-31' }),
  makeSeason({ id: 'season-3', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31' }),
  makeSeason({ id: 'season-2', label: '2025', startDate: '2025-01-01', endDate: '2025-12-31' }),
]

const RESPONSE = { leagueId: 'new-1', name: 'Division 2', seasonsCopied: 1, playingConditionsCopied: 1, contactsCopied: 2 }

function Probe() {
  const location = useLocation()
  return (
    <>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <div data-testid="state">{JSON.stringify(location.state)}</div>
    </>
  )
}

function conflictError(detail?: string) {
  return new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409,
    data: detail ? { detail } : {},
    statusText: 'Conflict',
    headers: {},
    config: {} as never,
  })
}

function renderDialog(props: Partial<Parameters<typeof DuplicateLeagueDialog>[0]> = {}) {
  const onClose = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/fixtures/leagues/league-1/schedule']}>
        <Probe />
        <DuplicateLeagueDialog
          open
          clubId="club-1"
          league={{ id: 'league-1', name: 'Division 1' }}
          seasons={SEASONS}
          defaultSeasonId="season-2"
          onClose={onClose}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { onClose, invalidate }
}

const nameInput = () => screen.getByLabelText(/New league name/) as HTMLInputElement
const submit = () => screen.getByRole('button', { name: /Duplicate league|Duplicating/ })

describe('DuplicateLeagueDialog', () => {
  beforeEach(() => {
    mocks.duplicateLeague.mockReset()
    mocks.duplicateLeague.mockResolvedValue(RESPONSE)
  })

  it('shows the title, help line and the always and never copied lines', () => {
    renderDialog()

    expect(screen.getByRole('heading', { name: 'Duplicate league' })).toBeInTheDocument()
    expect(
      screen.getByText('Creates a new league with the same setup. Its teams and matches start empty, so you can add them next.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Always copied: format, playing XI size, age rules and cutoff date, logo, phone, email, website and social links.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Not copied: the club's team entries, opponent teams, matches and results/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /affiliation/i })).not.toBeInTheDocument()
  })

  it('prefills the name as "<name> (copy)", focused with the whole text selected', () => {
    renderDialog()

    expect(nameInput()).toHaveValue('Division 1 (copy)')
    expect(nameInput()).toHaveFocus()
    expect(nameInput().selectionStart).toBe(0)
    expect(nameInput().selectionEnd).toBe('Division 1 (copy)'.length)
  })

  it('disables Duplicate league while the name is blank', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.clear(nameInput())
    expect(submit()).toBeDisabled()
    await user.type(nameInput(), '   ')
    expect(submit()).toBeDisabled()
  })

  it('blocks a name over 255 characters', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.clear(nameInput())
    await user.click(nameInput())
    await user.paste('x'.repeat(256))
    expect(submit()).toBeDisabled()
    expect(screen.getByText('Keep the name to 255 characters or fewer')).toBeInTheDocument()
  })

  it('ticks both options and only the default season on open, newest season first', () => {
    renderDialog()

    expect(screen.getByRole('checkbox', { name: 'Copy playing conditions' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Copy contacts' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '2025' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '2024' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: '2026' })).not.toBeChecked()
    const labels = screen.getAllByRole('checkbox', { name: /^20\d\d$/ }).map((box) => box.getAttribute('aria-label'))
    expect(labels).toEqual(['2026', '2025', '2024'])
    expect(submit()).toBeEnabled()
  })

  it('ticks no season when the default is not one of the club seasons, and then blocks with the hint', () => {
    renderDialog({ defaultSeasonId: 'unknown' })

    expect(screen.getAllByRole('checkbox', { name: /^20\d\d$/ }).some((box) => (box as HTMLInputElement).checked)).toBe(false)
    expect(submit()).toBeDisabled()
    expect(screen.getByText('Choose at least one season, or untick Copy playing conditions')).toBeInTheDocument()
  })

  it('Select all and Select none change the chosen seasons', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getAllByRole('checkbox', { name: /^20\d\d$/ }).every((box) => (box as HTMLInputElement).checked)).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Select none' }))
    expect(screen.getAllByRole('checkbox', { name: /^20\d\d$/ }).some((box) => (box as HTMLInputElement).checked)).toBe(false)
    expect(submit()).toBeDisabled()
  })

  it('hides the season list when conditions are unticked and then does not block on seasons', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: 'Select none' }))
    expect(submit()).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Copy playing conditions' }))

    expect(screen.queryByRole('group', { name: 'Seasons to copy' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Choose at least one season/)).not.toBeInTheDocument()
    expect(submit()).toBeEnabled()
  })

  it('sends nothing until Duplicate league is clicked, and Cancel sends nothing', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.type(nameInput(), ' 2')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(mocks.duplicateLeague).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('sends the trimmed name, the chosen seasons and both flags', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.clear(nameInput())
    await user.type(nameInput(), '  Division 2  ')
    await user.click(screen.getByRole('checkbox', { name: '2026' }))
    await user.click(submit())

    await waitFor(() => expect(mocks.duplicateLeague).toHaveBeenCalledTimes(1))
    expect(mocks.duplicateLeague).toHaveBeenCalledWith('club-1', 'league-1', {
      name: 'Division 2',
      seasonIds: ['season-3', 'season-2'],
      copyPlayingConditions: true,
      copyContacts: true,
    })
  })

  it('sends an empty season list and the flag false when conditions are unticked, and contacts false when unticked', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('checkbox', { name: 'Copy playing conditions' }))
    await user.click(screen.getByRole('checkbox', { name: 'Copy contacts' }))
    await user.click(submit())

    await waitFor(() => expect(mocks.duplicateLeague).toHaveBeenCalledTimes(1))
    expect(mocks.duplicateLeague).toHaveBeenCalledWith('club-1', 'league-1', {
      name: 'Division 1 (copy)',
      seasonIds: [],
      copyPlayingConditions: false,
      copyContacts: false,
    })
  })

  it('shows Duplicating while the request is pending and disables the footer', async () => {
    const user = userEvent.setup()
    mocks.duplicateLeague.mockReturnValue(new Promise(() => {}))
    renderDialog()

    await user.click(submit())

    expect(await screen.findByRole('button', { name: 'Duplicating…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('on success invalidates the league keys, closes and navigates to the new league Teams tab with a notice', async () => {
    const user = userEvent.setup()
    const { onClose, invalidate } = renderDialog()

    await user.clear(nameInput())
    await user.type(nameInput(), 'Division 2')
    await user.click(submit())

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/manage/fixtures/leagues/new-1/edit?tab=teams&seasonId=season-2',
      ),
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'leagues'] })
    expect(onClose).toHaveBeenCalled()
    expect(JSON.parse(screen.getByTestId('state').textContent as string)).toEqual({
      notice: 'Division 2 created. Playing conditions copied for 1 season, 2 contacts. Add its teams next.',
    })
  })

  it('lands without a seasonId when no season was chosen and there is no default', async () => {
    const user = userEvent.setup()
    mocks.duplicateLeague.mockResolvedValue({ ...RESPONSE, playingConditionsCopied: 0, contactsCopied: 0 })
    renderDialog({ defaultSeasonId: '' })

    await user.click(screen.getByRole('checkbox', { name: 'Copy playing conditions' }))
    await user.click(submit())

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/manage/fixtures/leagues/new-1/edit?tab=teams'),
    )
    expect(screen.getByTestId('location')).not.toHaveTextContent('seasonId')
    expect(JSON.parse(screen.getByTestId('state').textContent as string)).toEqual({
      notice: 'Division 2 created. Add its teams next.',
    })
  })

  it('shows a 409 against the name field using the server detail, and keeps the dialog open', async () => {
    const user = userEvent.setup()
    mocks.duplicateLeague.mockRejectedValue(conflictError('A league named Division 1 (copy) already exists'))
    const { onClose } = renderDialog()

    await user.click(submit())

    expect(await screen.findByText('A league named Division 1 (copy) already exists')).toBeInTheDocument()
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByTestId('location')).toHaveTextContent('/manage/fixtures/leagues/league-1/schedule')

    await user.type(nameInput(), '2')
    expect(screen.queryByText('A league named Division 1 (copy) already exists')).not.toBeInTheDocument()
  })

  it('falls back to a generic 409 message naming the league when the server sends no detail', async () => {
    const user = userEvent.setup()
    mocks.duplicateLeague.mockRejectedValue(conflictError())
    renderDialog()

    await user.click(submit())

    expect(await screen.findByText('A league named Division 1 (copy) already exists')).toBeInTheDocument()
  })

  it('shows any other error in an alert and keeps the dialog open', async () => {
    const user = userEvent.setup()
    mocks.duplicateLeague.mockRejectedValue(new Error('boom'))
    const { onClose } = renderDialog()

    await user.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong duplicating this league. Please try again.')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables and unticks Copy playing conditions when the club has no seasons', async () => {
    const user = userEvent.setup()
    renderDialog({ seasons: [], defaultSeasonId: '' })

    const box = screen.getByRole('checkbox', { name: 'Copy playing conditions' })
    expect(box).toBeDisabled()
    expect(box).not.toBeChecked()
    expect(screen.getByText(/no seasons yet/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Seasons to copy' })).not.toBeInTheDocument()
    expect(submit()).toBeEnabled()

    await user.click(submit())
    await waitFor(() => expect(mocks.duplicateLeague).toHaveBeenCalledTimes(1))
    expect(mocks.duplicateLeague.mock.calls[0][2]).toMatchObject({ seasonIds: [], copyPlayingConditions: false })
  })
})
