import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicSectionAvailabilityRound from './PublicSectionAvailabilityRound'
import type { PublicSectionAvailabilityRound as PublicSectionAvailabilityRoundDto } from '../../api/publicSectionAvailabilityApi'
// Mirrors formatBracketLabel exactly (the shared util the component itself renders through), so
// these assertions stay correct regardless of the CI/local machine's own locale/timezone rather
// than hardcoding a literal formatted string.
import { formatBracketLabel as bracketLabel } from '../../utils/dayPart'

const getRound = vi.fn()
const setAvailability = vi.fn()

vi.mock('../../api/publicSectionAvailabilityApi', () => ({
  getRound: (roundId: string) => getRound(roundId),
  setAvailability: (roundId: string, playerProfileId: string, windowId: string, status: string) =>
    setAvailability(roundId, playerProfileId, windowId, status),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRound(overrides: Partial<PublicSectionAvailabilityRoundDto> = {}): PublicSectionAvailabilityRoundDto {
  return {
    roundId: 'round-1',
    description: 'Sat 6 Jun - U13 Boys fixtures',
    sectionName: 'U13 Boys',
    open: true,
    responses: [
      {
        playerProfileId: 'p1',
        firstName: 'Jane',
        lastName: 'Smith',
        jerseyNumber: 7,
        statuses: [
          { windowId: 'window-1', dayPart: 'MORNING', windowDate: '2026-06-06', status: 'AVAILABLE' },
          { windowId: 'window-2', dayPart: 'AFTERNOON', windowDate: '2026-06-06', status: null },
        ],
      },
      {
        playerProfileId: 'p2',
        firstName: 'Bob',
        lastName: 'Jones',
        jerseyNumber: null,
        statuses: [
          { windowId: 'window-1', dayPart: 'MORNING', windowDate: '2026-06-06', status: null },
          { windowId: 'window-2', dayPart: 'AFTERNOON', windowDate: '2026-06-06', status: null },
        ],
      },
    ],
    ...overrides,
  }
}

function renderPage(roundId = 'round-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/section-availability/${roundId}`]}>
        <Routes>
          <Route path="/section-availability/:roundId" element={<PublicSectionAvailabilityRound />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicSectionAvailabilityRound', () => {
  it('renders eligible-player rows with one toggle group per bracket the round owns, pre-selected to their current status', async () => {
    getRound.mockResolvedValueOnce(makeRound())
    renderPage()

    expect(await screen.findByText('#7 Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByLabelText(`#7 Jane Smith ${bracketLabel('2026-06-06', 'MORNING')}: Available`)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(`#7 Jane Smith ${bracketLabel('2026-06-06', 'AFTERNOON')}: Available`)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText(`Bob Jones ${bracketLabel('2026-06-06', 'MORNING')}: Available`)).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders the round\'s own description as the title, with the section name below it, no bare date range', async () => {
    getRound.mockResolvedValueOnce(makeRound())
    renderPage()

    expect(await screen.findByText('Sat 6 Jun - U13 Boys fixtures')).toBeInTheDocument()
    expect(screen.getByText('U13 Boys')).toBeInTheDocument()
  })

  it('renders exactly one toggle group per status entry the round owns - a single-bracket round renders one', async () => {
    getRound.mockResolvedValueOnce(
      makeRound({
        responses: [
          {
            playerProfileId: 'p2',
            firstName: 'Bob',
            lastName: 'Jones',
            jerseyNumber: null,
            statuses: [{ windowId: 'window-1', dayPart: 'MORNING', windowDate: '2026-06-06', status: null }],
          },
        ],
      }),
    )
    renderPage()

    await screen.findByText('Bob Jones')
    expect(screen.getByLabelText(`Bob Jones ${bracketLabel('2026-06-06', 'MORNING')}: Available`)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Afternoon/)).not.toBeInTheDocument()
  })

  it('renders several toggle groups when a round spans a whole weekend (three brackets)', async () => {
    getRound.mockResolvedValueOnce(
      makeRound({
        responses: [
          {
            playerProfileId: 'p2',
            firstName: 'Bob',
            lastName: 'Jones',
            jerseyNumber: null,
            statuses: [
              { windowId: 'window-1', dayPart: 'MORNING', windowDate: '2026-06-06', status: null },
              { windowId: 'window-2', dayPart: 'AFTERNOON', windowDate: '2026-06-06', status: null },
              { windowId: 'window-3', dayPart: 'MORNING', windowDate: '2026-06-07', status: null },
            ],
          },
        ],
      }),
    )
    renderPage()

    await screen.findByText('Bob Jones')
    expect(screen.getByLabelText(`Bob Jones ${bracketLabel('2026-06-06', 'MORNING')}: Available`)).toBeInTheDocument()
    expect(screen.getByLabelText(`Bob Jones ${bracketLabel('2026-06-06', 'AFTERNOON')}: Available`)).toBeInTheDocument()
    expect(screen.getByLabelText(`Bob Jones ${bracketLabel('2026-06-07', 'MORNING')}: Available`)).toBeInTheDocument()
  })

  it('tapping a bracket status on a row calls setAvailability for that playerProfileId and windowId only', async () => {
    const user = userEvent.setup()
    getRound.mockResolvedValue(makeRound())
    setAvailability.mockResolvedValueOnce(makeRound())
    renderPage()

    await screen.findByText('Bob Jones')
    await user.click(screen.getByLabelText(`Bob Jones ${bracketLabel('2026-06-06', 'AFTERNOON')}: Unavailable`))

    expect(setAvailability).toHaveBeenCalledWith('round-1', 'p2', 'window-2', 'UNAVAILABLE')
  })

  it("disables every row's toggle groups when the round is closed", async () => {
    getRound.mockResolvedValueOnce(makeRound({ open: false }))
    renderPage()

    await screen.findByText('Bob Jones')
    expect(screen.getByText(/this round is closed/i)).toBeInTheDocument()
    expect(screen.getByLabelText(`Bob Jones ${bracketLabel('2026-06-06', 'MORNING')}: Available`)).toBeDisabled()
    expect(screen.getByLabelText(`#7 Jane Smith ${bracketLabel('2026-06-06', 'AFTERNOON')}: Available`)).toBeDisabled()
  })

  it('renders a clean "Round not found" message on a 404', async () => {
    getRound.mockRejectedValueOnce(
      new AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: {},
        statusText: 'Not Found',
        headers: {},
        config: {} as never,
      }),
    )
    renderPage('unknown-round')

    expect(await screen.findByText('Round not found')).toBeInTheDocument()
  })
})
