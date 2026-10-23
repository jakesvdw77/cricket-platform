import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResultDetailPage from './ResultDetailPage'
import { innings, makeMatch, makeResult } from './resultTestUtils'

const getMatch = vi.fn()
const getMatchResult = vi.fn()
const unpublishResult = vi.fn()
const deleteResultDraft = vi.fn()
const validateResult = vi.fn()
const publishResult = vi.fn()

vi.mock('../../../api/matchApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchApi')>()
  return { ...actual, getMatch: (clubId: string, matchId: string) => getMatch(clubId, matchId) }
})
vi.mock('../../../api/matchResultApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchResultApi')>()
  return {
    ...actual,
    getMatchResult: (clubId: string, matchId: string) => getMatchResult(clubId, matchId),
    unpublishResult: (clubId: string, matchId: string) => unpublishResult(clubId, matchId),
    deleteResultDraft: (clubId: string, matchId: string) => deleteResultDraft(clubId, matchId),
    validateResult: (clubId: string, matchId: string) => validateResult(clubId, matchId),
    publishResult: (clubId: string, matchId: string, ack: boolean) => publishResult(clubId, matchId, ack),
  }
})
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: '1st XI', logoUrl: null }]) }))
vi.mock('../../../api/shareSettingsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/shareSettingsApi')>()),
  getShareSettings: () => Promise.resolve({ initialsOnlyDefault: false }),
}))
vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))

function Where() {
  const location = useLocation()
  return <div>At: {location.pathname}</div>
}

