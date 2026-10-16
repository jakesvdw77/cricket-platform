import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scorecard } from '../../../api/matchResultApi'
import type { ImportNote } from '../../../api/resultImportApi'
import { baseTheme } from '../../../theme'
import ResultCapturePage from './ResultCapturePage'
import { saveImportNotes } from './import/importNotesStore'
import { innings, makeMatch, makeResult } from './resultTestUtils'

// docs/specs/104 Test Plan (frontend): what the capture wizard shows for an imported draft: the Imported chip, the notice,
// the Guess chips and the Teams banner, Confirm all, Change and the one-tap "Change to <closest>", and Review's blocking error.

const getMatch = vi.fn()
const getMatchResult = vi.fn()
const saveResultDraft = vi.fn()
const validateResult = vi.fn()
const getScorecard = vi.fn()
const getScorecardPrefill = vi.fn()

vi.mock('../../../api/matchApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchApi')>()
  return { ...actual, getMatch: (c: string, m: string) => getMatch(c, m) }
})
vi.mock('../../../api/matchResultApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/matchResultApi')>()
  return {
    ...actual,
    getMatchResult: (c: string, m: string) => getMatchResult(c, m),
    saveResultDraft: (c: string, m: string, body: unknown) => saveResultDraft(c, m, body),
    validateResult: (c: string, m: string, body: unknown) => validateResult(c, m, body),
    publishResult: () => Promise.resolve(makeResult()),
    getScorecard: (c: string, m: string) => getScorecard(c, m),
    getScorecardPrefill: (c: string, m: string) => getScorecardPrefill(c, m),
    listOppositionNames: () => Promise.resolve({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 12 }),
    listGuestNames: () => Promise.resolve({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 8 }),
  }
})
vi.mock('../../../api/leaguePlayingConditionsApi', () => ({ getPlayingConditions: () => Promise.resolve(null) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: '1st XI', logoUrl: null }]) }))
vi.mock('../../../api/teamSquadApi', () => ({ listSquad: () => Promise.resolve([]) }))
vi.mock('../../../api/playerApi', () => ({ listPlayers: () => Promise.resolve([]) }))

