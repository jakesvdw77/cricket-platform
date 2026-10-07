import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicSectionAvailabilityRound from './PublicSectionAvailabilityRound'
import type { PublicSectionAvailabilityRound as RoundDto } from '../../api/publicSectionAvailabilityApi'
import { identify, problem, renderAt, verified } from '../../test/publicAvailabilityTestUtils'
// The component renders through this shared formatter, so assertions stay correct in any locale.
import { formatBracketLabel } from '../../utils/dayPart'

const getRound = vi.fn()
const verify = vi.fn()
const getAnswers = vi.fn()
const putAnswers = vi.fn()

vi.mock('../../api/publicSectionAvailabilityApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/publicSectionAvailabilityApi')>()),
  getRound: (...args: unknown[]) => getRound(...args),
  verify: (...args: unknown[]) => verify(...args),
  getAnswers: (...args: unknown[]) => getAnswers(...args),
  putAnswers: (...args: unknown[]) => putAnswers(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

const morning = formatBracketLabel('2030-10-15', 'MORNING', ' · ')
const afternoon = formatBracketLabel('2030-10-15', 'AFTERNOON', ' · ')

function makeRound(overrides: Partial<RoundDto> = {}): RoundDto {
  return {
    roundId: 'round-1',
    description: 'Over 40 fixtures',
    sectionName: 'Over 40s',
    open: true,
    clubId: 'club-1',
    scheduledCloseAt: '2030-10-14T07:15:00Z',
    windows: [
      { windowId: 'w1', windowDate: '2030-10-15', dayPart: 'MORNING', open: true, matches: [{ homeTeamName: 'Villagers 1', awayTeamName: 'POHBS' }] },
      { windowId: 'w2', windowDate: '2030-10-15', dayPart: 'AFTERNOON', open: true, matches: [{ homeTeamName: 'Villagers 1', awayTeamName: null }] },
    ],
    ...overrides,
  }
}

const renderPage = () =>
  renderAt('/section-availability/round-1', '/section-availability/:roundId', <PublicSectionAvailabilityRound />)

describe('PublicSectionAvailabilityRound (group poll)', () => {
  it('walks identify, a partial answer per window, saved', async () => {
    getRound.mockResolvedValue(makeRound())
    verify.mockResolvedValue(verified())
    getAnswers.mockResolvedValue({ answers: [] })
    putAnswers.mockResolvedValue({ answers: [{ windowId: 'w1', status: 'AVAILABLE' }] })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Over 40 fixtures' })).toBeInTheDocument()
    expect(screen.getByText('Over 40s · 2 matches')).toBeInTheDocument()
    await identify(user, { first: 'Liam', last: 'Carter' })

    expect(await screen.findByText(morning)).toBeInTheDocument()
    expect(screen.getByText(afternoon)).toBeInTheDocument()
    expect(screen.getByText('Villagers 1 v POHBS')).toBeInTheDocument()
    expect(screen.getByText('Villagers 1 v TBC')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: `${morning}: Available` }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))

    expect(putAnswers).toHaveBeenCalledWith('round-1', 'player-1', 'tok-1', [{ windowId: 'w1', status: 'AVAILABLE' }])
    expect(await screen.findByText('Thanks, Liam')).toBeInTheDocument()
    expect(screen.getByText(morning)).toBeInTheDocument()
    expect(screen.queryByText(afternoon)).not.toBeInTheDocument()
  })

  it('prefills per window when changing a vote and sends both answers', async () => {
    getRound.mockResolvedValue(makeRound())
    verify.mockResolvedValue(verified())
    getAnswers.mockResolvedValue({
      answers: [
        { windowId: 'w1', status: 'AVAILABLE' },
        { windowId: 'w2', status: 'UNSURE' },
      ],
    })
    putAnswers.mockResolvedValue({
      answers: [
        { windowId: 'w1', status: 'AVAILABLE' },
        { windowId: 'w2', status: 'UNAVAILABLE' },
      ],
    })
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { level: 1 })
    await identify(user, { first: 'Liam', last: 'Carter' })
    expect(await screen.findByRole('button', { name: `${morning}: Available` })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: `${afternoon}: Unsure` })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: `${afternoon}: Unavailable` }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    expect(putAnswers).toHaveBeenCalledWith('round-1', 'player-1', 'tok-1', [
      { windowId: 'w1', status: 'AVAILABLE' },
      { windowId: 'w2', status: 'UNAVAILABLE' },
    ])
    expect(await screen.findByText('Thanks, Liam')).toBeInTheDocument()
  })

  it('keeps the chosen answers across an expired token', async () => {
    getRound.mockResolvedValue(makeRound())
    verify.mockResolvedValue(verified())
    getAnswers.mockResolvedValue({ answers: [] })
    putAnswers.mockRejectedValueOnce(problem(401))
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('heading', { level: 1 })
    await identify(user, { first: 'Liam', last: 'Carter' })
    await user.click(await screen.findByRole('button', { name: `${afternoon}: Unsure` }))
    await user.click(screen.getByRole('button', { name: 'Save my answer' }))
    expect(await screen.findByText(/Your 30 minutes ran out/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Day'), '4')
    await user.type(screen.getByLabelText('Month'), '3')
    await user.type(screen.getByLabelText('Year'), '1985')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByRole('button', { name: `${afternoon}: Unsure` })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a window that has closed as read-only', async () => {
    getRound.mockResolvedValue(
      makeRound({
        windows: [
          { windowId: 'w1', windowDate: '2030-10-15', dayPart: 'MORNING', open: false, matches: [] },
          { windowId: 'w2', windowDate: '2030-10-15', dayPart: 'AFTERNOON', open: true, matches: [] },
        ],
      }),
    )
    verify.mockResolvedValue(verified())
    getAnswers.mockResolvedValue({ answers: [{ windowId: 'w1', status: 'AVAILABLE' }] })
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    await identify(user, { first: 'Liam', last: 'Carter' })
    expect(await screen.findByRole('button', { name: `${morning}: Available` })).toBeDisabled()
    expect(screen.getByRole('button', { name: `${afternoon}: Available` })).toBeEnabled()
  })

  it('shows a closed round as read-only', async () => {
    getRound.mockResolvedValue(makeRound({ open: false }))
    renderPage()
    expect(await screen.findByText('Closed')).toBeInTheDocument()
    expect(screen.getByText(/This poll has closed/)).toBeInTheDocument()
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
  })

  it('shows a friendly page for an unknown link', async () => {
    getRound.mockRejectedValue(problem(404))
    renderPage()
    expect(await screen.findByText('Poll not found')).toBeInTheDocument()
  })
})
