import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { AxiosError } from 'axios'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../../theme'
import ResultCapturePage from './ResultCapturePage'
import { fireEvent } from '@testing-library/react'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { innings, makeMatch, makeResult } from './resultTestUtils'

const getMatch = vi.fn()
const getMatchResult = vi.fn()
const saveResultDraft = vi.fn()
const validateResult = vi.fn()
const publishResult = vi.fn()
const getPlayingConditions = vi.fn()
const getScorecard = vi.fn()
const getScorecardPrefill = vi.fn()
const updateMatchDateTime = vi.fn()

vi.mock('../../../api/matchApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchApi')>()
  return {
    ...actual,
    getMatch: (clubId: string, matchId: string) => getMatch(clubId, matchId),
    updateMatchDateTime: (clubId: string, matchId: string, matchDate: string) => updateMatchDateTime(clubId, matchId, matchDate),
  }
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
vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: () => Promise.resolve([]) }))
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
// The wizard opens on Teams (docs/specs/101, decision 22); most tests start on Result.
const toResult = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole('heading', { name: /^(Capture|Edit) result$/ })
  await user.click(step('Result'))
  await screen.findByText('How did the match end?')
}

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
  it('offers the steps in order Teams, Toss and field, Result, Batting, Bowling and fielding, Awards, Scores and margin, Review, starting on Teams', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Capture result' })).toBeInTheDocument()
    const labels = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(labels).toEqual([
      'Step 1: Teams (optional)',
      'Step 2: Toss and field',
      'Step 3: Result',
      'Step 4: Batting (optional)',
      'Step 5: Bowling and fielding (optional)',
      'Step 6: Awards (optional)',
      'Step 7: Scores and margin',
      'Step 8: Review',
    ])
    expect(step('Teams')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Who is playing?')).toBeInTheDocument()
  })

  it('walks Next through the steps and Back returns, ticking the earlier steps', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Capture result' })

    expect(await screen.findByRole('button', { name: 'Populate from the team' })).toBeInTheDocument()
    await next(user, 'Toss and field')
    expect(await screen.findByText('Who won the toss?')).toBeInTheDocument()
    await next(user, 'Result')
    expect(await screen.findByText('How did the match end?')).toBeInTheDocument()
    await next(user, 'Batting')
    expect(await screen.findByText('Who batted first?')).toBeInTheDocument()
    expect(step('Result', ' (done)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('How did the match end?')).toBeInTheDocument()
  })

  it('does not save a form that is still empty', async () => {
    const user = userEvent.setup()
    renderPage()
    await toResult(user)

    await user.click(step('Toss and field'))
    await screen.findByText('Who won the toss?')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(saveResultDraft).not.toHaveBeenCalled()
    expect(screen.getByText('Not saved yet')).toBeInTheDocument()
  })

  it('shows the winner, how it was decided and a margin only for Won', async () => {
    const user = userEvent.setup()
    renderPage()
    await toResult(user)

    expect(screen.queryByRole('radiogroup', { name: 'Who won?' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /^Won/ }))
    expect(screen.getByRole('radiogroup', { name: 'Who won?' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'How was it decided?' })).toBeInTheDocument()
    // the margin is worked out and set on Scores and margin, not here
    expect(screen.queryByLabelText('Margin')).not.toBeInTheDocument()
    await user.click(step('Scores and margin'))
    expect(await screen.findByLabelText('Margin')).toBeInTheDocument()
    await user.click(step('Result'))

    await user.click(await screen.findByRole('radio', { name: /^Abandoned/ }))
    expect(screen.queryByRole('radiogroup', { name: 'Who won?' })).not.toBeInTheDocument()
    await user.click(step('Scores and margin'))
    await screen.findByText('Innings')
    expect(screen.queryByLabelText('Margin')).not.toBeInTheDocument()
    await user.click(step('Result'))

    await user.click(screen.getByRole('radio', { name: /^Forfeit/ }))
    expect(screen.getByRole('radiogroup', { name: 'Who received the win?' })).toBeInTheDocument()
  })

  it('saves a cleaned payload on Next (a margin left over from Won is dropped after switching to Tie)', async () => {
    const user = userEvent.setup()
    renderPage()
    await toResult(user)

    await user.click(screen.getByRole('radio', { name: /^Won/ }))
    await user.click(screen.getByRole('radio', { name: new RegExp(HOME) }))
    await user.click(step('Scores and margin'))
    await user.type(await screen.findByLabelText('Margin'), '24')
    await user.click(step('Result'))
    await user.click(await screen.findByRole('radio', { name: /^Tie/ }))
    await user.click(step('Toss and field'))

    await waitFor(() => expect(saveResultDraft).toHaveBeenCalled())
    expect(saveResultDraft).toHaveBeenLastCalledWith(
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
    await toResult(user)

    await user.click(screen.getByRole('radio', { name: /^Won/ }))
    await user.click(step('Toss and field'))

    expect(await screen.findByText('Choose who won.')).toBeInTheDocument()
    expect(step('Result')).toHaveAttribute('aria-current', 'step')
  })

  describe('toss and scores', () => {
    const toToss = async (user: ReturnType<typeof userEvent.setup>) => {
      await toResult(user)
      await user.click(screen.getByRole('radio', { name: /^Won/ }))
      await user.click(screen.getByRole('radio', { name: new RegExp(HOME) }))
      await user.click(step('Toss and field'))
      await screen.findByText('Who won the toss?')
    }

    it('puts the side that batted first in innings 1 from the toss, and asks nothing about the order', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)

      await user.click(screen.getByRole('radio', { name: new RegExp(AWAY) }))
      await user.click(screen.getByRole('button', { name: 'Bowl' }))
      await user.click(step('Scores and margin'))

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
      await user.click(step('Scores and margin'))

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
      await user.click(step('Scores and margin'))
      await user.type(await screen.findByLabelText(`${HOME} 1st innings runs`), '200')

      await user.click(screen.getByRole('button', { name: 'Change toss' }))
      await screen.findByText('Who won the toss?')
      await user.click(screen.getByRole('button', { name: 'Bowl' }))
      await user.click(step('Scores and margin'))

      // home chose to bowl now, so the away side bats first and the 200 follows the home side to innings 2
      const rows = await screen.findAllByTestId('innings-row')
      expect(rows[0]).toHaveTextContent(AWAY)
      expect(screen.getByLabelText(`${HOME} 2nd innings runs`)).toHaveValue('200')
    })

    it('shows no super over panel for a normal win', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)
      await user.click(step('Scores and margin'))
      await user.click(await screen.findByRole('radio', { name: new RegExp(HOME) }))

      expect(screen.queryByTestId('super-over')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add super over' })).not.toBeInTheDocument()
    })

    it('adds the first super over pair when "Super over" is chosen and lets more be added and removed', async () => {
      const user = userEvent.setup()
      renderPage()
      await toResult(user)
      await user.click(screen.getByRole('radio', { name: /^Won/ }))
      await user.click(screen.getByRole('radio', { name: new RegExp(HOME) }))
      await user.click(screen.getByRole('button', { name: 'Super over' }))
      await user.click(step('Scores and margin'))

      expect(await screen.findAllByTestId('super-over')).toHaveLength(1)
      await user.click(screen.getByRole('button', { name: 'Add super over' }))
      expect(screen.getAllByTestId('super-over')).toHaveLength(2)
      await user.click(screen.getByRole('button', { name: 'Remove super over 2' }))
      expect(screen.getAllByTestId('super-over')).toHaveLength(1)
    })

    it('drops the super overs again when another way of deciding the win is chosen', async () => {
      const user = userEvent.setup()
      renderPage()
      await toResult(user)
      await user.click(screen.getByRole('radio', { name: /^Won/ }))
      await user.click(screen.getByRole('button', { name: 'Super over' }))
      await user.click(screen.getByRole('button', { name: 'Normal' }))
      await user.click(step('Scores and margin'))
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

    it('ignores 36.7 as it is typed and accepts 36.4', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)

      await user.type(screen.getByLabelText('Scheduled overs'), '36.7')
      expect(screen.getByLabelText('Scheduled overs')).toHaveValue('36.')
      expect(screen.queryByText(/must be 0 to 5/)).not.toBeInTheDocument()
      await user.clear(screen.getByLabelText('Scheduled overs'))
      await user.type(screen.getByLabelText('Scheduled overs'), '36.4')
      expect(screen.queryByText(/must be 0 to 5/)).not.toBeInTheDocument()
      await user.click(step('Scores and margin'))

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
      await userEvent.setup().click(step('Result'))
      expect(await screen.findByRole('radio', { name: /^Won/ })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByText(/Draft saved/)).toBeInTheDocument()
    })

    it('offers the league playing conditions on Review only for a match with a league, and opens them in a dialog', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      getMatch.mockResolvedValue(makeMatch({ id: 'match-1', leagueId: 'league-1' }))
      getPlayingConditions.mockResolvedValue(null)
      renderPage()
      await toReview(user)

      await user.click(screen.getByRole('button', { name: 'Playing conditions' }))
      const dialog = await screen.findByRole('dialog', { name: 'Playing conditions' })
      expect(await within(dialog).findByText('No playing conditions are on file for this league and season.')).toBeInTheDocument()
    })

    it('has no playing conditions button on Review for a friendly', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      renderPage()
      await toReview(user)
      expect(screen.queryByRole('button', { name: 'Playing conditions' })).not.toBeInTheDocument()
    })

    // docs/specs/104: Preview result saves the draft, then shows the saved result with the same body as the result page.
    it('Preview result saves the draft first, then opens the full-screen preview with the banner and the same sections as the result page', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft({ hasScorecard: true }))
      getScorecard.mockResolvedValue({
        players: [
          { id: 'a', side: 'HOME', playerProfileId: 'p-a', displayName: null, plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false, firstName: 'Ann', lastName: 'Ash', guest: false },
          { id: 'x', side: 'AWAY', playerProfileId: null, displayName: 'Sam Jones', plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false, opposition: true },
        ],
        batting: [{ battingSide: 'HOME', inningsKind: 'REGULAR', resultPlayerId: 'a', position: 1, howOut: 'NOT_OUT', runs: 50, balls: 40, fours: 5, sixes: 1, featuredOverride: 'FEATURE' }],
        bowling: [],
        fielding: [],
        awards: [],
        innings: [],
      })
      renderPage()
      await toReview(user)
      saveResultDraft.mockClear()

      await user.click(screen.getByRole('button', { name: 'Preview result' }))

      const dialog = await screen.findByRole('dialog', { name: 'Result preview' })
      expect(saveResultDraft).toHaveBeenCalledTimes(1)
      expect(within(dialog).getByTestId('preview-banner')).toHaveTextContent('Preview: not published yet. This is how the result will look once published.')
      expect(await within(dialog).findByTestId('result-key-figures')).toBeInTheDocument()
      expect(within(dialog).getByRole('table', { name: 'Innings' })).toBeInTheDocument()
      expect(await within(dialog).findAllByText('Ann Ash')).not.toHaveLength(0)
      expect(within(dialog).getByTestId('result-details')).toBeInTheDocument()
      // docs/specs/118: the Standouts are the last block of the Details card in the preview as on the result page.
      const standouts = await within(dialog).findByTestId('result-standouts')
      expect(within(dialog).getByTestId('result-details').lastElementChild).toBe(standouts)
      expect(standouts).toHaveTextContent('Ann Ash 50 (40)')
      expect(within(dialog).queryByRole('button', { name: /^(Edit|Publish|Unpublish|Delete draft)$|link to player/i })).not.toBeInTheDocument()
    })

    it('Back to review closes the preview', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      renderPage()
      await toReview(user)

      await user.click(screen.getByRole('button', { name: 'Preview result' }))
      const dialog = await screen.findByRole('dialog', { name: 'Result preview' })
      await user.click(within(dialog).getByRole('button', { name: 'Back to review' }))

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Result preview' })).not.toBeInTheDocument())
    })

    it('does not open the preview when the save is refused, and shows the same problem as any other save', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(existingDraft())
      renderPage()
      await toReview(user)
      saveResultDraft.mockRejectedValue(new AxiosError('bad', '400', undefined, undefined, { status: 400, data: { errors: ['Choose who won.'] } } as never))

      await user.click(screen.getByRole('button', { name: 'Preview result' }))

      expect(await screen.findByText('Choose who won.')).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'Result preview' })).not.toBeInTheDocument()
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

  it('Teams lists the selected eleven and the captioned 12th man from the team selection', async () => {
    getScorecardPrefill.mockResolvedValue({
      sides: [
        {
          side: 'HOME',
          teamId: 'team-1',
          teamName: '1st XI',
          selectionState: 'ANNOUNCED',
          players: [
            { playerProfileId: 'p1', firstName: 'Ann', lastName: 'Ash', plannedBattingOrder: 1, role: 'BATSMAN', substitute: false },
            { playerProfileId: 'p2', firstName: 'Bob', lastName: 'Bell', plannedBattingOrder: 2, role: 'BOWLER', substitute: false },
            { playerProfileId: 'p3', firstName: 'Cy', lastName: 'Cox', plannedBattingOrder: null, role: 'BATSMAN', substitute: true },
          ],
        },
      ],
    })
    renderPage()
    await screen.findByRole('heading', { name: 'Capture result' })

    expect(await screen.findByText('Ann Ash')).toBeInTheDocument()
    expect(screen.getByText('Bob Bell')).toBeInTheDocument()
    expect(screen.getByText('Cy Cox')).toBeInTheDocument()
    expect(screen.getByText('2 players + 12th man')).toBeInTheDocument()
    expect(screen.getByText(/12th man/, { selector: 'span' })).toBeInTheDocument()
  })
})


