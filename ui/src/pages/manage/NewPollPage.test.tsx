import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NewPollPage from './NewPollPage'
import type { SectionAvailabilityFixtureGroup, SectionAvailabilityFixtureMatch } from '../../api/sectionAvailabilityApi'
import type { Section } from '../../api/sectionApi'
import type { Team } from '../../api/teamApi'
import { toDatetimeLocal } from '../../utils/datetimeLocal'

const getFixtureGroups = vi.fn()
const createRound = vi.fn()
const createPoll = vi.fn()
const listTeamsForClub = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/sectionAvailabilityApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/sectionAvailabilityApi')>(
    '../../api/sectionAvailabilityApi',
  )
  return {
    ...actual,
    getFixtureGroups: (clubId: string, sectionId: string) => getFixtureGroups(clubId, sectionId),
    createRound: (clubId: string, payload: unknown) => createRound(clubId, payload),
  }
})

vi.mock('../../api/matchAvailabilityApi', () => ({
  createPoll: (clubId: string, matchId: string, teamId: string, autoClose?: boolean, scheduledCloseAt?: string) =>
    createPoll(clubId, matchId, teamId, autoClose, scheduledCloseAt),
}))

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

const SECTION: Section = {
  id: 'section-1',
  clubId: 'test-club-id',
  parentSectionId: null,
  name: 'U13 Boys',
  minAge: null,
  maxAge: null,
  gender: null,
  active: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'test-club-id',
    sectionId: 'section-1',
    name: 'U13 Boys A',
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeMatch(overrides: Partial<SectionAvailabilityFixtureMatch> = {}): SectionAvailabilityFixtureMatch {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    teamName: 'U13 Boys A',
    opponentLabel: 'Rivals CC',
    matchDate: '2030-06-06T09:00:00Z',
    dayPart: 'MORNING',
    leagueName: 'Junior League',
    alreadyPolled: false,
    existingPollType: null,
    existingPollId: null,
    existingPollLabel: null,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<SectionAvailabilityFixtureGroup> = {}): SectionAvailabilityFixtureGroup {
  return {
    suggestedDescription: 'Sat 6 - Sun 7 Jun - U13 Boys fixtures',
    startDate: '2026-06-06',
    endDate: '2026-06-07',
    matches: [
      makeMatch(),
      makeMatch({ matchId: 'match-2', opponentLabel: 'United CC', matchDate: '2030-06-07T09:00:00Z' }),
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([SECTION])
  listTeamsForClub.mockResolvedValue([makeTeam(), makeTeam({ id: 'team-2', name: 'U13 Boys B' })])
})

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath = '/manage/availability/new', clubId: string | undefined = 'test-club-id') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="availability" element={<div>Polls Dashboard</div>} />
            <Route path="availability/new" element={<NewPollPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function conflictError(message: string) {
  return new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 409,
    statusText: 'Conflict',
    data: { detail: message },
    headers: {},
    config: {} as never,
  })
}

