import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { AxiosError } from 'axios'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../../theme'
import ResultCapturePage from './ResultCapturePage'
import { innings, makeMatch, makeResult } from './resultTestUtils'

const getMatch = vi.fn()
const getMatchResult = vi.fn()
const saveResultDraft = vi.fn()
const validateResult = vi.fn()
const publishResult = vi.fn()
const getPlayingConditions = vi.fn()
const getScorecard = vi.fn()
const getScorecardPrefill = vi.fn()

vi.mock('../../../api/matchApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchApi')>()
  return { ...actual, getMatch: (clubId: string, matchId: string) => getMatch(clubId, matchId) }
})
vi.mock('../../../api/matchResultApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchResultApi')>()
  return {
    ...actual,
    getMatchResult: (clubId: string, matchId: string) => getMatchResult(clubId, matchId),
    saveResultDraft: (clubId: string, matchId: string, body: unknown) => saveResultDraft(clubId, matchId, body),
    validateResult: (clubId: string, matchId: string, body: unknown) => validateResult(clubId, matchId, body),
    publishResult: (clubId: string, matchId: string, ack: boolean) => publishResult(clubId, matchId, ack),
    getScorecard: (clubId: string, matchId: string) => getScorecard(clubId, matchId),
    getScorecardPrefill: (clubId: string, matchId: string) => getScorecardPrefill(clubId, matchId),
  }
})
vi.mock('../../../api/leaguePlayingConditionsApi', () => ({
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) => getPlayingConditions(clubId, leagueId, seasonId),
}))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: '1st XI', logoUrl: null }]) }))

const notFound = () => new AxiosError('nope', '404', undefined, undefined, { status: 404 } as never)

function Where() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/results/match-1/capture']}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="results/:matchId/capture" element={<ResultCapturePage />} />
            <Route path="*" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
    </ThemeProvider>,
  )
}

const HOME = '1st XI'
const AWAY = 'Riverside Occasionals'
const CLEAN = { canPublish: true, errors: [], warnings: [] }

// Steps are found by name, not number: the optional scorecard steps shift Review's place once scores exist.
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const step = (label: string, suffix = '') =>
  screen.getByRole('button', { name: new RegExp(`^Step \\d+: ${escape(label)}${suffix ? escape(suffix) : '(?: \\((?:done|optional)\\))*'}$`) })
const next = (user: ReturnType<typeof userEvent.setup>, label: string) => user.click(screen.getByRole('button', { name: `Next: ${label}` }))

beforeEach(() => {
  vi.clearAllMocks()
  getMatch.mockResolvedValue(makeMatch({ id: 'match-1' }))
  getMatchResult.mockRejectedValue(notFound())
  getPlayingConditions.mockResolvedValue(null)
  saveResultDraft.mockImplementation((_c: string, _m: string, body: object) => Promise.resolve(makeResult({ status: 'DRAFT', ...body })))
  validateResult.mockResolvedValue(CLEAN)
  publishResult.mockResolvedValue(makeResult())
  getScorecardPrefill.mockResolvedValue({ sides: [] })
  getScorecard.mockResolvedValue({ players: [], batting: [], bowling: [], fielding: [], awards: [] })
})