function renderPage(state?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/manage/results/match-1', state }]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="results/:matchId" element={<ResultDetailPage />} />
            <Route path="*" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const FROM_MATCHES = { backTo: '/manage/players/player-1/stats?tab=matches&seasonId=season-1&leagueId=', backLabel: 'Matches' }

const notFound = () => new AxiosError('nope', '404', undefined, undefined, { status: 404 } as never)

beforeEach(() => {
  vi.clearAllMocks()
  getMatch.mockResolvedValue(makeMatch({ id: 'match-1' }))
  getMatchResult.mockResolvedValue(makeResult())
})

describe('ResultDetailPage', () => {
  describe('published', () => {
    it('shows the result line, a Published chip, the innings and the toss and field details', async () => {
      renderPage()

      expect(await screen.findByRole('heading', { name: '1st XI vs Riverside Occasionals' })).toBeInTheDocument()
      expect(screen.getByTestId('result-line')).toHaveTextContent('1st XI won by 24 runs')
      expect(screen.getByTestId('result-line')).toHaveAttribute('data-perspective', 'won')
      expect(screen.getByTestId('result-status-chip')).toHaveTextContent('Published')
      expect(screen.getAllByTestId('innings-row')).toHaveLength(2)
      expect(screen.getByTestId('result-details')).toHaveTextContent('1st XI won the toss and chose to bat')
    })

    it('tags a two-innings result Batted first / Chased and shows Tied for a tie without a margin', async () => {
      getMatchResult.mockResolvedValue(makeResult({ outcomeType: 'TIE', winningSide: null, marginType: null, marginValue: null, note: null }))
      renderPage()

      const tags = await screen.findAllByTestId('innings-order-tag')
      expect(tags.map((tag) => tag.textContent)).toEqual(['Batted first', 'Chased'])
      expect(screen.getByTestId('result-figure-margin-value')).toHaveTextContent('Tied')
      expect(within(screen.getByTestId('result-details')).getAllByTestId('result-not-recorded').length).toBeGreaterThan(0)
    })

    it('has Unpublish, and a disabled Edit carrying the "Unpublish to edit" reason; no Publish or Delete', async () => {
      renderPage()
      const actions = await screen.findByTestId('result-actions')

      const edit = within(actions).getByRole('button', { name: 'Edit' })
      expect(edit).toBeDisabled()
      expect(edit).toHaveAccessibleDescription('Unpublish to edit')
      expect(within(actions).getByRole('button', { name: 'Unpublish' })).toBeEnabled()
      expect(within(actions).queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
      expect(within(actions).queryByRole('button', { name: 'Delete draft' })).not.toBeInTheDocument()
    })

    it('has an enabled Share button that opens the Share dialog', async () => {
      const user = userEvent.setup()
      renderPage()

      const share = within(await screen.findByTestId('result-actions')).getByRole('button', { name: 'Share' })
      expect(share).toBeEnabled()
      await user.click(share)

      expect(await screen.findByRole('dialog', { name: 'Share result' })).toBeInTheDocument()
    })

    it('unpublishes only after the confirmation', async () => {
      const user = userEvent.setup()
      unpublishResult.mockResolvedValue(makeResult({ status: 'DRAFT' }))
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Unpublish' }))
      expect(unpublishResult).not.toHaveBeenCalled()
      expect(screen.getByText('Unpublish this result?')).toBeInTheDocument()
      await user.click(screen.getAllByRole('button', { name: 'Unpublish' }).at(-1) as HTMLElement)

      await waitFor(() => expect(unpublishResult).toHaveBeenCalledWith('club-1', 'match-1'))
    })

    it('lists super overs after the regular innings, labelled by number', async () => {
      getMatchResult.mockResolvedValue(
        makeResult({
          outcomeType: 'WON',
          decidedBy: 'SUPER_OVER',
          marginType: null,
          marginValue: null,
          innings: [innings(1, 'HOME', 150), innings(2, 'AWAY', 150, 9), innings(3, 'AWAY', 12, 1, 6), innings(4, 'HOME', 8, 2, 6)],
        }),
      )
      renderPage()

      const rows = await screen.findAllByTestId('innings-row')
      expect(rows).toHaveLength(4)
      expect(rows[2]).toHaveTextContent('Super over 1')
      expect(screen.getByTestId('result-line')).toHaveTextContent('Tied · 1st XI won in the super over')
    })
  })

  describe('draft', () => {
    beforeEach(() => {
      getMatchResult.mockResolvedValue(makeResult({ status: 'DRAFT', publishedAt: null }))
    })

    it('shows a Draft chip with Edit (a link to the wizard), Publish and Delete draft; no Unpublish', async () => {
      renderPage()
      const actions = await screen.findByTestId('result-actions')

      expect(screen.getByTestId('result-status-chip')).toHaveTextContent('Draft')
      expect(within(actions).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/results/match-1/capture')
      expect(within(actions).getByRole('button', { name: 'Publish' })).toBeEnabled()
      expect(within(actions).getByRole('button', { name: 'Delete draft' })).toBeEnabled()
      expect(within(actions).queryByRole('button', { name: 'Unpublish' })).not.toBeInTheDocument()
    })

    it('has no Share button on a draft (it appears once published)', async () => {
      renderPage()
      const actions = await screen.findByTestId('result-actions')

      expect(within(actions).queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    })

    it('publishes after validation', async () => {
      const user = userEvent.setup()
      validateResult.mockResolvedValue({ canPublish: true, errors: [], warnings: [] })
      publishResult.mockResolvedValue(makeResult())
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Publish' }))

      await waitFor(() => expect(publishResult).toHaveBeenCalledWith('club-1', 'match-1', false))
    })

    it('deletes the draft after confirming and returns to the Results page', async () => {
      const user = userEvent.setup()
      deleteResultDraft.mockResolvedValue(undefined)
      renderPage()

      await user.click(await screen.findByRole('button', { name: 'Delete draft' }))
      expect(deleteResultDraft).not.toHaveBeenCalled()
      await user.click(screen.getAllByRole('button', { name: 'Delete draft' }).at(-1) as HTMLElement)

      await waitFor(() => expect(deleteResultDraft).toHaveBeenCalledWith('club-1', 'match-1'))
      expect(await screen.findByText('At: /manage/results')).toBeInTheDocument()
    })
  })

  describe('no result yet', () => {
    beforeEach(() => {
      getMatchResult.mockRejectedValue(notFound())
    })

    it('redirects an active match to the capture wizard', async () => {
      renderPage()

      expect(await screen.findByText('At: /manage/results/match-1/capture')).toBeInTheDocument()
    })

    it('explains instead of redirecting when the match is inactive', async () => {
      getMatch.mockResolvedValue(makeMatch({ id: 'match-1', active: false }))
      renderPage()

      expect(await screen.findByText('No result for this match')).toBeInTheDocument()
      expect(screen.queryByText(/^At:/)).not.toBeInTheDocument()
    })
  })

  it('shows a Match not found state for an unknown match', async () => {
    getMatch.mockRejectedValue(notFound())
    renderPage()

    expect(await screen.findByText('Match not found')).toBeInTheDocument()
  })

  it('shows a load error for any other failure', async () => {
    getMatchResult.mockRejectedValue(new Error('boom'))
    renderPage()

    expect(await screen.findByText("Couldn't load this result")).toBeInTheDocument()
  })

  // docs/specs/115-player-match-list.md: the back link follows router state { backTo, backLabel } from the player's Matches tab.
  describe('back link', () => {
    it('says "Back to Results" and goes to the Results page when it was not opened from a list', async () => {
      renderPage()
      const back = await screen.findByRole('link', { name: 'Back to Results' })
      expect(back).toHaveAttribute('href', '/manage/results')
    })

    it('shows "Back to Matches" for valid router state, links to the stored address and goes there', async () => {
      const user = userEvent.setup()
      renderPage(FROM_MATCHES)
      const back = await screen.findByRole('link', { name: 'Back to Matches' })
      expect(back).toHaveAttribute('href', FROM_MATCHES.backTo)
      expect(screen.queryByRole('link', { name: 'Back to Results' })).not.toBeInTheDocument()

      await user.click(back)
      expect(await screen.findByText('At: /manage/players/player-1/stats')).toBeInTheDocument()
    })

    it('ignores a backTo that does not start with /manage/', async () => {
      for (const backTo of ['https://evil.example/manage/x', '//evil.example', '/elsewhere', 'manage/x']) {
        const { unmount } = renderPage({ backTo, backLabel: 'Matches' })
        expect(await screen.findByRole('link', { name: 'Back to Results' })).toHaveAttribute('href', '/manage/results')
        expect(screen.queryByRole('link', { name: 'Back to Matches' })).not.toBeInTheDocument()
        unmount()
      }
    })

    it('ignores state that is not an address string', async () => {
      renderPage({ backTo: 42, backLabel: 'Matches' })
      expect(await screen.findByRole('link', { name: 'Back to Results' })).toBeInTheDocument()
    })

    it('reads "Back to previous page" when the state has an address but no usable label', async () => {
      renderPage({ backTo: '/manage/players/player-1/stats?tab=matches', backLabel: '  ' })
      expect(await screen.findByRole('link', { name: 'Back to previous page' })).toHaveAttribute('href', '/manage/players/player-1/stats?tab=matches')
    })

    it('uses the same back target in the not-found error state', async () => {
      getMatch.mockRejectedValue(notFound())
      renderPage(FROM_MATCHES)
      expect(await screen.findByText('Match not found')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to Matches' })).toHaveAttribute('href', FROM_MATCHES.backTo)
    })

    it('uses the same back target in the load-error state', async () => {
      getMatchResult.mockRejectedValue(new Error('boom'))
      renderPage(FROM_MATCHES)
      expect(await screen.findByText("Couldn't load this result")).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to Matches' })).toHaveAttribute('href', FROM_MATCHES.backTo)
    })

    it('uses the same back target when an inactive match has no result', async () => {
      getMatchResult.mockRejectedValue(notFound())
      getMatch.mockResolvedValue(makeMatch({ id: 'match-1', active: false }))
      renderPage(FROM_MATCHES)
      expect(await screen.findByText('No result for this match')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Back to Matches' })).toHaveAttribute('href', FROM_MATCHES.backTo)
    })

    it('keeps "Back to Results" in the error states when not opened from a list', async () => {
      getMatch.mockRejectedValue(notFound())
      renderPage()
      expect(await screen.findByRole('link', { name: 'Back to Results' })).toHaveAttribute('href', '/manage/results')
    })
  })
})
