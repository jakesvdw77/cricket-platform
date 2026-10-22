import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { AxiosError } from 'axios'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scorecard } from '../../../api/matchResultApi'
import { baseTheme } from '../../../theme'
import ResultCapturePage from './ResultCapturePage'
import { makeMatch, makeResult } from './resultTestUtils'

// docs/specs/101 Test Plan: the scorecard wizard flow on the page (Teams, Batting, Bowling and fielding, Review).

const getMatch = vi.fn()
const getMatchResult = vi.fn()
const saveResultDraft = vi.fn()
const validateResult = vi.fn()
const publishResult = vi.fn()
const getScorecard = vi.fn()
const getScorecardPrefill = vi.fn()
const listOppositionNames = vi.fn()

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
    publishResult: (c: string, m: string, ack: boolean) => publishResult(c, m, ack),
    getScorecard: (c: string, m: string) => getScorecard(c, m),
    getScorecardPrefill: (c: string, m: string) => getScorecardPrefill(c, m),
    listOppositionNames: (c: string, p: unknown) => listOppositionNames(c, p),
    listGuestNames: () => Promise.resolve({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 20 }),
  }
})
vi.mock('../../../api/leaguePlayingConditionsApi', () => ({ getPlayingConditions: () => Promise.resolve(null) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: '1st XI', logoUrl: null }]) }))

const notFound = () => new AxiosError('nope', '404', undefined, undefined, { status: 404 } as never)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider theme={baseTheme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/manage/results/match-1/capture']}>
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
const AWAY = 'Riverside Occasionals'
const CLEAN = { canPublish: true, errors: [], warnings: [], issues: [] }
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const step = (label: string) => screen.getByRole('button', { name: new RegExp(`^Step \\d+: ${escape(label)}(?: \\((?:done|optional)\\))*$`) })
const lastSaved = () => saveResultDraft.mock.calls.at(-1)?.[2] as { scorecard?: Scorecard; innings?: unknown[]; outcomeType?: string | null }

const names = ['Ann Ash', 'Bob Bell', 'Cy Cox', 'Dan Day', 'Eve Elm', 'Fay Fox', 'Gus Gray', 'Hal Hill', 'Ian Ito', 'Jo Jay', 'Kim Kay']
const prefill = (count = 11, state: 'ANNOUNCED' | 'NONE' | 'NOT_ANNOUNCED' = 'ANNOUNCED') => ({
  sides: [
    {
      side: 'HOME',
      teamId: 'team-1',
      teamName: HOME,
      selectionState: state,
      players: [
        ...names.slice(0, count).map((full, index) => {
          const [firstName, lastName] = full.split(' ')
          return { playerProfileId: `p${index}`, firstName, lastName, plannedBattingOrder: index + 1, role: 'BATSMAN', substitute: false }
        }),
        ...(count > 0 ? [{ playerProfileId: 'p-sub', firstName: 'Zed', lastName: 'Zulu', plannedBattingOrder: null, role: 'BATSMAN', substitute: true }] : []),
      ],
    },
  ],
})

const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(escape(name)) })

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  getMatch.mockResolvedValue(makeMatch({ id: 'match-1' }))
  getMatchResult.mockRejectedValue(notFound())
  saveResultDraft.mockImplementation((_c: string, _m: string, body: object) => Promise.resolve(makeResult({ status: 'DRAFT', ...body })))
  validateResult.mockResolvedValue(CLEAN)
  publishResult.mockResolvedValue(makeResult())
  getScorecardPrefill.mockResolvedValue(prefill())
  getScorecard.mockResolvedValue({ players: [], batting: [], bowling: [], fielding: [], awards: [] })
  listOppositionNames.mockResolvedValue({ content: [], totalElements: 0, totalPages: 1, number: 0, size: 12 })
})