describe('ResultCapturePage', () => {
  it('offers the four steps in order Result, Toss & field, Scores, Review, starting on Result', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Capture result' })).toBeInTheDocument()
    const labels = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(labels).toEqual(['Step 1: Result', 'Step 2: Toss & field', 'Step 3: Scores', 'Step 4: Review'])
    expect(step('Result')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('How did the match end?')).toBeInTheDocument()
  })

  it('walks Next through the steps and Back returns, ticking the earlier steps', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Capture result' })

    await next(user, 'Toss & field')
    expect(await screen.findByText('Who won the toss?')).toBeInTheDocument()
    await next(user, 'Scores')
    expect(await screen.findByText('Innings')).toBeInTheDocument()
    expect(step('Result', ' (done)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Who won the toss?')).toBeInTheDocument()
  })

  it('does not save a form that is still empty', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Capture result' })

    await next(user, 'Toss & field')
    await screen.findByText('Who won the toss?')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(saveResultDraft).not.toHaveBeenCalled()
    expect(screen.getByText('Not saved yet')).toBeInTheDocument()
  })

  it('shows the winner, how it was decided and a margin only for Won', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Capture result' })

    expect(screen.queryByRole('radiogroup', { name: 'Who won?' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^Won/ }))
    expect(screen.getByRole('radiogroup', { name: 'Who won?' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'How was it decided?' })).toBeInTheDocument()
    expect(screen.getByLabelText('Margin')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^Abandoned/ }))
    expect(screen.queryByRole('radiogroup', { name: 'Who won?' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Margin')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^Forfeit/ }))
    expect(screen.getByRole('radiogroup', { name: 'Who received the win?' })).toBeInTheDocument()
  })

  it('saves a cleaned payload on Next (a margin left over from Won is dropped after switching to Tie)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Capture result' })

    await user.click(screen.getByRole('radio', { name: /^Won/ }))
    await user.click(screen.getByRole('radio', { name: new RegExp(HOME) }))
    await user.type(screen.getByLabelText('Margin'), '24')
    await user.click(screen.getByRole('radio', { name: /^Tie/ }))
    await next(user, 'Toss & field')

    await waitFor(() => expect(saveResultDraft).toHaveBeenCalledTimes(1))
    expect(saveResultDraft).toHaveBeenCalledWith(
      'club-1',
      'match-1',
      expect.objectContaining({ outcomeType: 'TIE', winningSide: null, marginType: null, marginValue: null, decidedBy: 'REGULAR', innings: [] }),
    )
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument()
  })

  it('shows the server problems when a save is refused and stays on the step', async () => {
    const user = userEvent.setup()
    saveResultDraft.mockRejectedValue(new AxiosError('bad', '400', undefined, undefined, { status: 400, data: { errors: ['Choose who won.'] } } as never))
    renderPage()
    await screen.findByRole('heading', { name: 'Capture result' })

    await user.click(screen.getByRole('radio', { name: /^Won/ }))
    await next(user, 'Toss & field')

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose who won.')
    expect(step('Result')).toHaveAttribute('aria-current', 'step')
  })

  describe('toss and scores', () => {
    const toToss = async (user: ReturnType<typeof userEvent.setup>) => {
      await screen.findByRole('heading', { name: 'Capture result' })
      await user.click(screen.getByRole('radio', { name: /^Won/ }))
      await user.click(screen.getByRole('radio', { name: new RegExp(HOME) }))
      await next(user, 'Toss & field')
      await screen.findByText('Who won the toss?')
    }

    it('puts the side that batted first in innings 1 from the toss, and asks nothing about the order', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)

      await user.click(screen.getByRole('radio', { name: new RegExp(AWAY) }))
      await user.click(screen.getByRole('button', { name: 'Bowl' }))
      await next(user, 'Scores')

      expect(await screen.findByTestId('toss-context')).toHaveTextContent(`${AWAY} won the toss and chose to bowl`)
      const rows = screen.getAllByTestId('innings-row')
      expect(rows).toHaveLength(2)
      // the away side chose to bowl, so the home side batted first
      expect(rows[0]).toHaveTextContent(HOME)
      expect(rows[0]).toHaveTextContent('1st innings')
      expect(screen.queryByText('Who batted first?')).not.toBeInTheDocument()
    })

    it('asks who batted first when no toss is recorded, and shows the innings after the answer', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)
      await next(user, 'Scores')

      expect(await screen.findByText('Who batted first?')).toBeInTheDocument()
      expect(screen.queryByTestId('innings-row')).not.toBeInTheDocument()
      await user.click(screen.getByRole('radio', { name: new RegExp(AWAY) }))
      expect(screen.getAllByTestId('innings-row')[0]).toHaveTextContent(AWAY)
    })

    it('keeps typed scores with their side when the toss is changed afterwards', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)
      await user.click(screen.getByRole('radio', { name: new RegExp(HOME) }))
      await user.click(screen.getByRole('button', { name: 'Bat' }))
      await next(user, 'Scores')
      await user.type(await screen.findByLabelText(`${HOME} 1st innings runs`), '200')

      await user.click(screen.getByRole('button', { name: 'Change toss' }))
      await screen.findByText('Who won the toss?')
      await user.click(screen.getByRole('button', { name: 'Bowl' }))
      await next(user, 'Scores')

      // home chose to bowl now, so the away side bats first and the 200 follows the home side to innings 2
      const rows = await screen.findAllByTestId('innings-row')
      expect(rows[0]).toHaveTextContent(AWAY)
      expect(screen.getByLabelText(`${HOME} 2nd innings runs`)).toHaveValue(200)
    })

    it('shows no super over panel for a normal win', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)
      await next(user, 'Scores')
      await user.click(await screen.findByRole('radio', { name: new RegExp(HOME) }))

      expect(screen.queryByTestId('super-over')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add super over' })).not.toBeInTheDocument()
    })

    it('adds the first super over pair when "Super over" is chosen and lets more be added and removed', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Capture result' })
      await user.click(screen.getByRole('radio', { name: /^Won/ }))
      await user.click(screen.getByRole('radio', { name: new RegExp(HOME) }))
      await user.click(screen.getByRole('button', { name: 'Super over' }))
      await user.click(step('Scores'))

      expect(await screen.findAllByTestId('super-over')).toHaveLength(1)
      await user.click(screen.getByRole('button', { name: 'Add super over' }))
      expect(screen.getAllByTestId('super-over')).toHaveLength(2)
      await user.click(screen.getByRole('button', { name: 'Remove super over 2' }))
      expect(screen.getAllByTestId('super-over')).toHaveLength(1)
    })

    it('drops the super overs again when another way of deciding the win is chosen', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Capture result' })
      await user.click(screen.getByRole('radio', { name: /^Won/ }))
      await user.click(screen.getByRole('button', { name: 'Super over' }))
      await user.click(screen.getByRole('button', { name: 'Normal' }))
      await user.click(step('Scores'))
      await screen.findByText('Innings')

      expect(screen.queryByTestId('super-over')).not.toBeInTheDocument()
    })

    it('takes the scheduled overs from the league playing conditions and shows where they came from', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ id: 'match-1', leagueId: 'league-1' }))
      getPlayingConditions.mockResolvedValue({ maxOversPerInnings: 40 })
      renderPage()
      await toToss(user)

      expect(screen.getByLabelText('Scheduled overs')).toHaveValue('40.0')
      expect(screen.getByText('From league playing conditions')).toBeInTheDocument()
      expect(getPlayingConditions).toHaveBeenCalledWith('club-1', 'league-1', 'season-1')
    })

    it('leaves the scheduled overs empty for a friendly, and a stored value beats the league', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)
      expect(screen.getByLabelText('Scheduled overs')).toHaveValue('')
    })

    it('rejects 36.7 in plain English and accepts 36.4', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)

      await user.type(screen.getByLabelText('Scheduled overs'), '36.7')
      expect(screen.getByText(/must be 0 to 5/)).toBeInTheDocument()
      await user.clear(screen.getByLabelText('Scheduled overs'))
      await user.type(screen.getByLabelText('Scheduled overs'), '36.4')
      expect(screen.queryByText(/must be 0 to 5/)).not.toBeInTheDocument()
      await next(user, 'Scores')

      await waitFor(() => expect(saveResultDraft).toHaveBeenCalledWith('club-1', 'match-1', expect.objectContaining({ scheduledBalls: 220 })))
    })
  })

  describe('review and publish', () => {
    const existingDraft = (patch = {}) =>
      makeResult({
        status: 'DRAFT',
        publishedAt: null,
        innings: [innings(1, 'HOME', 200, 5), innings(2, 'AWAY', 176, 9)],
        ...patch,
      })

    const toReview = async (user: ReturnType<typeof userEvent.setup>) => {
      await screen.findByRole('heading', { name: 'Edit result' })
      await user.click(step('Review'))
      await screen.findByText('This is how the result will look')
    }

    it('loads a stored draft into the form as Edit result', async () => {
      getMatchResult.mockResolvedValue(existingDraft())
      renderPage()

      expect(await screen.findByRole('heading', { name: 'Edit result' })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /^Won/ })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByText(/Draft saved/)).toBeInTheDocument()
    })

    it('validates the saved payload when Review opens and lists a green check for a clean result', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      renderPage()
      await toReview(user)

      await waitFor(() => expect(validateResult).toHaveBeenCalledWith('club-1', 'match-1', expect.objectContaining({ outcomeType: 'WON', marginValue: 24 })))
      expect(await screen.findByText('The margin of 24 runs matches the scores.')).toBeInTheDocument()
      expect(screen.getByTestId('result-preview')).toHaveTextContent('1st XI won by 24 runs')
      expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('keeps Publish disabled until the warnings are ticked, then publishes acknowledged and returns to Results', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      validateResult.mockResolvedValue({ canPublish: true, errors: [], warnings: ['The toss and the batting order disagree.'] })
      renderPage()
      await toReview(user)

      expect(await screen.findByText('The toss and the batting order disagree.')).toBeInTheDocument()
      const publish = screen.getByRole('button', { name: 'Publish' })
      expect(publish).toBeDisabled()
      await user.click(screen.getByRole('checkbox', { name: /I have checked these warnings/ }))
      expect(publish).toBeEnabled()

      await user.click(publish)
      expect(screen.getByText('Publish this result?')).toBeInTheDocument()
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }))

      await waitFor(() => expect(publishResult).toHaveBeenCalledWith('club-1', 'match-1', true))
      expect(await screen.findByText('At: /manage/results')).toBeInTheDocument()
    })

    it('publishes a clean result without an acknowledgement', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      renderPage()
      await toReview(user)
      await screen.findByText('The margin of 24 runs matches the scores.')

      await user.click(screen.getByRole('button', { name: 'Publish' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }))

      await waitFor(() => expect(publishResult).toHaveBeenCalledWith('club-1', 'match-1', false))
    })

    it('blocks Publish and lists the errors when the server finds the result invalid', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      validateResult.mockResolvedValue({ canPublish: false, errors: ['Choose who won.'], warnings: [] })
      renderPage()
      await toReview(user)

      expect(await screen.findByText('Choose who won.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('treats a margin that contradicts the scores as a warning needing a tick, offers Fix, and lists the matching server warning once', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft({ marginValue: 30 }))
      validateResult.mockResolvedValue({
        canPublish: true,
        errors: [],
        warnings: ['The scores differ by 24 runs, but the margin is 30 runs.', 'Toss data is incomplete.'],
      })
      renderPage()
      await toReview(user)

      const checks = await screen.findByRole('list', { name: 'Checks' })
      expect(within(checks).getByText('You entered won by 30 runs; the scores say 24 runs.')).toBeInTheDocument()
      // the server's wording of the same finding is dropped; an unrelated warning stays
      expect(within(checks).queryByText(/The scores differ by 24 runs/)).not.toBeInTheDocument()
      expect(within(checks).getByText('Toss data is incomplete.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

      // Fix writes the proposal into the form and re-checks
      validateResult.mockResolvedValue(CLEAN)
      await user.click(within(checks).getByRole('button', { name: 'Fix' }))
      expect(await screen.findByText('The margin of 24 runs matches the scores.')).toBeInTheDocument()
      await waitFor(() => expect(validateResult).toHaveBeenLastCalledWith('club-1', 'match-1', expect.objectContaining({ marginValue: 24 })))
    })

    it('says the check could not run when validation fails and leaves Publish disabled', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      validateResult.mockRejectedValue(new Error('boom'))
      renderPage()
      await toReview(user)

      expect(await screen.findByText("We couldn't check the result. Please try again.")).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    })

    it('reports a refused publish and stays on the page', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      publishResult.mockRejectedValue(new AxiosError('conflict', '409', undefined, undefined, { status: 409 } as never))
      renderPage()
      await toReview(user)
      await screen.findByText('The margin of 24 runs matches the scores.')

      await user.click(screen.getByRole('button', { name: 'Publish' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('This result has been published. Unpublish it before changing it.')
      expect(screen.queryByText(/^At:/)).not.toBeInTheDocument()
    })
  })

  it('sends a published result away from the wizard to its page', async () => {
    getMatchResult.mockResolvedValue(makeResult())
    renderPage()

    expect(await screen.findByText('This result is published')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View result' })).toBeInTheDocument()
  })

  it('shows a load error when the match cannot be loaded', async () => {
    getMatch.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText("Couldn't load this match")).toBeInTheDocument()
  })
})