describe('NewPollPage', () => {
  it('renders "Not authorized" when no clubId is in the Outlet context', () => {
    renderPage('/manage/availability/new', '')

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
  })

  describe('chooser', () => {
    it('shows two choice cards with their bullets, Continue disabled until one is chosen', async () => {
      const user = userEvent.setup()
      renderPage()

      expect(screen.getByRole('radio', { name: /Squad poll/ })).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByText("Ask one team's roster about one match.")).toBeInTheDocument()
      expect(screen.getByText('Ask a whole section about several fixtures at once.')).toBeInTheDocument()
      expect(screen.getByText('One link covers all of them')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

      await user.click(screen.getByRole('radio', { name: /Group poll/ }))

      expect(screen.getByRole('radio', { name: /Group poll/ })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    })

    it('Continue routes to the Squad branch', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('radio', { name: /Squad poll/ }))
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByLabelText('Team')).toBeInTheDocument()
      expect(screen.getByText('Choose a team')).toBeInTheDocument()
    })

    it('Continue routes to the Group branch, and "Change poll type" returns to the chooser', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.click(screen.getByRole('radio', { name: /Group poll/ }))
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByText('Choose a section')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Change poll type' }))
      expect(screen.getByRole('radio', { name: /Squad poll/ })).toBeInTheDocument()
    })

    it('?type=squad skips the chooser', async () => {
      renderPage('/manage/availability/new?type=squad')

      expect(await screen.findByLabelText('Team')).toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: /Squad poll/ })).not.toBeInTheDocument()
    })
  })

  describe('squad branch', () => {
    async function pickTeam(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByLabelText('Team'))
      await user.click(await screen.findByRole('option', { name: 'U13 Boys A' }))
    }

    function squadGroups() {
      return [
        makeGroup({
          matches: [
            makeMatch(),
            makeMatch({ matchId: 'match-2', opponentLabel: 'United CC', matchDate: '2030-06-07T09:00:00Z' }),
            makeMatch({
              matchId: 'match-3',
              opponentLabel: 'Covered CC',
              matchDate: '2026-06-13T09:00:00Z',
              alreadyPolled: true,
              existingPollType: 'SQUAD',
              existingPollId: 'poll-9',
              existingPollLabel: 'U13 Boys A v Covered CC',
            }),
            // another team of the same section - never listed for team-1
            makeMatch({ matchId: 'match-4', teamId: 'team-2', teamName: 'U13 Boys B', opponentLabel: 'Other CC' }),
          ],
        }),
      ]
    }

    it("lists only the chosen team's upcoming matches (via the team's section fixture groups), all ticked, each with its own close time", async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)

      expect(await screen.findByLabelText('Include U13 Boys A vs Rivals CC')).toBeChecked()
      expect(screen.getByLabelText('Include U13 Boys A vs United CC')).toBeChecked()
      expect(screen.queryByText('U13 Boys B vs Other CC')).not.toBeInTheDocument()
      expect(getFixtureGroups).toHaveBeenCalledWith('test-club-id', 'section-1')
      // docs/specs/066: each ticked row has its own editable 'Closes at', defaulting to kickoff - 24h.
      expect(screen.getByLabelText('Closes at for U13 Boys A vs Rivals CC')).toHaveValue(
        toDatetimeLocal('2030-06-05T09:00:00.000Z'),
      )
      expect(screen.getByLabelText('Closes at for U13 Boys A vs United CC')).toHaveValue(
        toDatetimeLocal('2030-06-06T09:00:00.000Z'),
      )
      expect(screen.getByRole('button', { name: 'Open 2 polls' })).toBeEnabled()
    })

    it('renders a covered match disabled with a link to the covering squad poll', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)

      const checkbox = await screen.findByLabelText('Include U13 Boys A vs Covered CC')
      expect(checkbox).toBeDisabled()
      expect(checkbox).not.toBeChecked()
      expect(screen.getByRole('link', { name: 'U13 Boys A v Covered CC' })).toHaveAttribute(
        'href',
        '/manage/availability/squad/match-3/poll-9',
      )
    })

    it('Open N polls issues one createPoll per ticked match with autoClose true, then returns to the dashboard', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      createPoll.mockResolvedValue({})
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)
      await user.click(await screen.findByRole('button', { name: 'Open 2 polls' }))

      await waitFor(() => expect(createPoll).toHaveBeenCalledTimes(2))
      expect(createPoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1', true, '2030-06-05T09:00:00.000Z')
      expect(createPoll).toHaveBeenCalledWith('test-club-id', 'match-2', 'team-1', true, '2030-06-06T09:00:00.000Z')
      expect(await screen.findByText('Polls Dashboard')).toBeInTheDocument()
    })

    it('unticking a match drops it from the count and the calls; zero ticked disables the button', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      createPoll.mockResolvedValue({})
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)
      await user.click(await screen.findByLabelText('Include U13 Boys A vs United CC'))
      expect(screen.getByRole('button', { name: 'Open 1 poll' })).toBeEnabled()

      await user.click(screen.getByLabelText('Include U13 Boys A vs Rivals CC'))
      expect(screen.getByRole('button', { name: 'Open 0 polls' })).toBeDisabled()

      await user.click(screen.getByLabelText('Include U13 Boys A vs Rivals CC'))
      await user.click(screen.getByRole('button', { name: 'Open 1 poll' }))

      await waitFor(() => expect(createPoll).toHaveBeenCalledTimes(1))
      expect(createPoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1', true, '2030-06-05T09:00:00.000Z')
    })

    it('Autoclose switch (default on, with the helper text) sends autoClose false when turned off and hides the close times', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      createPoll.mockResolvedValue({})
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)
      await screen.findByLabelText('Include U13 Boys A vs Rivals CC')
      expect(screen.getByRole('checkbox', { name: 'Autoclose' })).toBeChecked()
      expect(
        screen.getByText(/Each poll closes by itself at the time shown/),
      ).toBeInTheDocument()

      await user.click(screen.getByRole('checkbox', { name: 'Autoclose' }))
      expect(screen.queryByLabelText(/^Closes at for/)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Open 2 polls' }))

      await waitFor(() => expect(createPoll).toHaveBeenCalledTimes(2))
      expect(createPoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1', false, undefined)
    })

    it('sends an edited per-match close time and blocks a close time after that match starts', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      createPoll.mockResolvedValue({})
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)
      const field = await screen.findByLabelText('Closes at for U13 Boys A vs Rivals CC')
      fireEvent.change(field, { target: { value: toDatetimeLocal('2030-06-07T09:00:00.000Z') } })
      expect(await screen.findByText('Choose a closing time before the first match starts.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open 2 polls' })).toBeDisabled()

      fireEvent.change(field, { target: { value: toDatetimeLocal('2030-06-05T20:00:00.000Z') } })
      await user.click(screen.getByRole('button', { name: 'Open 2 polls' }))

      await waitFor(() => expect(createPoll).toHaveBeenCalledTimes(2))
      expect(createPoll).toHaveBeenCalledWith('test-club-id', 'match-1', 'team-1', true, '2030-06-05T20:00:00.000Z')
      expect(createPoll).toHaveBeenCalledWith('test-club-id', 'match-2', 'team-1', true, '2030-06-06T09:00:00.000Z')
    })

    it('surfaces a 409 from createPoll inline and stays on the page', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      createPoll
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(conflictError('This match is already covered by the group poll "Weekend".'))
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)
      await user.click(await screen.findByRole('button', { name: 'Open 2 polls' }))

      expect(await screen.findByText(/already covered by the group poll "Weekend"/)).toBeInTheDocument()
      expect(screen.queryByText('Polls Dashboard')).not.toBeInTheDocument()
    })

    it('a partial failure lists every failed match with its server message, keeps the page, and does not leave', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      createPoll.mockImplementation((_clubId: string, matchId: string) =>
        matchId === 'match-1'
          ? Promise.resolve({})
          : Promise.reject(conflictError('This match is already covered by the group poll "Weekend".')),
      )
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)
      await user.click(await screen.findByRole('button', { name: 'Open 2 polls' }))

      expect(
        await screen.findByText('U13 Boys A vs United CC: This match is already covered by the group poll "Weekend".'),
      ).toBeInTheDocument()
      expect(screen.queryByText(/U13 Boys A vs Rivals CC:/)).not.toBeInTheDocument()
      expect(screen.queryByText('Polls Dashboard')).not.toBeInTheDocument()
    })

    it('a generic failure is listed against its match using the fallback message', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue(squadGroups())
      createPoll.mockRejectedValue(new Error('boom'))
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)
      await user.click(await screen.findByRole('button', { name: 'Open 2 polls' }))

      expect(await screen.findByText(/U13 Boys A vs Rivals CC: /)).toBeInTheDocument()
      expect(screen.getByText(/U13 Boys A vs United CC: /)).toBeInTheDocument()
    })

    it('renders a match covered by a GROUP poll disabled, linking to the polls list', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue([
        makeGroup({
          matches: [
            makeMatch({
              alreadyPolled: true,
              existingPollType: 'GROUP',
              existingPollId: 'round-9',
              existingPollLabel: 'Existing Saturday poll',
            }),
          ],
        }),
      ])
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)

      expect(await screen.findByLabelText('Include U13 Boys A vs Rivals CC')).toBeDisabled()
      expect(screen.getByRole('link', { name: 'Existing Saturday poll' })).toHaveAttribute('href', '/manage/availability/group/round-9')
      expect(screen.getByRole('button', { name: 'Open 0 polls' })).toBeDisabled()
    })

    it('shows an empty state when the team has no upcoming matches', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue([])
      renderPage('/manage/availability/new?type=squad')

      await pickTeam(user)

      expect(await screen.findByText('No upcoming matches')).toBeInTheDocument()
    })
  })

  // Migrated from the deleted SectionAvailabilityRounds.test.tsx's "proposed fixture groups review"
  // (docs/specs/063), now the Group branch of this page.
  describe('group branch (063 fixture-group review)', () => {
    const GROUP_PATH = '/manage/availability/new?type=group&sectionId=section-1'

    it('prompts for a section and does not fetch fixture groups until one is chosen', async () => {
      renderPage('/manage/availability/new?type=group')

      expect(await screen.findByText('Choose a section')).toBeInTheDocument()
      expect(getFixtureGroups).not.toHaveBeenCalled()
    })

    it('pre-selects the section from the sectionId query param, fetching immediately', async () => {
      getFixtureGroups.mockResolvedValueOnce([])
      renderPage(GROUP_PATH)

      expect(await screen.findByText('No upcoming fixtures')).toBeInTheDocument()
      expect(getFixtureGroups).toHaveBeenCalledWith('test-club-id', 'section-1')
    })

    it('renders one card per proposed group, every match pre-checked, description pre-filled', async () => {
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage(GROUP_PATH)

      expect(await screen.findByText('U13 Boys A vs Rivals CC')).toBeInTheDocument()
      expect(screen.getByLabelText('Include U13 Boys A vs Rivals CC')).toBeChecked()
      expect(screen.getByLabelText('Include U13 Boys A vs United CC')).toBeChecked()
      expect(screen.getByLabelText('Description')).toHaveValue('Sat 6 - Sun 7 Jun - U13 Boys fixtures')
      expect(screen.getByRole('button', { name: 'Open poll for 2 selected fixtures' })).toBeInTheDocument()
    })

    it('unchecking a match excludes it from the count and the create payload, then returns to the dashboard on success', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue([makeGroup()])
      createRound.mockResolvedValueOnce({})
      renderPage(GROUP_PATH)

      await screen.findByText('U13 Boys A vs Rivals CC')
      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))
      await user.click(screen.getByRole('button', { name: 'Open poll for 1 selected fixture' }))

      await waitFor(() =>
        expect(createRound).toHaveBeenCalledWith('test-club-id', {
          sectionId: 'section-1',
          description: 'Sat 6 - Sun 7 Jun - U13 Boys fixtures',
          matchIds: ['match-1'],
          autoClose: true,
          // Unticking match-2 moves the default to match-1's own kickoff - 24h.
          scheduledCloseAt: '2030-06-05T09:00:00.000Z',
        }),
      )
      expect(await screen.findByText('Polls Dashboard')).toBeInTheDocument()
    })

    it('renders a match covered by a GROUP poll disabled, linking to the polls list with the poll label', async () => {
      getFixtureGroups.mockResolvedValueOnce([
        makeGroup({
          matches: [
            makeMatch({
              alreadyPolled: true,
              existingPollType: 'GROUP',
              existingPollId: 'round-9',
              existingPollLabel: 'Existing Saturday poll',
            }),
          ],
        }),
      ])
      renderPage(GROUP_PATH)

      await screen.findByText('U13 Boys A vs Rivals CC')
      expect(screen.getByLabelText('Include U13 Boys A vs Rivals CC')).toBeDisabled()
      expect(screen.getByLabelText('Include U13 Boys A vs Rivals CC')).not.toBeChecked()
      expect(screen.getByRole('link', { name: 'Existing Saturday poll' })).toHaveAttribute('href', '/manage/availability/group/round-9')
      // docs/specs/085: a group whose fixtures are all covered has nothing to open: no editable fields, no red error and
      // no disabled "0 selected" action, just a note.
      expect(screen.getByText('Every fixture here is already in a poll.')).toBeInTheDocument()
      expect(screen.queryByLabelText('Description')).toBeNull()
      expect(screen.queryByLabelText('Autoclose')).toBeNull()
      expect(screen.queryByLabelText('Closes at')).toBeNull()
      expect(screen.queryByText(/A closing time is required/)).toBeNull()
      expect(screen.queryByRole('button', { name: /Open poll for/ })).toBeNull()
    })

    it("renders a match covered by a SQUAD poll disabled, linking to that match's Availability tab", async () => {
      getFixtureGroups.mockResolvedValueOnce([
        makeGroup({
          matches: [
            makeMatch({
              alreadyPolled: true,
              existingPollType: 'SQUAD',
              existingPollId: 'poll-3',
              existingPollLabel: 'U13 Boys A v Rivals CC',
            }),
          ],
        }),
      ])
      renderPage(GROUP_PATH)

      await screen.findByText('U13 Boys A vs Rivals CC')
      expect(screen.getByRole('link', { name: 'U13 Boys A v Rivals CC' })).toHaveAttribute(
        'href',
        '/manage/availability/squad/match-1/poll-3',
      )
    })

    it('toggling Autoclose off hides the Closes at field and sends no close time', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      createRound.mockResolvedValueOnce({})
      renderPage(GROUP_PATH)

      await screen.findByText('U13 Boys A vs Rivals CC')
      expect(screen.getByLabelText('Closes at')).toBeInTheDocument()

      await user.click(screen.getByRole('checkbox', { name: 'Autoclose' }))
      expect(screen.queryByLabelText('Closes at')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Open poll for 2 selected fixtures' }))
      await waitFor(() => expect(createRound).toHaveBeenCalledTimes(1))
      expect(createRound.mock.calls[0][1]).toEqual({
        sectionId: 'section-1',
        description: 'Sat 6 - Sun 7 Jun - U13 Boys fixtures',
        matchIds: ['match-1', 'match-2'],
        autoClose: false,
      })
    })

    it('defaults Closes at to 24 hours before the earliest ticked match and recomputes it when ticks change', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage(GROUP_PATH)

      await screen.findByText('U13 Boys A vs Rivals CC')
      expect(screen.getByLabelText('Closes at')).toHaveValue(toDatetimeLocal('2030-06-05T09:00:00.000Z'))

      await user.click(screen.getByLabelText('Include U13 Boys A vs Rivals CC'))
      expect(screen.getByLabelText('Closes at')).toHaveValue(toDatetimeLocal('2030-06-06T09:00:00.000Z'))
    })

    it('keeps an edited close time when ticks change, sends it, and rejects one in the past', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      createRound.mockResolvedValueOnce({})
      renderPage(GROUP_PATH)

      await screen.findByText('U13 Boys A vs Rivals CC')
      const field = screen.getByLabelText('Closes at')
      fireEvent.change(field, { target: { value: '2020-01-01T09:00' } })
      expect(await screen.findByText('Choose a closing time in the future.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open poll for 2 selected fixtures' })).toBeDisabled()

      fireEvent.change(field, { target: { value: toDatetimeLocal('2030-06-05T18:00:00.000Z') } })
      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))
      expect(field).toHaveValue(toDatetimeLocal('2030-06-05T18:00:00.000Z'))

      await user.click(screen.getByRole('button', { name: 'Open poll for 1 selected fixture' }))
      await waitFor(() =>
        expect(createRound).toHaveBeenCalledWith(
          'test-club-id',
          expect.objectContaining({ scheduledCloseAt: '2030-06-05T18:00:00.000Z' }),
        ),
      )
    })

    it('the submit action is disabled once every match is unchecked, re-enabling on reselect', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage(GROUP_PATH)

      await screen.findByText('U13 Boys A vs Rivals CC')
      await user.click(screen.getByLabelText('Include U13 Boys A vs Rivals CC'))
      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))
      expect(screen.getByRole('button', { name: 'Open poll for 0 selected fixtures' })).toBeDisabled()

      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))
      expect(screen.getByRole('button', { name: 'Open poll for 1 selected fixture' })).toBeEnabled()
    })

    it('sends the edited description and shows a 409 from createRound inline', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      createRound.mockRejectedValueOnce(conflictError('Match is already covered by the squad poll "X v Y".'))
      renderPage(GROUP_PATH)

      await screen.findByText('U13 Boys A vs Rivals CC')
      const input = screen.getByLabelText('Description')
      await user.clear(input)
      await user.type(input, 'A custom title')
      await user.click(screen.getByRole('button', { name: 'Open poll for 2 selected fixtures' }))

      expect(await screen.findByText(/already covered by the squad poll/)).toBeInTheDocument()
      expect(createRound).toHaveBeenCalledWith(
        'test-club-id',
        expect.objectContaining({ description: 'A custom title', matchIds: ['match-1', 'match-2'] }),
      )
    })

    it('outlines the group containing ?matchId= and ticks it', async () => {
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage(`${GROUP_PATH}&matchId=match-2`)

      expect(await screen.findByLabelText('Include U13 Boys A vs United CC')).toBeChecked()
    })

    it('scrolls the outlined group into view when arriving from an Open a poll link (085)', async () => {
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage(`${GROUP_PATH}&matchId=match-2`)

      await screen.findByLabelText('Include U13 Boys A vs United CC')
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    })

    it('does not scroll when no group is outlined (085)', async () => {
      const scrollIntoView = vi.fn()
      Element.prototype.scrollIntoView = scrollIntoView
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage(GROUP_PATH)

      await screen.findByLabelText('Include U13 Boys A vs United CC')
      expect(scrollIntoView).not.toHaveBeenCalled()
    })

    it('shows no closing-time error when every fixture is unticked (085)', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage(GROUP_PATH)

      await user.click(await screen.findByLabelText('Include U13 Boys A vs Rivals CC'))
      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))
      expect(screen.queryByText(/A closing time is required/)).toBeNull()
      expect(screen.getByRole('button', { name: 'Open poll for 0 selected fixtures' })).toBeDisabled()
    })
  })
})
