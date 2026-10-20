import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerStatsCard } from './PlayerStatsCard'

// docs/specs/103-player-stats.md, "The Stats card on the Player page" (with decision 24: the chips live in this card).
const usePlayerStats = vi.fn()
vi.mock('../../../api/playerStatsApi', () => ({
  usePlayerStats: (...args: unknown[]) => usePlayerStats(...args),
}))

const chips = [
  { label: 'Right-hand bat', on: true },
  { label: 'Off spin', on: true },
  { label: 'Wicketkeeper', on: false },
]

function makeStats(overrides: Record<string, unknown> = {}) {
  return {
    playerId: 'player-1',
    basis: { matchesCounted: 18, resultsWithBattingCard: 14, resultsWithBowlingCard: 12 },
    batting: { runs: 412, average: 29.43, strikeRate: 96.3 },
    bowling: { wickets: 21, economy: 5.8 },
    form: {
      batting: [
        { matchId: 'm1', matchDate: '2026-10-01', runs: 56, notOut: true, balls: 40 },
        { matchId: 'm2', matchDate: '2026-09-24', runs: 0, notOut: false, balls: 2 },
      ],
      bowling: [{ matchId: 'm1', matchDate: '2026-10-01', wickets: 2, runs: 21, balls: 24 }],
    },
    ...overrides,
  }
}

function renderCard() {
  return render(
    <MemoryRouter>
      <PlayerStatsCard clubId="club-1" playerId="player-1" chips={chips} />
    </MemoryRouter>,
  )
}

const figure = (label: string) => screen.getAllByTestId('player-info-field').find((field) => field.textContent?.startsWith(label)) as HTMLElement