describe('Teams step', () => {
  it('shows a two-tile toggle for both sides, our side first with the 12th man marked', async () => {
    renderPage()
    expect(await screen.findByText('Ann Ash', {}, { timeout: 10000 })).toBeInTheDocument()
    const group = screen.getByRole('radiogroup', { name: 'Who is playing?' })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    expect(radio(HOME)).toHaveAttribute('aria-checked', 'true')
    expect(radio(AWAY)).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('11 players + 12th man')).toBeInTheDocument()
  })

  it('saves a players-only draft (no innings, no outcome) when the manager moves on', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ann Ash', {}, { timeout: 10000 })
    await user.click(screen.getByRole('button', { name: 'Next: Toss and field' }))
    await screen.findByText('Who won the toss?')

    await waitFor(() => expect(saveResultDraft).toHaveBeenCalled())
    const body = lastSaved()
    expect(body.outcomeType ?? null).toBeNull()
    expect(body.innings ?? []).toEqual([])
    expect(body.scorecard?.players).toHaveLength(12)
    expect(body.scorecard?.players.filter((p) => p.substitute)).toHaveLength(1)
    expect(body.scorecard?.batting).toEqual([])
  })

  it('takes a pasted opposition list in order, dropping list numbers, blanks and duplicates, and never blocks', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ann Ash', {}, { timeout: 10000 })
    await user.click(radio(AWAY))

    const box = await screen.findByLabelText('Type or paste names, one per line')
    await user.click(box)
    await user.paste('1. Sam Jones\n\n2) Tom Brown\nsam jones\n- Ali Khan')
    await user.click(screen.getByRole('button', { name: 'Add names' }))

    const table = await screen.findByRole('table', { name: `${AWAY} team` })
    const inputs = within(table).getAllByRole('textbox') as HTMLInputElement[]
    expect(inputs.map((input) => input.value)).toEqual(['Sam Jones', 'Tom Brown', 'Ali Khan'])
    // The opposition list may stay incomplete: the wizard moves on.
    await user.click(screen.getByRole('button', { name: 'Next: Toss and field' }))
    expect(await screen.findByText('Who won the toss?')).toBeInTheDocument()
    await waitFor(() => expect(lastSaved().scorecard?.players.filter((p) => (p as { opposition?: boolean }).opposition)).toHaveLength(3))
  })

  it('adds a row on Enter in the Add a name field and ignores Enter on an empty field', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ann Ash', {}, { timeout: 10000 })
    await user.click(radio(AWAY))
    const add = await screen.findByLabelText('Add a name')
    await user.click(add)
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('table', { name: `${AWAY} team` })?.querySelectorAll('input[data-opp-key]:not([data-opp-key=""])') ?? []).toHaveLength(0)
    await user.type(add, 'Sam Jones{Enter}')
    await waitFor(() => expect(screen.getByLabelText('Name, Sam Jones')).toBeInTheDocument())
  })

  it('offers "Played for ... before" chips that add a name with one tap and hide names already listed', async () => {
    listOppositionNames.mockResolvedValue({
      content: [
        { displayName: 'Sam Jones', uses: 3, lastMatchDate: '2026-05-01' },
        { displayName: 'Tom Brown', uses: 1, lastMatchDate: '2026-04-01' },
      ],
      totalElements: 2, totalPages: 1, number: 0, size: 12,
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ann Ash', {}, { timeout: 10000 })
    await user.click(radio(AWAY))

    const chips = await screen.findByTestId('opposition-suggestions')
    expect(within(chips).getByText(`Played for ${AWAY} before · tap to add`)).toBeInTheDocument()
    await user.click(within(chips).getByText('Sam Jones · 3'))
    expect(await screen.findByLabelText('Name, Sam Jones')).toBeInTheDocument()
    expect(within(screen.getByTestId('opposition-suggestions')).queryByText('Sam Jones · 3')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('opposition-suggestions')).getByText('Tom Brown')).toBeInTheDocument()
    // The paste box stays alongside the chips... until a name exists; the grid and Add a name field remain.
    expect(screen.getByLabelText('Add a name')).toBeInTheDocument()
  })

  it('"Don\'t capture the team" drops the proposed list and moves on to Toss and field', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ann Ash', {}, { timeout: 10000 })
    await user.click(screen.getByRole('button', { name: "Don't capture the team" }))
    expect(await screen.findByText('Who won the toss?')).toBeInTheDocument()
    // Nothing was typed, so nothing is saved: the draft stays blank.
    expect(saveResultDraft).not.toHaveBeenCalled()
  })

  it('shows the not-selected banner for no selection with Populate, and not for an announced eleven', async () => {
    getScorecardPrefill.mockResolvedValue({ sides: [{ side: 'HOME', teamId: 'team-1', teamName: HOME, selectionState: 'NONE', players: [] }] })
    renderPage()
    expect(await screen.findByTestId('not-selected-banner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Populate from the team' })).toBeInTheDocument()
  })

  it('does not warn for an unannounced selection of eleven', async () => {
    getScorecardPrefill.mockResolvedValue(prefill(11, 'NOT_ANNOUNCED'))
    renderPage()
    await screen.findByText('Ann Ash', {}, { timeout: 10000 })
    expect(screen.queryByTestId('not-selected-banner')).not.toBeInTheDocument()
  })

  it('warns for a list shorter than eleven', async () => {
    getScorecardPrefill.mockResolvedValue(prefill(8))
    renderPage()
    await screen.findByText('Ann Ash', {}, { timeout: 10000 })
    expect(await screen.findByTestId('not-selected-banner')).toHaveTextContent(/Only 8 players/)
  })
})

