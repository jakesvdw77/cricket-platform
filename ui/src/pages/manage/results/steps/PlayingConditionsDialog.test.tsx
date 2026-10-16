import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../../../theme'
import { PlayingConditionsDialog } from './PlayingConditionsDialog'

const getPlayingConditions = vi.fn()

vi.mock('../../../../api/leaguePlayingConditionsApi', () => ({
  PLAYING_CONDITIONS_PDF_NAME: 'Playing Conditions.pdf',
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) => getPlayingConditions(clubId, leagueId, seasonId),
}))
vi.mock('../../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([{ id: 'league-1', name: 'Saturday League' }]) }))
vi.mock('../../../../api/seasonApi', () => ({ listSeasons: () => Promise.resolve([{ id: 'season-1', label: '2026/27' }]) }))

const conditions = {
  id: 'pc-1',
  leagueId: 'league-1',
  seasonId: 'season-1',
  documentUrl: null,
  maxOversPerInnings: 40,
  powerplayOvers: 10,
  maxOversPerBowler: null,
  fieldingRestrictionsNotes: null,
  allowSubstitutions: false,
  additionalNotes: null,
}

function show(scheduledOvers: number | null = 40, onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <PlayingConditionsDialog open onClose={onClose} clubId="club-1" leagueId="league-1" seasonId="season-1" scheduledOvers={scheduledOvers} />
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return onClose
}

beforeEach(() => {
  vi.clearAllMocks()
  getPlayingConditions.mockResolvedValue(conditions)
})

describe('PlayingConditionsDialog', () => {
  it('shows the league, the season and the values, with Auto (8) for a blank per-bowler maximum', async () => {
    show()
    expect(await screen.findByText('Saturday League')).toBeInTheDocument()
    expect(await screen.findByText('2026/27')).toBeInTheDocument()
    expect(screen.getByText('Max overs per bowler').nextSibling).toHaveTextContent('Auto (8)')
    expect(getPlayingConditions).toHaveBeenCalledWith('club-1', 'league-1', 'season-1')
    expect(screen.queryByText(/This result is/)).not.toBeInTheDocument()
  })

  it('says so when no conditions are on file', async () => {
    getPlayingConditions.mockResolvedValue(null)
    show()
    expect(await screen.findByText('No playing conditions are on file for this league and season.')).toBeInTheDocument()
  })

  it('notes when the result has other overs than the league', async () => {
    show(20)
    expect(await screen.findByText('This result is 20 overs; this league plays 40.')).toBeInTheDocument()
  })

  it('opens the league conditions in a new tab, and closes', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const onClose = show()
    const user = userEvent.setup()
    await screen.findByText('Saturday League')
    await user.click(screen.getByRole('button', { name: "Open the league's conditions" }))
    expect(open).toHaveBeenCalledWith('/manage/fixtures/leagues/league-1/edit?tab=conditions', '_blank', 'noopener')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
    open.mockRestore()
  })
})