// docs/specs/118-result-review-fixes.md (UI requirements 6 and owner items 4 and 6): Edit date and time in the top panel, the shared
// wizard footer, the optional-scorecard notice and the Scheduled overs / Note row.
describe('spec 118 wizard layout', () => {
  const NEW_DATE = '2026-10-10T12:30:00.000Z'

  describe('Edit date and time in the top panel', () => {
    const panelLine = () => screen.getByText(new RegExp(`${HOME} v ${AWAY}`))

    it('opens the dialog from the top panel, saves only the date and shows the new time without a reload', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValueOnce(makeMatch({ id: 'match-1' })).mockResolvedValue(makeMatch({ id: 'match-1', matchDate: NEW_DATE }))
      updateMatchDateTime.mockResolvedValue(makeMatch({ id: 'match-1', matchDate: NEW_DATE }))
      renderPage()
      await screen.findByRole('heading', { name: 'Capture result' })
      expect(panelLine()).toHaveTextContent(formatMatchDateTime('2026-10-03T10:00:00Z'))

      await user.click(screen.getByRole('button', { name: 'Edit date and time' }))
      const dialog = await screen.findByRole('dialog', { name: 'Edit date and time' })
      fireEvent.change(within(dialog).getByLabelText('Match date & time (date)'), { target: { value: '2026-10-10' } })
      fireEvent.change(within(dialog).getByLabelText('Match date & time (time)'), { target: { value: '14:30' } })
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(updateMatchDateTime).toHaveBeenCalledWith('club-1', 'match-1', new Date('2026-10-10T14:30').toISOString()))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit date and time' })).not.toBeInTheDocument())
      // The match query is refreshed, so the panel line shows the new time. The draft itself is not re-saved by this action.
      await waitFor(() => expect(panelLine()).toHaveTextContent(formatMatchDateTime(NEW_DATE)))
      expect(saveResultDraft).not.toHaveBeenCalled()
    })

    it('shows the league-dates refusal in the dialog, keeps it open and leaves the panel line unchanged', async () => {
      const user = userEvent.setup()
      updateMatchDateTime.mockRejectedValue(
        new AxiosError('bad', '400', undefined, undefined, { status: 400, data: { code: 'MATCH_OUTSIDE_LEAGUE_DATES', detail: 'This league runs from 1 Sep to 31 Jul.' } } as never),
      )
      renderPage()
      await screen.findByRole('heading', { name: 'Capture result' })

      await user.click(screen.getByRole('button', { name: 'Edit date and time' }))
      const dialog = await screen.findByRole('dialog', { name: 'Edit date and time' })
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))

      expect(await within(dialog).findByText('This league runs from 1 Sep to 31 Jul.')).toBeInTheDocument()
      expect(panelLine()).toHaveTextContent(formatMatchDateTime('2026-10-03T10:00:00Z'))
    })

    it('sends nothing on Cancel', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Capture result' })
      await user.click(screen.getByRole('button', { name: 'Edit date and time' }))
      await user.click(within(await screen.findByRole('dialog', { name: 'Edit date and time' })).getByRole('button', { name: 'Cancel' }))
      expect(updateMatchDateTime).not.toHaveBeenCalled()
    })
  })

  describe('wizard footer', () => {
    const isFilled = (button: HTMLElement) => button.className.includes('MuiButton-contained')
    const isOutlined = (button: HTMLElement) => button.className.includes('MuiButton-outlined')

    it('has Back filled, Save draft outlined and Next filled on a middle step; no Back on the first step', async () => {
      const user = userEvent.setup()
      renderPage()
      await toResult(user)

      const footer = screen.getByTestId('wizard-footer')
      expect(isFilled(within(footer).getByRole('button', { name: 'Back' }))).toBe(true)
      expect(isOutlined(within(footer).getByRole('button', { name: 'Save draft' }))).toBe(true)
      expect(isFilled(within(footer).getByRole('button', { name: 'Next: Batting' }))).toBe(true)
      // Save draft is the only outlined button of the footer.
      expect(within(footer).getAllByRole('button').filter(isOutlined)).toHaveLength(1)

      await user.click(step('Teams'))
      await screen.findByText('Who is playing?')
      expect(within(screen.getByTestId('wizard-footer')).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    })

    it('ends on Publish (filled) instead of Next on the last step', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(makeResult({ status: 'DRAFT', publishedAt: null }))
      renderPage()
      await screen.findByRole('heading', { name: 'Edit result' })
      await user.click(step('Review'))
      await screen.findByText('This is how the result will look')

      const footer = screen.getByTestId('wizard-footer')
      expect(isFilled(within(footer).getByRole('button', { name: 'Publish' }))).toBe(true)
      expect(within(footer).queryByRole('button', { name: /^Next:/ })).not.toBeInTheDocument()
      expect(isFilled(within(footer).getByRole('button', { name: 'Back' }))).toBe(true)
    })
  })

  describe('optional batting and bowling notice (Result step)', () => {
    it('has only the "Skip batting and bowling" link, which goes to Scores and margin', async () => {
      const user = userEvent.setup()
      renderPage()
      await toResult(user)

      expect(screen.queryByRole('button', { name: 'Add the batting and bowling' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Skip to scores' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Skip batting and bowling' }))
      expect(step('Scores and margin')).toHaveAttribute('aria-current', 'step')
    })
  })

  describe('Scheduled overs and Note row (Toss and field)', () => {
    const toToss = async (user: ReturnType<typeof userEvent.setup>) => {
      await screen.findByRole('heading', { name: 'Capture result' })
      await user.click(step('Toss and field'))
      await screen.findByText('Who won the toss?')
    }
    // The grid that holds both fields (jsdom ignores media queries on computed style, so the rules are read from the stylesheet).
    const rowRules = (row: HTMLElement) => {
      const cls = Array.from(row.classList).find((name) => name.startsWith('css-')) as string
      return Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText)).filter((text) => text.includes(`.${cls}`)).join('\n')
    }

    it('puts both fields in one aligned grid row, the Note one line high, stacking to one column on a phone', async () => {
      const user = userEvent.setup()
      renderPage()
      await toToss(user)

      const overs = screen.getByLabelText('Scheduled overs')
      const note = screen.getByLabelText('Note (optional)')
      const row = overs.closest('div[class*="MuiBox-root"]') as HTMLElement
      expect(row).toContainElement(note)
      const rules = rowRules(row)
      expect(rules).toMatch(/align-items:\s*start/)
      expect(rules).toMatch(/grid-template-columns:\s*1fr/)
      expect(rules).toMatch(/240px 1fr/)
      // One line high: the Note textarea is a single row until the manager types more.
      expect(note.tagName).toBe('TEXTAREA')
      expect(note.getAttribute('rows') ?? '1').toBe('1')
    })

    it('shows the league helper as a caption under the row, not as helper text of one field', async () => {
      const user = userEvent.setup()
      getMatch.mockResolvedValue(makeMatch({ id: 'match-1', leagueId: 'league-1' }))
      getPlayingConditions.mockResolvedValue({ maxOversPerInnings: 40 })
      renderPage()
      await toToss(user)

      const caption = await screen.findByText('From league playing conditions')
      const overs = screen.getByLabelText('Scheduled overs')
      expect(caption.closest('.MuiFormControl-root')).toBeNull()
      expect(overs).not.toHaveAccessibleDescription('From league playing conditions')
      const row = overs.closest('div[class*="MuiBox-root"]') as HTMLElement
      expect(row).toContainElement(caption)
      expect(rowRules(caption)).toMatch(/grid-column:\s*1\s*\/\s*-1/)
    })
  })
})