function renderPage(search = '') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/manage/results/match-1/capture${search}`]}>
          <Routes>
            <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
              <Route path="results/:matchId/capture" element={<ResultCapturePage />} />
              <Route path="*" element={<div>elsewhere</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

const HOME = '1st XI'
const CLEAN = { canPublish: true, errors: [], warnings: [], issues: [] }
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const step = (label: string) => screen.getByRole('button', { name: new RegExp(`^Step \\d+: ${escape(label)}(?: \\((?:done|optional)\\))*$`) })
const lastSaved = () => saveResultDraft.mock.calls.at(-1)?.[2] as { scorecard?: Scorecard }
const savedPlayer = (id: string) => lastSaved().scorecard?.players.find((p) => p.id === id)

const row = (key: string, first: string, last: string, extra: object = {}) => ({
  id: `id-${key}`, side: 'HOME', playerProfileId: `p-${key}`, displayName: null, plannedBattingOrder: null, replacedPlayerProfileId: null,
  substitute: false, firstName: first, lastName: last, guest: false, ...extra,
})
const oppo = (key: string, name: string) => ({
  id: `id-${key}`, side: 'AWAY', playerProfileId: null, displayName: name, plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false, opposition: true,
})

// Two rule-based guesses (Ann, Cy), one reserved AI level (Dan), one name nobody matched (Dino V), and an exact link (Bob).
const importedScorecard = (): Scorecard =>
  ({
    players: [
      row('a', 'Ann', 'Ash', { displayName: 'Ann A', importMatch: 'NORMALISED' }),
      row('b', 'Bob', 'Bell', { displayName: 'Bob Bell', plannedBattingOrder: 2 }),
      row('c', 'Cy', 'Cox', { displayName: 'Cy C', importMatch: 'NORMALISED' }),
      row('d', 'Dan', 'Day', { displayName: 'D Day', importMatch: 'AI_SUGGESTED' }),
      { ...row('g', '', ''), playerProfileId: null, displayName: 'Dino V', guest: true, firstName: null, lastName: null },
      oppo('x', 'Sam Jones'),
    ],
    batting: [], bowling: [], fielding: [], awards: [],
  }) as never

const prefill = () => ({
  sides: [
    {
      side: 'HOME',
      teamId: 'team-1',
      teamName: HOME,
      selectionState: 'ANNOUNCED',
      players: [
        ['a', 'Ann', 'Ash'],
        ['b', 'Bob', 'Bell'],
        ['c', 'Cy', 'Cox'],
        ['d', 'Dan', 'Day'],
        ['e', 'Eve', 'Elm'],
      ].map(([key, firstName, lastName], index) => ({ playerProfileId: `p-${key}`, firstName, lastName, plannedBattingOrder: index + 1, role: 'BATSMAN', substitute: false })),
    },
  ],
})

const notes = (overrides: ImportNote[] = []): ImportNote[] => [
  { code: 'NAME_INITIALS', severity: 'INFO', section: 'ours', message: 'm', fileText: 'Ann A', candidateName: 'Ann Ash' },
  { code: 'NAME_SURNAME_PREFIX', severity: 'INFO', section: 'ours', message: 'm', fileText: 'Cy C', candidateName: 'Cy Cox' },
  { code: 'NAME_SUGGESTED', severity: 'INFO', section: 'ours', message: 'm', fileText: 'D Day', candidateName: 'Dan Day' },
  {
    code: 'NAME_UNRESOLVED',
    severity: 'WARNING',
    section: 'ours',
    message: 'm',
    fileText: 'Dino V',
    level: 'UNRESOLVED',
    suggestions: [
      { playerProfileId: 'p-e', displayName: 'Eve Elm', score: 0.82 },
      { playerProfileId: 'p-b', displayName: 'Bob Bell', score: 0.4 },
    ],
  },
  ...overrides,
]

const storedDraft = (extra: object = {}) =>
  makeResult({ status: 'DRAFT', source: 'IMPORT:ACMESCORE', outcomeType: null, winningSide: null, marginType: null, marginValue: null, innings: [], hasScorecard: true, ...extra })

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom has no layout, so no scrolling: Next one to check scrolls the chip into view before opening it.
  Element.prototype.scrollIntoView = vi.fn()
  sessionStorage.clear()
  window.localStorage.clear()
  getMatch.mockResolvedValue(makeMatch({ id: 'match-1' }))
  getMatchResult.mockResolvedValue(storedDraft())
  getScorecard.mockResolvedValue(importedScorecard())
  getScorecardPrefill.mockResolvedValue(prefill())
  saveResultDraft.mockImplementation((_c: string, _m: string, body: object) => Promise.resolve(makeResult({ status: 'DRAFT', source: 'IMPORT:ACMESCORE', ...body })))
  validateResult.mockResolvedValue(CLEAN)
  saveImportNotes('club-1', 'match-1', notes())
})

const open = async (search = '') => {
  const user = userEvent.setup()
  renderPage(search)
  await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
  await screen.findByTestId('import-guess-banner', {}, { timeout: 10000 })
  return user
}
const banner = () => within(screen.getByTestId('import-guess-banner'))
const guessChip = (importedName: string) => screen.getByRole('button', { name: new RegExp(`^Guess: file said ${escape(importedName)},`) })

describe('an imported draft in the capture wizard', () => {
  it('shows the Imported chip, and nothing of the kind for a manual result', async () => {
    await open()
    expect(screen.getByTestId('imported-chip')).toHaveTextContent('Imported from ACMESCORE')
  })

  it('shows no chip, banner or Guess chip for a manual result', async () => {
    getMatchResult.mockResolvedValue(storedDraft({ source: 'MANUAL' }))
    renderPage()
    await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
    await screen.findByText('Ann Ash', {}, { timeout: 10000 })
    expect(screen.queryByTestId('imported-chip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('import-guess-banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Guess:/ })).not.toBeInTheDocument()
  })

  describe('the notice after the import', () => {
    it('says the draft was created, lists the notes that are not about a name with warnings first, and is dismissed with a 44 px button', async () => {
      const user = userEvent.setup()
      saveImportNotes('club-1', 'match-1', [
        ...notes(),
        { code: 'FOW_IGNORED', severity: 'INFO', section: 'innings', message: 'Fall of wickets was ignored.' },
        { code: 'SUPER_OVER_DROPPED', severity: 'WARNING', section: 'innings', message: 'Super-over rows were dropped.' },
      ])
      renderPage('?imported=1')

      const notice = await screen.findByText(/Draft created from the import/, {}, { timeout: 10000 })
      const alert = notice.closest('[role="alert"]') as HTMLElement
      const items = within(within(alert).getByTestId('import-notes')).getAllByRole('listitem')
      expect(items.map((item) => item.textContent)).toEqual(['Super-over rows were dropped.', 'Fall of wickets was ignored.'])

      const dismiss = within(alert).getByRole('button', { name: 'Dismiss' })
      expect(getComputedStyle(dismiss).width).toBe('44px')
      expect(getComputedStyle(dismiss).height).toBe('44px')
      await user.click(dismiss)
      expect(screen.queryByText(/Draft created from the import/)).not.toBeInTheDocument()
    })

    it('is not shown when the wizard is opened any other way', async () => {
      await open()
      expect(screen.queryByText(/Draft created from the import/)).not.toBeInTheDocument()
    })
  })

  describe('the toss warning', () => {
    const noToss = () =>
      getMatchResult.mockResolvedValue(storedDraft({ tossWonBy: null, tossDecision: null, innings: [innings(1, 'AWAY', 150, 8), innings(2, 'HOME', 151, 4)] }))

    it('says in the notice that the toss was not in the file and why it matters', async () => {
      noToss()
      renderPage('?imported=1')

      const notice = await screen.findByTestId('import-toss-notice', {}, { timeout: 10000 })
      expect(notice).toHaveTextContent('The toss was not in the file.')
      expect(notice).toHaveTextContent('runs or by wickets')
    })

    it('puts a warning card at the top of the Toss step naming the side the file had batting first', async () => {
      noToss()
      const user = await open()
      await user.click(step('Toss and field'))

      const warning = await screen.findByTestId('import-toss-warning')
      expect(warning).toHaveTextContent('Toss not recorded')
      expect(warning).toHaveTextContent('The file did not say who won the toss.')
      expect(warning).toHaveTextContent('batted first')
      expect(warning).toHaveTextContent('win by wickets will be shown as a win by runs')
    })

    it('says the decision is missing when only the winner of the toss is known', async () => {
      getMatchResult.mockResolvedValue(storedDraft({ tossWonBy: 'HOME', tossDecision: null, innings: [innings(1, 'HOME', 150, 8), innings(2, 'AWAY', 151, 4)] }))
      const user = await open()
      await user.click(step('Toss and field'))

      expect(await screen.findByTestId('import-toss-warning')).toHaveTextContent('The toss decision (bat or bowl) is missing.')
    })

    it('shows nothing when the toss is complete, or for a manual result', async () => {
      getMatchResult.mockResolvedValue(storedDraft({ tossWonBy: 'HOME', tossDecision: 'BAT', innings: [innings(1, 'HOME', 150, 8), innings(2, 'AWAY', 151, 4)] }))
      const user = await open('?imported=1')
      expect(screen.queryByTestId('import-toss-notice')).not.toBeInTheDocument()
      await user.click(step('Toss and field'))
      await screen.findByText('Who won the toss?')
      expect(screen.queryByTestId('import-toss-warning')).not.toBeInTheDocument()
    })

    it('never appears on a manual result with no toss', async () => {
      getMatchResult.mockResolvedValue(storedDraft({ source: 'MANUAL', tossWonBy: null, tossDecision: null, innings: [] }))
      renderPage('?imported=1')
      await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
      expect(screen.queryByTestId('import-toss-notice')).not.toBeInTheDocument()
    })
  })

  describe('the Teams banner', () => {
    it('counts the guesses and the guest, says a guess blocks publishing, and offers Next one to check', async () => {
      await open()
      expect(banner().getByText('Check these names')).toBeInTheDocument()
      expect(screen.getByTestId('import-guess-banner')).toHaveTextContent(
        'Imported from ACMESCORE. 3 names were matched by a best guess and 1 could not be matched, so it is a guest. A result cannot be published while a guess is unconfirmed.',
      )
      expect(banner().getByRole('button', { name: 'Next one to check' })).toBeInTheDocument()
    })

    it('Next one to check opens the first guess, then the next one, guesses before guests', async () => {
      const user = await open()
      await user.click(banner().getByRole('button', { name: 'Next one to check' }))
      // The first guess in list order is Ann's: its popover opened by itself.
      expect(await screen.findByRole('presentation')).toHaveTextContent("File said 'Ann A'")
      await user.click(screen.getByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(screen.queryByRole('presentation')).not.toBeInTheDocument())

      // Tapping again goes on to the next guess, Cy's, and then Dan's, before the guest.
      await user.click(banner().getByRole('button', { name: 'Next one to check' }))
      expect(await screen.findByRole('presentation')).toHaveTextContent("File said 'Cy C'")
    })

    it('offers Confirm all for the rule-based guesses only (two of the three), behind a confirm', async () => {
      const user = await open()
      await user.click(banner().getByRole('button', { name: 'Confirm all 2 rule-based guesses' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Confirm all 2 rule-based guesses?')).toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: 'Confirm all' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /^Guess: file said Ann A,/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Guess: file said Cy C,/ })).not.toBeInTheDocument()
      // The reserved AI level and the guest are untouched, so the banner stays, with no Confirm all left.
      expect(guessChip('D Day')).toBeInTheDocument()
      expect(banner().queryByRole('button', { name: /Confirm all/ })).not.toBeInTheDocument()
      expect(screen.getByTestId('import-guess-banner')).toHaveTextContent('1 name was matched by a best guess and 1 could not be matched')
    })

    it('does not offer Confirm all when no guess is rule-based', async () => {
      getScorecard.mockResolvedValue({
        ...importedScorecard(),
        players: importedScorecard().players.map((p) => (p.importMatch === 'NORMALISED' ? { ...p, importMatch: null } : p)),
      })
      await open()
      expect(banner().queryByRole('button', { name: /Confirm all/ })).not.toBeInTheDocument()
      expect(banner().getByRole('button', { name: 'Next one to check' })).toBeInTheDocument()
    })

    it('goes away once nothing is left to check', async () => {
      getScorecard.mockResolvedValue({ ...importedScorecard(), players: [row('b', 'Bob', 'Bell', { displayName: 'Bob Bell' })] })
      renderPage()
      await screen.findByText('Bob Bell', {}, { timeout: 10000 })
      expect(screen.queryByTestId('import-guess-banner')).not.toBeInTheDocument()
    })
  })

  describe('a Guess chip', () => {
    it('tells what the file said and who it was matched to, and Confirm clears the flag in the next save', async () => {
      const user = await open()
      await user.click(guessChip('Ann A'))
      const popover = await screen.findByRole('presentation')
      expect(popover).toHaveTextContent("File said 'Ann A'. Matched to Ann Ash by initials.")

      await user.click(within(popover).getByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(screen.queryByRole('button', { name: /^Guess: file said Ann A,/ })).not.toBeInTheDocument())
      // findBy waits out the fading dialog or popover, which hides the rest of the page from the accessibility tree meanwhile.
      await user.click(await screen.findByRole('button', { name: 'Next: Toss and field' }))
      await waitFor(() => expect(saveResultDraft).toHaveBeenCalled())
      expect(savedPlayer('id-a')?.importMatch ?? null).toBeNull()
      expect(savedPlayer('id-c')?.importMatch).toBe('NORMALISED')
      expect(savedPlayer('id-a')?.playerProfileId).toBe('p-a')
    })

    it('Change opens the picker with the file name; for an unresolved name it lists the ranked closest players', async () => {
      const user = await open()
      await user.click(guessChip('Ann A'))
      await user.click(await screen.findByRole('button', { name: 'Change' }))
      const dialog = await screen.findByRole('dialog', { name: 'Choose the player' })
      expect(within(dialog).getByText('Ann A')).toBeInTheDocument()
      expect(within(dialog).getByText(/File said:/)).toBeInTheDocument()
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    })

    it('an unresolved Guest chip goes straight to the picker with the ranked suggestions, best first, with similarity', async () => {
      const user = await open()
      await user.click(screen.getByRole('button', { name: 'Choose the player for Dino V' }))

      const dialog = await screen.findByRole('dialog', { name: 'Link to a registered player' })
      expect(within(dialog).getByText(/File said:/)).toHaveTextContent('Dino V')
      const closest = within(within(dialog).getByRole('list', { name: 'Closest players' })).getAllByRole('button')
      expect(closest[0]).toHaveTextContent('Eve Elm')
      expect(closest[0]).toHaveTextContent('82%')
      expect(closest[1]).toHaveTextContent('Bob Bell')
      // Bob already plays for the side, so he cannot be picked again.
      expect(closest[1]).toHaveAttribute('aria-disabled', 'true')
    })

    it('picking a suggestion links the row, clears the flag and keeps the file spelling for the club to remember', async () => {
      const user = await open()
      await user.click(screen.getByRole('button', { name: 'Choose the player for Dino V' }))
      const dialog = await screen.findByRole('dialog', { name: 'Link to a registered player' })
      await user.click(within(within(dialog).getByRole('list', { name: 'Closest players' })).getByRole('button', { name: /Eve Elm/ }))

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Choose the player for Dino V' })).not.toBeInTheDocument())
      // findBy waits out the fading dialog or popover, which hides the rest of the page from the accessibility tree meanwhile.
      await user.click(await screen.findByRole('button', { name: 'Next: Toss and field' }))
      await waitFor(() => expect(saveResultDraft).toHaveBeenCalled())
      expect(savedPlayer('id-g')).toMatchObject({ playerProfileId: 'p-e', displayName: 'Dino V', guest: false })
      expect(savedPlayer('id-g')?.importMatch ?? null).toBeNull()
    })
  })

  describe('Change to the closest player', () => {
    const useClosest = () => screen.getByRole('button', { name: 'Change to Eve Elm for Dino V' })

    it('is offered under the unresolved name, in the status column and not in the name cell', async () => {
      await open()
      const button = useClosest()
      expect(button).toHaveTextContent('Change to Eve Elm')
      const cell = button.closest('td') as HTMLElement
      const cells = Array.from((cell.parentElement as HTMLElement).children)
      const headers = within(button.closest('table') as HTMLElement).getAllByRole('columnheader')
      expect(headers[cells.indexOf(cell)]).toHaveTextContent('Type')
      // The name cell (the first) carries only the chip and the caption, so every row keeps the same height.
      expect(within(cells[0] as HTMLElement).queryByTestId('use-closest')).not.toBeInTheDocument()
    })

    it('links the top suggestion only on a tap, never by itself', async () => {
      const user = await open()
      // Nothing is saved or linked just by the button being there.
      expect(saveResultDraft).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Choose the player for Dino V' })).toBeInTheDocument()

      await user.click(useClosest())
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Choose the player for Dino V' })).not.toBeInTheDocument())
      // findBy waits out the fading dialog or popover, which hides the rest of the page from the accessibility tree meanwhile.
      await user.click(await screen.findByRole('button', { name: 'Next: Toss and field' }))
      await waitFor(() => expect(saveResultDraft).toHaveBeenCalled())
      expect(savedPlayer('id-g')).toMatchObject({ playerProfileId: 'p-e', displayName: 'Dino V' })
    })

    it('is hidden when the closest player is already on the side, and the caption says who is closest instead', async () => {
      getScorecard.mockResolvedValue({
        ...importedScorecard(),
        players: [...importedScorecard().players, row('e', 'Eve', 'Elm', { displayName: 'Eve Elm' })],
      })
      renderPage()
      await screen.findByTestId('import-guess-banner', {}, { timeout: 10000 })
      expect(screen.queryByRole('button', { name: /^Change to Eve Elm/ })).not.toBeInTheDocument()
      expect(screen.getByText('Closest: Eve Elm')).toBeInTheDocument()
    })

    it('is not offered for a guess, which has a Confirm and a Change instead', async () => {
      await open()
      expect(screen.getAllByTestId('use-closest')).toHaveLength(1)
    })
  })

  describe('the Teams list rows', () => {
    it('hides the planned batting number for an imported draft, but keeps it for a manual one', async () => {
      await open()
      expect(screen.queryByText(/planned \d/)).not.toBeInTheDocument()
    })

    it('keeps the planned number for a manual result', async () => {
      getMatchResult.mockResolvedValue(storedDraft({ source: 'MANUAL' }))
      getScorecard.mockResolvedValue({ ...importedScorecard(), players: [row('b', 'Bob', 'Bell', { plannedBattingOrder: 2 })] })
      renderPage()
      expect((await screen.findAllByText('planned 2', {}, { timeout: 10000 })).length).toBeGreaterThan(0)
    })
  })

  describe('Review', () => {
    it('lists an unconfirmed guess as an error that blocks Publish, and its Fix opens Teams', async () => {
      validateResult.mockResolvedValue({
        canPublish: false,
        errors: ['Check the player'],
        warnings: [],
        issues: [{ code: 'IMPORTED_NAME_UNCONFIRMED', step: 'BATTING', side: 'HOME', severity: 'ERROR', message: "Confirm or change 'Ann A' (matched to Ann Ash) before publishing." }],
      })
      const user = await open()
      await user.click(step('Review'))

      const checks = await screen.findByRole('list', { name: 'Checks' })
      const issue = await within(checks).findByText("Confirm or change 'Ann A' (matched to Ann Ash) before publishing.")
      expect(issue.closest('li')).toHaveAttribute('data-tone', 'error')
      expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()

      await user.click(within(checks).getByRole('button', { name: 'Fix' }))
      expect(await screen.findByText('Who is playing?')).toBeInTheDocument()
    })
  })
})
