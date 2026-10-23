import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { AxiosError } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResultDraft, ResultIssue, ResultValidation } from '../../../../api/matchResultApi'
import { baseTheme } from '../../../../theme'
import { makeMatch } from '../../../../test/resultFixtures'
import { PLAYER_NAME_MODE_KEY, resetPlayerNameModeForTests } from '../../../../hooks/usePlayerNameMode'
import { ReviewStep } from './ReviewStep'
import type { ReviewStepProps } from './ReviewStep'

// docs/specs/118-result-review-fixes.md: the Review step's Add to squad / Add all, the preview card header and the Not recorded rows.

const addToSquad = vi.fn()
vi.mock('../../../../api/teamSquadApi', () => ({ addToSquad: (...args: unknown[]) => addToSquad(...args), listSquad: () => Promise.resolve([]) }))
vi.mock('./ResultPreviewDialog', () => ({ ResultPreviewDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Result preview" /> : null) }))
vi.mock('./PlayingConditionsDialog', () => ({ PlayingConditionsDialog: () => null }))

const status = (code: number, detail?: string) => new AxiosError('nope', String(code), undefined, undefined, { status: code, data: { detail } } as never)

const issue = (over: Partial<ResultIssue>): ResultIssue => ({ code: 'X', step: 'TEAMS', side: 'HOME', severity: 'WARNING', message: 'msg', ...over })
const notInSquad = (id: string, name: string, side: 'HOME' | 'AWAY' = 'HOME') =>
  issue({ code: 'PLAYER_NOT_IN_SQUAD', playerProfileId: id, side, message: `${name} is not in the squad` })
const validation = (issues: ResultIssue[]): ResultValidation => ({ canPublish: true, errors: [], warnings: issues.map((i) => i.message), issues })

const SIDES = [
  { side: 'HOME', name: '1st XI', logo: { kind: 'initials', name: '1st XI' } },
  { side: 'AWAY', name: 'Riverside', logo: { kind: 'initials', name: 'Riverside' } },
] as never
const FULL_DRAFT: ResultDraft = {
  outcomeType: 'WON', decidedBy: 'REGULAR', winningSide: 'HOME', marginType: 'RUNS', marginValue: 24, tossWonBy: 'HOME', tossDecision: 'BAT',
  innings: [], scorecard: { players: [], batting: [], bowling: [], fielding: [], awards: [] },
}

function renderReview(over: Partial<ReviewStepProps> = {}) {
  const props: ReviewStepProps = {
    clubId: 'club-1', match: makeMatch({ seasonId: 'season-1', leagueId: null }), draft: FULL_DRAFT, onChange: vi.fn(), onReplace: vi.fn(), sides: SIDES,
    oursSides: [{ side: 'HOME', teamId: 'team-1', teamName: '1st XI' }], prefill: null, prefillState: 'unavailable', scorecardSide: 'HOME', onScorecardSideChange: vi.fn(),
    scorecardAvailable: true, onGoToStep: vi.fn(), check: { expected: null, suggestion: null, status: 'match', reason: 'The scores agree.' }, needsAck: false, onFix: vi.fn(),
    validation: validation([]), validating: false, validationFailed: false, warningsAcknowledged: false, onAcknowledgeChange: vi.fn(), fieldName: 'Riverside Oval',
    onSaveForPreview: vi.fn().mockResolvedValue(true), onRevalidate: vi.fn(), ...over,
  }
  render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ReviewStep {...props} />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  resetPlayerNameModeForTests()
  addToSquad.mockResolvedValue({})
})

describe('Review step: PLAYER_NOT_IN_SQUAD', () => {
  it('shows Add to squad, adds the issue\'s player to the side\'s team for the season, then revalidates', async () => {
    const user = userEvent.setup()
    const props = renderReview({ validation: validation([notInSquad('p-ann', 'Ann Ash')]) })
    const checks = screen.getByRole('list', { name: 'Checks' })
    expect(within(checks).queryByRole('button', { name: 'Fix' })).not.toBeInTheDocument()
    expect(within(checks).queryByRole('button', { name: /Add all/ })).not.toBeInTheDocument()

    await user.click(within(checks).getByRole('button', { name: 'Add to squad' }))

    await waitFor(() => expect(props.onRevalidate).toHaveBeenCalledOnce())
    expect(addToSquad).toHaveBeenCalledWith('club-1', 'team-1', 'season-1', 'p-ann')
  })

  it('offers Add all N for a side with two or more, and adds every such player', async () => {
    const user = userEvent.setup()
    const props = renderReview({ validation: validation([notInSquad('p-ann', 'Ann Ash'), notInSquad('p-bob', 'Bob Bell')]) })
    await user.click(screen.getByRole('button', { name: 'Add all 2 to the squad' }))

    await waitFor(() => expect(props.onRevalidate).toHaveBeenCalledOnce())
    expect(addToSquad.mock.calls.map((call) => call[3])).toEqual(['p-ann', 'p-bob'])
    expect(addToSquad.mock.calls.every((call) => call[1] === 'team-1' && call[2] === 'season-1')).toBe(true)
  })

  it('names the team on Add all in a derby and counts each side separately', async () => {
    renderReview({
      oursSides: [{ side: 'HOME', teamId: 'team-1', teamName: '1st XI' }, { side: 'AWAY', teamId: 'team-2', teamName: '2nd XI' }],
      validation: validation([notInSquad('p-1', 'A'), notInSquad('p-2', 'B'), notInSquad('p-3', 'C', 'AWAY')]),
    })
    expect(screen.getByRole('button', { name: 'Add all 2 to the 1st XI squad' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add all 1/ })).not.toBeInTheDocument()
  })

  it('treats 409 and 400 as done and revalidates with no problem shown', async () => {
    addToSquad.mockRejectedValueOnce(status(409)).mockRejectedValueOnce(status(400))
    const user = userEvent.setup()
    const props = renderReview({ validation: validation([notInSquad('p-ann', 'Ann Ash'), notInSquad('p-bob', 'Bob Bell')]) })
    await user.click(screen.getByRole('button', { name: 'Add all 2 to the squad' }))

    await waitFor(() => expect(props.onRevalidate).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(addToSquad).toHaveBeenCalledTimes(2)
  })

  it('shows a 403 refusal inline on that issue, keeps the warning and still revalidates', async () => {
    addToSquad.mockRejectedValue(status(403, 'You manage a different section.'))
    const user = userEvent.setup()
    const props = renderReview({ validation: validation([notInSquad('p-ann', 'Ann Ash')]) })
    await user.click(screen.getByRole('button', { name: 'Add to squad' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You manage a different section.')
    expect(screen.getByText('Ann Ash is not in the squad')).toBeInTheDocument()
    expect(props.onRevalidate).toHaveBeenCalledOnce()
  })

  it('falls back to the Fix jump to Teams when the issue has no player id or the match has no season', () => {
    renderReview({ validation: validation([issue({ code: 'PLAYER_NOT_IN_SQUAD', message: 'old server' })]) })
    expect(screen.queryByRole('button', { name: 'Add to squad' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fix' })).toBeInTheDocument()
  })
})

describe('Review step: preview card', () => {
  it('has Preview result and the Full name / First name toggle in the card header, before the card, with no separate row', async () => {
    const user = userEvent.setup()
    const props = renderReview()
    const heading = screen.getByText('This is how the result will look')
    const header = heading.closest('div[class]')?.parentElement as HTMLElement
    const preview = screen.getByRole('button', { name: 'Preview result' })
    expect(header).toContainElement(preview)
    expect(within(header).getByRole('button', { name: 'Full name' })).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: 'First name' })).toBeInTheDocument()
    // The header row is immediately followed by the card: nothing sits between them.
    expect(header.nextElementSibling).toBe(screen.getByTestId('result-preview'))

    await user.click(preview)
    expect(props.onSaveForPreview).toHaveBeenCalledOnce()
    expect(await screen.findByRole('dialog', { name: 'Result preview' })).toBeInTheDocument()
  })

  it('switches the remembered name mode from the toggle in the header', async () => {
    const user = userEvent.setup()
    renderReview()
    const header = screen.getByText('This is how the result will look').closest('div[class]')?.parentElement as HTMLElement
    expect(within(header).getByRole('button', { name: 'Full name' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(header).getByRole('button', { name: 'First name' }))
    expect(within(header).getByRole('button', { name: 'First name' })).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem(PLAYER_NAME_MODE_KEY)).toBe('first')
  })

  it('does not open the preview when the draft could not be saved', async () => {
    const user = userEvent.setup()
    renderReview({ onSaveForPreview: vi.fn().mockResolvedValue(false) })
    await user.click(screen.getByRole('button', { name: 'Preview result' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview result' })).toBeEnabled())
    expect(screen.queryByRole('dialog', { name: 'Result preview' })).not.toBeInTheDocument()
  })
})

describe('Review step: Not recorded rows', () => {
  it('shows nothing as missing when Toss, Field and the team player are all set', () => {
    renderReview({
      draft: { ...FULL_DRAFT, scorecard: { players: [{ clientKey: 'k1', side: 'HOME', playerProfileId: 'p1', firstName: 'Ann', lastName: 'Ash', substitute: false }], batting: [], bowling: [], fielding: [], awards: [{ awardType: 'TEAM_PLAYER_OF_MATCH', side: 'HOME', playerClientKey: 'k1' }] } as never },
    })
    expect(screen.queryAllByTestId('review-not-recorded')).toHaveLength(0)
  })

  it('marks Toss, Field and Team player as Not recorded with an Add jump to the step that sets them', async () => {
    const user = userEvent.setup()
    const props = renderReview({ draft: { ...FULL_DRAFT, tossWonBy: null, tossDecision: null }, fieldName: null })
    const missing = screen.getAllByTestId('review-not-recorded')
    expect(missing).toHaveLength(3)
    for (const node of missing) expect(within(node).getByText('Not recorded')).toBeInTheDocument()

    await user.click(within(missing[0]).getByRole('button', { name: 'Add' }))
    expect(props.onGoToStep).toHaveBeenLastCalledWith('toss', undefined)
    await user.click(within(missing[1]).getByRole('button', { name: 'Add' }))
    expect(props.onGoToStep).toHaveBeenLastCalledWith('toss', undefined)
    await user.click(within(missing[2]).getByRole('button', { name: 'Add' }))
    expect(props.onGoToStep).toHaveBeenLastCalledWith('awards', 'HOME')
  })

  it('uses the warning treatment (warning-coloured icon and text) and never blocks publishing', () => {
    renderReview({ draft: { ...FULL_DRAFT, tossWonBy: null, tossDecision: null }, fieldName: null })
    const first = screen.getAllByTestId('review-not-recorded')[0]
    expect(within(first).getByText('Not recorded')).toHaveStyle({ fontWeight: '600' })
    expect(first.querySelector('[data-testid="WarningAmberOutlinedIcon"]')).not.toBeNull()
    // A visual hint only: the Checks list still reports the result as ready.
    expect(screen.getByText('Everything checks out. This result is ready to publish.')).toBeInTheDocument()
  })

  it('names the team in a derby ("2nd XI player")', () => {
    renderReview({ oursSides: [{ side: 'HOME', teamId: 'team-1', teamName: '1st XI' }, { side: 'AWAY', teamId: 'team-2', teamName: '2nd XI' }] })
    expect(screen.getByText('1st XI player')).toBeInTheDocument()
    expect(screen.getByText('2nd XI player')).toBeInTheDocument()
  })
})
