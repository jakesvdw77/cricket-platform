import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const showResultToPlayers = vi.fn()
const hideResultFromPlayers = vi.fn()

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
    showResultToPlayers: (clubId: string, matchId: string) => showResultToPlayers(clubId, matchId),
    hideResultFromPlayers: (clubId: string, matchId: string) => hideResultFromPlayers(clubId, matchId),
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
      expect(screen.getByTestId('result-figure-result-value')).toHaveTextContent('1st XI won by 24 runs')
      expect(screen.getByTestId('result-status-chip')).toHaveTextContent('Published')
      expect(screen.getAllByTestId('innings-row')).toHaveLength(2)
      expect(screen.getByTestId('result-details')).toHaveTextContent('1st XI won the toss and chose to bat')
    })

    it('lists the innings in batting order with no Batted first / Chased badge, and says Tied for a tie', async () => {
      getMatchResult.mockResolvedValue(makeResult({ outcomeType: 'TIE', winningSide: null, marginType: null, marginValue: null, note: null }))
      renderPage()

      const rows = await screen.findAllByTestId('innings-row')
      expect(rows).toHaveLength(2)
      expect(screen.queryByTestId('innings-order-tag')).not.toBeInTheDocument()
      expect(screen.getByTestId('result-figure-result-value')).toHaveTextContent(/tied/i)
      expect(within(screen.getByTestId('result-details')).getAllByTestId('result-not-recorded').length).toBeGreaterThan(0)
    })

    it('has Unpublish Result, and a disabled Edit Result carrying the "Unpublish to edit" reason; no Publish or Delete', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByTestId('manage-result'))
      const menu = await screen.findByRole('menu')

      expect(within(menu).getByRole('menuitem', { name: /Edit Result/ })).toHaveAttribute('aria-disabled', 'true')
      expect(within(menu).getByText('Unpublish to edit')).toBeInTheDocument()
      expect(within(menu).getByRole('menuitem', { name: /Unpublish Result/ })).toBeEnabled()
      expect(within(menu).queryByRole('menuitem', { name: /Publish Result/ })).not.toBeInTheDocument()
      expect(within(menu).queryByRole('menuitem', { name: /Delete Draft/ })).not.toBeInTheDocument()
    })

    it('has Share Result last in the menu, and it opens the Share dialog', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByTestId('manage-result'))
      const items = within(await screen.findByRole('menu')).getAllByRole('menuitem')
      const share = items[items.length - 1]
      expect(share).toHaveTextContent('Share Result')
      await user.click(share)

      expect(await screen.findByRole('dialog', { name: 'Share result' })).toBeInTheDocument()
    })

    it('unpublishes only after the confirmation', async () => {
      const user = userEvent.setup()
      unpublishResult.mockResolvedValue(makeResult({ status: 'DRAFT' }))
      renderPage()

      await user.click(await screen.findByTestId('manage-result'))
      await user.click(await screen.findByRole('menuitem', { name: /Unpublish Result/ }))
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
      expect(screen.getByTestId('result-figure-result-value')).toHaveTextContent('Tied · 1st XI won in the super over')
    })
  })

  // docs/specs/145 decision 8 and acceptance 3a: a manager shows or hides a published result in the Player Hub (off by default for old results).
  describe('Player Hub visibility', () => {
    const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(await screen.findByTestId('manage-result'))
      return within(await screen.findByRole('menu'))
    }

    it('offers Show In Player Hub on a published result that is not shown, and no chip', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(makeResult({ visibleToPlayers: false }))
      renderPage()
      const menu = await openMenu(user)

      expect(menu.getByRole('menuitem', { name: /Show In Player Hub/ })).toBeEnabled()
      expect(menu.queryByRole('menuitem', { name: /Hide From Player Hub/ })).not.toBeInTheDocument()
      expect(screen.queryByTestId('result-hub-chip')).not.toBeInTheDocument()
    })

    it('shows the result in the Player Hub, then the chip appears and the action turns into Hide', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValueOnce(makeResult({ visibleToPlayers: false })).mockResolvedValue(makeResult({ visibleToPlayers: true }))
      showResultToPlayers.mockResolvedValue(makeResult({ visibleToPlayers: true }))
      renderPage()
      await user.click((await openMenu(user)).getByRole('menuitem', { name: /Show In Player Hub/ }))

      await waitFor(() => expect(showResultToPlayers).toHaveBeenCalledWith('club-1', 'match-1'))
      expect(hideResultFromPlayers).not.toHaveBeenCalled()
      expect(await screen.findByTestId('result-hub-chip')).toHaveTextContent('In Player Hub')
      await user.click(await screen.findByTestId('manage-result'))
      expect(await screen.findByRole('menuitem', { name: /Hide From Player Hub/ })).toBeInTheDocument()
    })

    it('hides a shown result from the Player Hub and the chip goes', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValueOnce(makeResult({ visibleToPlayers: true })).mockResolvedValue(makeResult({ visibleToPlayers: false }))
      hideResultFromPlayers.mockResolvedValue(makeResult({ visibleToPlayers: false }))
      renderPage()
      expect(await screen.findByTestId('result-hub-chip')).toBeInTheDocument()
      await user.click((await openMenu(user)).getByRole('menuitem', { name: /Hide From Player Hub/ }))

      await waitFor(() => expect(hideResultFromPlayers).toHaveBeenCalledWith('club-1', 'match-1'))
      expect(showResultToPlayers).not.toHaveBeenCalled()
      await waitFor(() => expect(screen.queryByTestId('result-hub-chip')).not.toBeInTheDocument())
    })

    it('disables the action on a draft with the reason "Publish the result first", and never calls the server', async () => {
      const user = userEvent.setup()
      getMatchResult.mockResolvedValue(makeResult({ status: 'DRAFT', publishedAt: null }))
      renderPage()
      const menu = await openMenu(user)

      const item = menu.getByRole('menuitem', { name: /Show In Player Hub/ })
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(menu.getByText('Publish the result first')).toBeInTheDocument()
      fireEvent.click(item)
      expect(showResultToPlayers).not.toHaveBeenCalled()
      expect(screen.queryByTestId('result-hub-chip')).not.toBeInTheDocument()
    })
  })

  describe('draft', () => {
    beforeEach(() => {
      getMatchResult.mockResolvedValue(makeResult({ status: 'DRAFT', publishedAt: null }))
    })

    it('shows a Draft chip with Edit Result (a link to the wizard), Publish Result and Delete Draft; no Unpublish', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByTestId('manage-result'))
      const menu = await screen.findByRole('menu')

      expect(screen.getByTestId('result-status-chip')).toHaveTextContent('Draft')
      expect(within(menu).getByRole('menuitem', { name: /Edit Result/ })).toHaveAttribute('href', '/manage/results/match-1/capture')
      expect(within(menu).getByRole('menuitem', { name: /Publish Result/ })).toBeEnabled()
      expect(within(menu).getByRole('menuitem', { name: /Delete Draft/ })).toBeEnabled()
      expect(within(menu).queryByRole('menuitem', { name: /Unpublish Result/ })).not.toBeInTheDocument()
    })

    it('has Share Result disabled with its reason on a draft', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByTestId('manage-result'))
      const menu = await screen.findByRole('menu')

      expect(within(menu).getByRole('menuitem', { name: /Share Result/ })).toHaveAttribute('aria-disabled', 'true')
      expect(within(menu).getByText('Publish the result to share it')).toBeInTheDocument()
    })

    it('publishes after validation', async () => {
      const user = userEvent.setup()
      validateResult.mockResolvedValue({ canPublish: true, errors: [], warnings: [] })
      publishResult.mockResolvedValue(makeResult())
      renderPage()

      await user.click(await screen.findByTestId('manage-result'))
      await user.click(await screen.findByRole('menuitem', { name: /Publish Result/ }))

      await waitFor(() => expect(publishResult).toHaveBeenCalledWith('club-1', 'match-1', false))
    })

    it('deletes the draft after confirming and returns to the Results page', async () => {
      const user = userEvent.setup()
      deleteResultDraft.mockResolvedValue(undefined)
      renderPage()

      await user.click(await screen.findByTestId('manage-result'))
      await user.click(await screen.findByRole('menuitem', { name: /Delete Draft/ }))
      expect(deleteResultDraft).not.toHaveBeenCalled()
      await user.click(screen.getAllByRole('button', { name: 'Delete draft' }).at(-1) as HTMLElement)

      await waitFor(() => expect(deleteResultDraft).toHaveBeenCalledWith('club-1', 'match-1'))
      expect(await screen.findByText('At: /manage/results')).toBeInTheDocument()
    })
  })

  // docs/specs/118 owner items 11-16: the header and body of the Result page.
  describe('header layout', () => {
    it('shows both team badges beside the title, like the Select Team page', async () => {
      renderPage()
      const heading = await screen.findByRole('heading', { name: '1st XI vs Riverside Occasionals' })
      const home = screen.getByTestId('result-logo-home')
      const away = screen.getByTestId('result-logo-away')
      expect(heading).not.toContainElement(home)
      expect(home.compareDocumentPosition(away) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('shows the Imported chip beside the title, and none for a manual result', async () => {
      getMatchResult.mockResolvedValue(makeResult({ source: 'IMPORT:STUMPS' }))
      const { unmount } = renderPage()
      expect(await screen.findByTestId('imported-chip')).toHaveTextContent('Imported from STUMPS')
      unmount()

      getMatchResult.mockResolvedValue(makeResult({ source: 'MANUAL' }))
      renderPage()
      await screen.findByTestId('result-figure-result')
      expect(screen.queryByTestId('imported-chip')).not.toBeInTheDocument()
    })

    it('has one Manage Result button and no loose action buttons or View match link', async () => {
      renderPage()
      await screen.findByTestId('manage-result')
      expect(screen.queryByTestId('result-actions')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'View match' })).not.toBeInTheDocument()
    })

  })

  describe('body layout', () => {
    it('puts the Details card before the Scorecard card', async () => {
      renderPage()
      const details = await screen.findByRole('heading', { name: 'Details' })
      const inningsCard = screen.getByRole('heading', { name: 'Scorecard' })
      expect(details.compareDocumentPosition(inningsCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('shows three key figures as compact counters (no icons) with a 6 px gap: the Result first, then the two scores, and no toss card', async () => {
      renderPage()
      const grid = await screen.findByTestId('result-key-figures')
      expect(grid).toHaveStyle({ gap: '6px' })
      expect(Array.from(grid.children).map((node) => node.getAttribute('data-testid'))).toEqual(['result-figure-result', 'result-figure-home', 'result-figure-away'])
      expect(screen.queryByTestId('result-figure-toss')).not.toBeInTheDocument()
    })

    it.each([
      ['a no result', { outcomeType: 'NO_RESULT' }, /no result/i],
      ['an abandoned match', { outcomeType: 'ABANDONED' }, /abandoned/i],
      ['a draw', { outcomeType: 'DRAW' }, /draw/i],
    ] as const)('says what happened in the Result figure for %s, never a dash', async (_name, patch, text) => {
      getMatchResult.mockResolvedValue(makeResult({ winningSide: null, marginType: null, marginValue: null, ...patch }))
      renderPage()
      const value = await screen.findByTestId('result-figure-result-value')
      expect(value).toHaveTextContent(text)
      expect(value).not.toHaveTextContent(/^–$/)
    })

    it('says who won and by how much in the Result figure', async () => {
      renderPage()
      expect(await screen.findByTestId('result-figure-result-value')).toHaveTextContent('1st XI won by 24 runs')
    })

    it('shows no "Innings 1" label on a regular innings, and names only a super over', async () => {
      getMatchResult.mockResolvedValue(
        makeResult({ decidedBy: 'SUPER_OVER', marginType: null, marginValue: null, innings: [innings(1, 'HOME', 150), innings(2, 'AWAY', 150, 9), innings(3, 'AWAY', 12, 1, 6), innings(4, 'HOME', 8, 2, 6)] }),
      )
      renderPage()
      const rows = await screen.findAllByTestId('innings-row')
      expect(within(rows[0]).queryByText(/^Innings \d/)).not.toBeInTheDocument()
      expect(within(rows[1]).queryByText(/^Innings \d/)).not.toBeInTheDocument()
      expect(within(rows[2]).getByText('Super over 1')).toBeInTheDocument()
      expect(screen.queryByTestId('innings-order-tag')).not.toBeInTheDocument()
    })

    it('shows unrecorded details in the Review step\'s warning treatment, and recorded ones as plain values', async () => {
      getMatchResult.mockResolvedValue(makeResult({ tossWonBy: null, tossDecision: null, scheduledBalls: null, note: null }))
      getMatch.mockResolvedValue(makeMatch({ id: 'match-1', venue: null }))
      renderPage()
      const details = await screen.findByTestId('result-details')
      const missing = within(details).getAllByTestId('result-not-recorded')
      // Toss, Field, Scheduled overs and Note.
      expect(missing).toHaveLength(4)
      for (const node of missing) expect(node).toHaveTextContent('Not recorded')
      expect(within(details).getByText('Normal play')).toBeInTheDocument()
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