// ---- a stored draft with the team listed, for the Batting, Bowling and Review steps ----

const player = (key: string, first: string, last: string, extra: object = {}) => ({
  id: `id-${key}`, side: 'HOME', playerProfileId: `p-${key}`, displayName: null, plannedBattingOrder: null, replacedPlayerProfileId: null,
  substitute: false, firstName: first, lastName: last, guest: false, ...extra,
})
const oppo = (key: string, name: string) => ({
  id: `id-${key}`, side: 'AWAY', playerProfileId: null, displayName: name, plannedBattingOrder: null, replacedPlayerProfileId: null, substitute: false, opposition: true,
})
const storedScorecard = (): Scorecard => ({
  players: [player('a', 'Ann', 'Ash'), player('b', 'Bob', 'Bell'), player('c', 'Cy', 'Cox'), oppo('x', 'Sam Jones'), oppo('y', 'Tom Brown')] as never,
  batting: [], bowling: [], fielding: [], awards: [],
})
const storedDraft = (extra: object = {}) =>
  makeResult({ status: 'DRAFT', outcomeType: null, winningSide: null, marginType: null, marginValue: null, innings: [], hasScorecard: true, ...extra })

describe('Teams step: guest rows', () => {
  const guest = (key: string, name: string) => player(key, '', '', { playerProfileId: null, displayName: name, firstName: null, lastName: null, guest: true })

  beforeEach(() => {
    getMatchResult.mockResolvedValue(storedDraft())
    getScorecard.mockResolvedValue({
      players: [player('a', 'Ann', 'Ash'), guest('g', 'Gus Guest'), oppo('x', 'Sam Jones')],
      batting: [], bowling: [], fielding: [], awards: [],
    })
  })

  async function openTeams() {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
    await user.click(step('Teams'))
    await screen.findByText('Gus Guest')
    return user
  }

  it('says Guest once on the row, in the Type column, and offers Link only on our guest', async () => {
    await openTeams()
    expect(screen.getAllByText('Guest')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Link to player' })).toHaveLength(1)
    expect(screen.getByText('Registered')).toBeInTheDocument()
  })

  it('has no Link button on the opposition list', async () => {
    const user = await openTeams()
    await user.click(radio(AWAY))
    await screen.findByText(`${AWAY}: who played`)
    expect(screen.queryByRole('button', { name: 'Link to player' })).not.toBeInTheDocument()
  })

  it('opens the Link to player picker with the New player tab', async () => {
    const user = await openTeams()
    await user.click(screen.getByRole('button', { name: 'Link to player' }))
    const dialog = await screen.findByRole('dialog', { name: 'Link to a registered player' })
    expect(within(dialog).getByLabelText('New player')).toBeInTheDocument()
    // The Club tab is scoped to the side's section (the 1st XI team has no section in this fixture, so no club list).
    await user.click(within(dialog).getByRole('button', { name: 'Club' }))
    expect(await within(dialog).findByText('Choose the team for this match first.')).toBeInTheDocument()
  })
})

describe('Batting step', () => {
  beforeEach(() => {
    getMatchResult.mockResolvedValue(storedDraft({ tossWonBy: 'AWAY', tossDecision: 'BAT' }))
    getScorecard.mockResolvedValue(storedScorecard())
  })

  it('opens on the side that bats first (from the toss) and lists the team as Did not bat after a reload', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
    await user.click(step('Batting'))

    expect(await screen.findByText(`${AWAY} batting`)).toBeInTheDocument()
    expect(radio(AWAY)).toHaveAttribute('aria-checked', 'true')
    await user.click(radio(HOME))
    expect(await screen.findByText(`${HOME} batting`)).toBeInTheDocument()
    for (const label of ['Ann Ash', 'Bob Bell', 'Cy Cox']) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    // Nobody is blank: every row starts as an automatic Did not bat.
    expect(screen.getByLabelText('How out, Ann Ash')).toHaveValue('Did not bat')
    expect(screen.getByLabelText('How out, Cy Cox')).toHaveValue('Did not bat')
  })
})

