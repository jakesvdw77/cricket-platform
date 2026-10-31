import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseTheme } from '../../../theme'
import { shareSettingsKey } from '../../../api/shareSettingsApi'
import { fixtureMatch } from '../../../utils/share/matchShareFixture'
import { useTeamSheetShare } from './useTeamSheetShare'

// docs/specs/131: Share Match opens the match dialog; a match with a published result hands over to the result Share dialog.
const getMatchResult = vi.fn()
vi.mock('../../../api/matchResultApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/matchResultApi')>()),
  getMatchResult: (...args: unknown[]) => getMatchResult(...args),
}))
vi.mock('../../../api/matchSideApi', () => ({ listMatchSides: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../api/teamSquadApi', () => ({ listSquad: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../components/ShareResultDialog', () => ({ ShareResultDialog: () => <div data-testid="result-share-dialog">Result share</div> }))

function Host({ resultStatus }: { resultStatus?: 'PUBLISHED' | 'NONE' }) {
  const { openShare, shareDialog } = useTeamSheetShare({
    clubId: 'club-1',
    match: fixtureMatch({ resultStatus }),
    teamsById: new Map(),
    leaguesById: new Map(),
    seasonsById: new Map(),
  })
  return (
    <>
      <button onClick={openShare}>Share it</button>
      {shareDialog}
    </>
  )
}

function renderHost(resultStatus?: 'PUBLISHED' | 'NONE') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(shareSettingsKey('club-1'), { initialsOnlyDefault: false, disabledFormats: {} })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Host resultStatus={resultStatus} />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  getMatchResult.mockReset()
})

describe('useTeamSheetShare', () => {
  it('opens the Share Match dialog for a match with no published result, without reading a result', async () => {
    renderHost('NONE')
    await userEvent.click(screen.getByRole('button', { name: 'Share it' }))
    expect(await screen.findByText('Share match')).toBeInTheDocument()
    expect(getMatchResult).not.toHaveBeenCalled()
  })

  it('hands a played match with a published result over to the result Share dialog', async () => {
    let finish: (value: unknown) => void = () => {}
    getMatchResult.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderHost('PUBLISHED')
    await userEvent.click(screen.getByRole('button', { name: 'Share it' }))
    expect(await screen.findByText('Opening the result share')).toBeInTheDocument()
    finish({ id: 'r1', status: 'PUBLISHED', hasScorecard: false })
    expect(await screen.findByTestId('result-share-dialog')).toBeInTheDocument()
    expect(screen.queryByText('Share match')).not.toBeInTheDocument()
  })
})