describe('PlayerStatsCard', () => {
  beforeEach(() => {
    usePlayerStats.mockReset()
    usePlayerStats.mockReturnValue({ data: makeStats(), isPending: false, refetch: vi.fn() })
  })

  it('reads the career stats (no filters) for this player', () => {
    renderCard()
    expect(usePlayerStats).toHaveBeenCalledWith('club-1', 'player-1')
  })

  it('shows the six headline figures with the server values formatted', () => {
    renderCard()
    expect(screen.getAllByTestId('player-info-field')).toHaveLength(6)
    expect(figure('Matches')).toHaveTextContent('18')
    expect(figure('Runs')).toHaveTextContent('412')
    expect(figure('Batting avg')).toHaveTextContent('29.43')
    expect(figure('Strike rate')).toHaveTextContent('96.30')
    expect(figure('Wickets')).toHaveTextContent('21')
    expect(figure('Economy')).toHaveTextContent('5.80')
  })

  it('shows a dash, never a zero, for a null average or economy', () => {
    usePlayerStats.mockReturnValue({
      data: makeStats({ batting: { runs: 12, average: null, strikeRate: null }, bowling: { wickets: 0, economy: null } }),
      isPending: false,
      refetch: vi.fn(),
    })
    renderCard()
    expect(figure('Batting avg')).toHaveTextContent('–')
    expect(figure('Strike rate')).toHaveTextContent('–')
    expect(figure('Economy')).toHaveTextContent('–')
    expect(figure('Runs')).toHaveTextContent('12')
    expect(figure('Wickets')).toHaveTextContent('0')
  })

  it('dashes the batting and bowling figures when no card was captured, but keeps Matches', () => {
    usePlayerStats.mockReturnValue({
      data: makeStats({ basis: { matchesCounted: 3, resultsWithBattingCard: 0, resultsWithBowlingCard: 0 } }),
      isPending: false,
      refetch: vi.fn(),
    })
    renderCard()
    expect(figure('Matches')).toHaveTextContent('3')
    for (const label of ['Runs', 'Batting avg', 'Strike rate', 'Wickets', 'Economy']) expect(figure(label)).toHaveTextContent('–')
  })

  it('draws both form strips, newest first, with a star for not out and the shared tones', () => {
    renderCard()
    const batting = screen.getByRole('list', { name: 'Batting, last 5 innings' })
    expect(within(batting).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['56*', '0'])
    expect(screen.getByText('56*').closest('[data-tone]')).toHaveAttribute('data-tone', 'positive')
    expect(screen.getByText('0').closest('[data-tone]')).toHaveAttribute('data-tone', 'muted')
    const bowling = screen.getByRole('list', { name: 'Bowling, last 5 spells' })
    expect(within(bowling).getByText('2/21')).toBeInTheDocument()
  })

  it('leaves out a strip that has no innings or spells', () => {
    usePlayerStats.mockReturnValue({ data: makeStats({ form: { batting: [], bowling: [] } }), isPending: false, refetch: vi.fn() })
    renderCard()
    expect(screen.queryByTestId('form-strip')).not.toBeInTheDocument()
    usePlayerStats.mockReturnValue({
      data: makeStats({ form: { batting: [{ matchId: 'm1', matchDate: '', runs: 5, notOut: false, balls: null }], bowling: [] } }),
      isPending: false,
      refetch: vi.fn(),
    })
    renderCard()
    expect(screen.queryByRole('list', { name: 'Bowling, last 5 spells' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Batting, last 5 innings' })).toBeInTheDocument()
  })

  it('states the basis, and the empty message when no result counts yet', () => {
    renderCard()
    expect(screen.getByText(/Based on 18 published results with this player on the team list: 14 with a batting card, 12 with a bowling card\./)).toBeInTheDocument()
    usePlayerStats.mockReturnValue({
      data: makeStats({ basis: { matchesCounted: 0, resultsWithBattingCard: 0, resultsWithBowlingCard: 0 }, form: { batting: [], bowling: [] } }),
      isPending: false,
      refetch: vi.fn(),
    })
    renderCard()
    expect(screen.getByText(/No published results with this player on the team list yet/)).toBeInTheDocument()
  })

  it('View full breakdown is a real link (not a text link) to the stats page, in every state', () => {
    const { unmount } = renderCard()
    const link = screen.getByRole('link', { name: 'View full breakdown' })
    expect(link).toHaveAttribute('href', '/manage/players/player-1/stats')
    expect(link.className).toMatch(/MuiButton-outlined/)
    unmount()
    usePlayerStats.mockReturnValue({ data: undefined, isPending: true, refetch: vi.fn() })
    renderCard()
    expect(screen.getByRole('link', { name: 'View full breakdown' })).toHaveAttribute('href', '/manage/players/player-1/stats')
  })

  it('shows a skeleton while loading, with the chips still on the card', () => {
    usePlayerStats.mockReturnValue({ data: undefined, isPending: true, refetch: vi.fn() })
    renderCard()
    expect(screen.getByLabelText('Loading statistics')).toBeInTheDocument()
    expect(screen.queryAllByTestId('player-info-field')).toHaveLength(0)
    expect(screen.getAllByTestId('player-info-chip')).toHaveLength(3)
  })

  it('on a failure shows dashes, keeps the chips and offers a quiet Try again that refetches', async () => {
    const refetch = vi.fn()
    usePlayerStats.mockReturnValue({ data: undefined, isPending: false, refetch })
    renderCard()
    expect(screen.getAllByTestId('player-info-field').every((field) => field.textContent?.includes('–'))).toBe(true)
    expect(screen.getAllByTestId('player-info-chip')).toHaveLength(3)
    expect(screen.getByText(/couldn't be loaded/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('has no "coming soon" text in any state', () => {
    const { container, unmount } = renderCard()
    expect(container).not.toHaveTextContent(/coming soon/i)
    unmount()
    usePlayerStats.mockReturnValue({ data: undefined, isPending: true, refetch: vi.fn() })
    const loading = renderCard()
    expect(loading.container).not.toHaveTextContent(/coming soon/i)
  })
})