describe('Batting to Bowling', () => {
  beforeEach(() => {
    getMatchResult.mockResolvedValue(storedDraft({ tossWonBy: 'HOME', tossDecision: 'BAT' }))
    getScorecard.mockResolvedValue(storedScorecard())
  })

  it('fills zeros on a batter who played and creates the bowler row from a dismissal', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
    await user.click(step('Batting'))
    expect(await screen.findByText(`${HOME} batting`)).toBeInTheDocument()

    const howOut = screen.getByLabelText('How out, Ann Ash')
    await user.click(howOut)
    await user.type(howOut, 'b{Enter}')
    await waitFor(() => expect(screen.getByLabelText('How out, Ann Ash')).toHaveValue('Bowled'))
    // A batter who played starts on zeros rather than blanks.
    expect(screen.getByLabelText('Runs, Ann Ash')).toHaveValue('0')
    expect(screen.getByLabelText('Balls, Ann Ash')).toHaveValue('0')
    // Did not bat rows stay empty.
    expect(screen.getByLabelText('Runs, Bob Bell')).toHaveValue('')

    const bowler = screen.getByLabelText('Bowler, Ann Ash')
    await user.click(bowler)
    await user.click(await screen.findByRole('option', { name: 'Sam Jones' }))

    await user.click(step('Bowling and fielding'))
    // Bowling opens on the side that bowls first: the opposition, whose bowler the dismissal named.
    await waitFor(() => expect(radio(AWAY)).toHaveAttribute('aria-checked', 'true'))
    expect(await screen.findByLabelText('Overs, Sam Jones')).toBeInTheDocument()
    expect(screen.getByLabelText('Wickets, Sam Jones')).toHaveValue('1')
  })
})

describe('Review step', () => {
  const issue = (code: string, step: string, side: string | null, severity: string, message: string) => ({ code, step, side, severity, message })

  beforeEach(() => {
    getMatchResult.mockResolvedValue(storedDraft({ outcomeType: 'WON', winningSide: 'HOME', marginType: 'RUNS', marginValue: 24, innings: [
      { sequence: 1, kind: 'REGULAR', battingSide: 'HOME', runs: 200, wickets: 5, balls: 240 },
      { sequence: 2, kind: 'REGULAR', battingSide: 'AWAY', runs: 176, wickets: 9, balls: 240 },
    ] }))
    getScorecard.mockResolvedValue(storedScorecard())
  })

  it('lists typed issues with a team chip and a Fix that opens the right step, and the info line needs no tick', async () => {
    validateResult.mockResolvedValue({
      canPublish: true, errors: [], warnings: ['Bob has no bowler'],
      issues: [
        issue('BATTER_BOWLER_MISSING', 'BATTING', 'HOME', 'WARNING', 'A dismissal has no bowler'),
        issue('OUR_TEAM_NOT_SELECTED', 'TEAMS', 'HOME', 'INFO', 'Our team was not selected for this match'),
      ],
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
    await user.click(step('Review'))

    const checks = await screen.findByRole('list', { name: 'Checks' })
    expect(await within(checks).findByText('A dismissal has no bowler')).toBeInTheDocument()
    expect(within(checks).getAllByText(HOME).length).toBeGreaterThan(0)
    expect(within(checks).getByText('Our team was not selected for this match')).toBeInTheDocument()
    // The warning needs a tick before Publish; the info line does not add one of its own.
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled()

    await user.click(within(checks).getByRole('button', { name: 'Fix' }))
    expect(await screen.findByText(`${HOME} batting`)).toBeInTheDocument()
  })

  it('publishes without any tick when the only issue is the info line', async () => {
    validateResult.mockResolvedValue({
      canPublish: true, errors: [], warnings: [],
      issues: [issue('OUR_TEAM_NOT_SELECTED', 'TEAMS', 'HOME', 'INFO', 'Our team was not selected for this match')],
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
    await user.click(step('Review'))

    expect(await screen.findByText('Our team was not selected for this match')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled())
  })

  it('blocks Publish on an error issue and sends its Fix to the owning step', async () => {
    validateResult.mockResolvedValue({
      canPublish: false, errors: ['x'], warnings: [],
      issues: [issue('GUEST_ON_BOTH_SIDES', 'BATTING', 'HOME', 'ERROR', 'A guest is listed on both sides')],
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Edit result' }, { timeout: 10000 })
    await user.click(step('Review'))

    expect(await screen.findByText('A guest is listed on both sides')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Fix' }))
    expect(await screen.findByText('Who is playing?')).toBeInTheDocument()
  })
})
