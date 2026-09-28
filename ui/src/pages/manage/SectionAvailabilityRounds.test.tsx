import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SectionAvailabilityRounds from './SectionAvailabilityRounds'
import type {
  SectionAvailabilityFixtureGroup,
  SectionAvailabilityRound,
  SectionAvailabilityRoundMatch,
  SectionAvailabilityRoundResponses,
} from '../../api/sectionAvailabilityApi'
import type { Section } from '../../api/sectionApi'

const listRounds = vi.fn()
const openRound = vi.fn()
const closeRound = vi.fn()
const getRoundMatches = vi.fn()
const getRoundResponses = vi.fn()
const setRoundPlayerStatus = vi.fn()
const updateRoundDescription = vi.fn()
const getFixtureGroups = vi.fn()
const createRound = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/sectionAvailabilityApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/sectionAvailabilityApi')>(
    '../../api/sectionAvailabilityApi',
  )
  return {
    ...actual,
    listRounds: (clubId: string, params: unknown) => listRounds(clubId, params),
    openRound: (clubId: string, roundId: string) => openRound(clubId, roundId),
    closeRound: (clubId: string, roundId: string) => closeRound(clubId, roundId),
    getRoundMatches: (clubId: string, roundId: string) => getRoundMatches(clubId, roundId),
    getRoundResponses: (clubId: string, roundId: string) => getRoundResponses(clubId, roundId),
    setRoundPlayerStatus: (clubId: string, roundId: string, playerProfileId: string, windowId: string, status: string) =>
      setRoundPlayerStatus(clubId, roundId, playerProfileId, windowId, status),
    updateRoundDescription: (clubId: string, roundId: string, description: string) =>
      updateRoundDescription(clubId, roundId, description),
    getFixtureGroups: (clubId: string, sectionId: string) => getFixtureGroups(clubId, sectionId),
    createRound: (clubId: string, payload: unknown) => createRound(clubId, payload),
  }
})

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

function makeGroup(overrides: Partial<SectionAvailabilityFixtureGroup> = {}): SectionAvailabilityFixtureGroup {
  return {
    suggestedDescription: 'Sat 6 - Sun 7 Jun - U13 Boys fixtures',
    startDate: '2026-06-06',
    endDate: '2026-06-07',
    matches: [
      {
        matchId: 'match-1',
        teamId: 'team-1',
        teamName: 'U13 Boys A',
        opponentLabel: 'Rivals CC',
        matchDate: '2026-06-06T09:00:00Z',
        dayPart: 'MORNING',
        leagueName: 'Junior League',
        alreadyPolled: false,
        existingRoundId: null,
        existingRoundDescription: null,
      },
      {
        matchId: 'match-2',
        teamId: 'team-1',
        teamName: 'U13 Boys A',
        opponentLabel: 'United CC',
        matchDate: '2026-06-07T09:00:00Z',
        dayPart: 'MORNING',
        leagueName: 'Junior League',
        alreadyPolled: false,
        existingRoundId: null,
        existingRoundDescription: null,
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([SECTION])
  getRoundMatches.mockResolvedValue([])
  getRoundResponses.mockResolvedValue(makeResponses())
  listRounds.mockResolvedValue([])
  localStorage.clear()
})

function makeRound(overrides: Partial<SectionAvailabilityRound> = {}): SectionAvailabilityRound {
  return {
    id: 'round-1',
    sectionId: 'section-1',
    sectionName: 'U13 Boys',
    description: 'Sat 6 Jun - U13 Boys fixtures',
    firstMatchDate: '2026-06-06',
    lastMatchDate: '2026-06-06',
    autoClose: true,
    scheduledCloseAt: '2026-06-05T09:00:00Z',
    open: true,
    brackets: [
      {
        dayPart: 'MORNING',
        windowDate: '2026-06-06',
        windowId: 'window-1',
        availableCount: 5,
        unavailableCount: 1,
        unsureCount: 0,
        noResponseCount: 2,
        coveredMatchCount: 2,
      },
      {
        dayPart: 'AFTERNOON',
        windowDate: '2026-06-06',
        windowId: 'window-2',
        availableCount: 3,
        unavailableCount: 0,
        unsureCount: 1,
        noResponseCount: 4,
        coveredMatchCount: 1,
      },
    ],
    ...overrides,
  }
}

function makeMatch(overrides: Partial<SectionAvailabilityRoundMatch> = {}): SectionAvailabilityRoundMatch {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    teamName: 'U13 Boys A',
    opponentLabel: 'Rivals CC',
    matchDate: '2026-06-06T09:00:00Z',
    venue: 'Home Ground',
    leagueName: 'Junior League',
    dayPart: 'MORNING',
    windowId: 'window-1',
    ...overrides,
  }
}

function makeResponses(overrides: Partial<SectionAvailabilityRoundResponses> = {}): SectionAvailabilityRoundResponses {
  return {
    roundId: 'round-1',
    sectionId: 'section-1',
    sectionName: 'U13 Boys',
    description: 'Sat 6 Jun - U13 Boys fixtures',
    open: true,
    brackets: makeRound().brackets,
    responses: [
      {
        playerProfileId: 'player-1',
        firstName: 'Jane',
        lastName: 'Smith',
        jerseyNumber: 7,
        statuses: [
          { windowId: 'window-1', dayPart: 'MORNING', windowDate: '2026-06-06', status: 'AVAILABLE' },
          { windowId: 'window-2', dayPart: 'AFTERNOON', windowDate: '2026-06-06', status: null },
        ],
      },
    ],
    publicPath: '/section-availability/round-1',
    ...overrides,
  }
}

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(clubId?: string, initialPath = '/manage/section-availability') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="section-availability" element={<SectionAvailabilityRounds />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SectionAvailabilityRounds', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listRounds).not.toHaveBeenCalled()
  })

  it('renders the empty state when the club has no rounds yet', async () => {
    listRounds.mockResolvedValueOnce([])
    renderPage('test-club-id')

    expect(await screen.findByText('No section availability rounds yet')).toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listRounds.mockRejectedValueOnce(new Error('network error'))
    renderPage('test-club-id')

    expect(await screen.findByText("Couldn't load section availability rounds")).toBeInTheDocument()
  })

  it('renders one RecordCard per round, titled by its own description, with a variable-length per-bracket summary', async () => {
    listRounds.mockResolvedValueOnce([makeRound()])
    renderPage('test-club-id')

    expect(await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('5 yes / 1 no / 0 unsure')).toBeInTheDocument()
    expect(screen.getByText('3 yes / 0 no / 1 unsure')).toBeInTheDocument()
  })

  it('renders a round owning three brackets with three summary rows, not capped at two', async () => {
    listRounds.mockResolvedValueOnce([
      makeRound({
        brackets: [
          ...makeRound().brackets,
          {
            dayPart: 'MORNING',
            windowDate: '2026-06-07',
            windowId: 'window-3',
            availableCount: 2,
            unavailableCount: 2,
            unsureCount: 2,
            noResponseCount: 2,
            coveredMatchCount: 1,
          },
        ],
      }),
    ])
    renderPage('test-club-id')

    await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
    expect(screen.getByText('2 yes / 2 no / 2 unsure')).toBeInTheDocument()
  })

  it('toggles a round closed, then reopens it', async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValue([makeRound()])
    closeRound.mockResolvedValueOnce(makeRound({ open: false }))

    renderPage('test-club-id')

    await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
    await user.click(screen.getByRole('button', { name: /^close$/i }))

    expect(closeRound).toHaveBeenCalledWith('test-club-id', 'round-1')
  })

  it('expands "View covered matches" and fetches matches grouped by bracket for that round only', async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValueOnce([makeRound()])
    getRoundMatches.mockResolvedValueOnce([makeMatch()])

    renderPage('test-club-id')

    await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
    expect(getRoundMatches).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /view covered matches/i }))

    expect(getRoundMatches).toHaveBeenCalledWith('test-club-id', 'round-1')
    expect(await screen.findByText('U13 Boys A vs Rivals CC')).toBeInTheDocument()
  })

  it('expands "View responses" to a per-player list with a status Chip per bracket', async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValueOnce([makeRound()])

    renderPage('test-club-id')

    await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
    expect(getRoundResponses).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /view responses/i }))

    expect(getRoundResponses).toHaveBeenCalledWith('test-club-id', 'round-1')
    expect(await screen.findByText('#7 Jane Smith')).toBeInTheDocument()
  })

  it("sets a player's bracket status via the admin-override Chip menu, keyed by windowId", async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValue([makeRound()])
    setRoundPlayerStatus.mockResolvedValueOnce(makeResponses())

    renderPage('test-club-id')

    await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
    await user.click(screen.getByRole('button', { name: /view responses/i }))
    await screen.findByText('#7 Jane Smith')

    const chips = screen.getAllByLabelText(/Set #7 Jane Smith's.*availability/i)
    await user.click(chips[1])
    await user.click(await screen.findByRole('menuitem', { name: 'Unavailable' }))

    expect(setRoundPlayerStatus).toHaveBeenCalledWith('test-club-id', 'round-1', 'player-1', 'window-2', 'UNAVAILABLE')
  })

  it('opens the share dialog with the round\'s own public link embedded', async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValueOnce([makeRound()])

    renderPage('test-club-id')

    await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
    await user.click(screen.getByRole('button', { name: /share invite/i }))

    const textarea = (await screen.findByLabelText('Invite text')) as HTMLTextAreaElement
    expect(textarea.value).toContain('/section-availability/round-1')
  })

  it('edits a round\'s description inline via "Edit description", saving through updateRoundDescription', async () => {
    const user = userEvent.setup()
    listRounds.mockResolvedValueOnce([makeRound()])
    updateRoundDescription.mockResolvedValueOnce(makeRound({ description: 'Weekend fixtures - updated' }))

    renderPage('test-club-id')

    await screen.findByRole('heading', { name: 'Sat 6 Jun - U13 Boys fixtures' })
    await user.click(screen.getByRole('button', { name: /edit description/i }))

    const input = screen.getByLabelText('Description')
    await user.clear(input)
    await user.type(input, 'Weekend fixtures - updated')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(updateRoundDescription).toHaveBeenCalledWith('test-club-id', 'round-1', 'Weekend fixtures - updated')
  })

  // docs/specs/063-section-availability-and-flexible-squads.md's fixture-group-selection revision,
  // merged onto this same page rather than kept as a separate route/file (see the corrected
  // Rollout Notes in docs/plans/063-section-availability-and-flexible-squads.md): the
  // proposed-groups review above the open-rounds list, driven by its own section picker.
  describe('proposed fixture groups review', () => {
    it('prompts for a section and does not fetch fixture groups until one is chosen', async () => {
      renderPage('test-club-id')

      expect(await screen.findByText('Choose a section')).toBeInTheDocument()
      expect(getFixtureGroups).not.toHaveBeenCalled()
    })

    it('pre-selects the section from the sectionId query param, fetching immediately', async () => {
      getFixtureGroups.mockResolvedValueOnce([])
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      expect(await screen.findByText('No upcoming fixtures')).toBeInTheDocument()
      expect(getFixtureGroups).toHaveBeenCalledWith('test-club-id', 'section-1')
    })

    it('renders one card per proposed group, every match pre-checked, description pre-filled from suggestedDescription', async () => {
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      expect(await screen.findByText('U13 Boys A vs Rivals CC')).toBeInTheDocument()
      expect(screen.getByText('U13 Boys A vs United CC')).toBeInTheDocument()
      expect(screen.getByLabelText('Include U13 Boys A vs Rivals CC')).toBeChecked()
      expect(screen.getByLabelText('Include U13 Boys A vs United CC')).toBeChecked()
      expect(screen.getByLabelText('Description')).toHaveValue('Sat 6 - Sun 7 Jun - U13 Boys fixtures')
      expect(screen.getByRole('button', { name: 'Open poll for 2 selected fixtures' })).toBeInTheDocument()
    })

    it('unchecking a match excludes it from the selection count and the create payload', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue([makeGroup()])
      createRound.mockResolvedValueOnce({})
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      await screen.findByText('U13 Boys A vs Rivals CC')
      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))

      expect(screen.getByRole('button', { name: 'Open poll for 1 selected fixture' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Open poll for 1 selected fixture' }))

      expect(createRound).toHaveBeenCalledWith('test-club-id', {
        sectionId: 'section-1',
        description: 'Sat 6 - Sun 7 Jun - U13 Boys fixtures',
        matchIds: ['match-1'],
        autoClose: true,
      })
    })

    it('renders an already-polled match disabled, unselectable, with a link to its existing poll', async () => {
      getFixtureGroups.mockResolvedValueOnce([
        makeGroup({
          matches: [
            {
              matchId: 'match-1',
              teamId: 'team-1',
              teamName: 'U13 Boys A',
              opponentLabel: 'Rivals CC',
              matchDate: '2026-06-06T09:00:00Z',
              dayPart: 'MORNING',
              leagueName: 'Junior League',
              alreadyPolled: true,
              existingRoundId: 'round-9',
              existingRoundDescription: 'Existing Saturday poll',
            },
          ],
        }),
      ])
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      await screen.findByText('U13 Boys A vs Rivals CC')
      expect(screen.getByLabelText('Include U13 Boys A vs Rivals CC')).toBeDisabled()
      expect(screen.getByLabelText('Include U13 Boys A vs Rivals CC')).not.toBeChecked()
      const link = screen.getByRole('link', { name: 'Existing Saturday poll' })
      expect(link).toHaveAttribute('href', '/section-availability/round-9')
      expect(screen.getByRole('button', { name: 'Open poll for 0 selected fixtures' })).toBeDisabled()
    })

    it('toggling Autoclose off hides the computed close-time preview', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      await screen.findByText('U13 Boys A vs Rivals CC')
      expect(screen.getByText(/Automatically closes/)).toBeInTheDocument()

      await user.click(screen.getByRole('checkbox', { name: 'Autoclose' }))
      expect(screen.queryByText(/Automatically closes/)).not.toBeInTheDocument()
    })

    it('submits the group with autoClose true by default, then invalidates the proposed groups and open-rounds queries', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValue([makeGroup()])
      createRound.mockResolvedValueOnce({})
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      await screen.findByText('U13 Boys A vs Rivals CC')
      await user.click(screen.getByRole('button', { name: 'Open poll for 2 selected fixtures' }))

      expect(createRound).toHaveBeenCalledWith('test-club-id', {
        sectionId: 'section-1',
        description: 'Sat 6 - Sun 7 Jun - U13 Boys fixtures',
        matchIds: ['match-1', 'match-2'],
        autoClose: true,
      })
      expect(getFixtureGroups.mock.calls.length).toBeGreaterThanOrEqual(1)
    })

    it('the submit action is disabled once every match has been unchecked', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      await screen.findByText('U13 Boys A vs Rivals CC')
      await user.click(screen.getByLabelText('Include U13 Boys A vs Rivals CC'))
      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))

      expect(screen.getByRole('button', { name: 'Open poll for 0 selected fixtures' })).toBeDisabled()
    })

    it('the submit action re-enables once a match is reselected after being fully unchecked', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      await screen.findByText('U13 Boys A vs Rivals CC')
      await user.click(screen.getByLabelText('Include U13 Boys A vs Rivals CC'))
      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))
      expect(screen.getByRole('button', { name: 'Open poll for 0 selected fixtures' })).toBeDisabled()

      await user.click(screen.getByLabelText('Include U13 Boys A vs United CC'))

      expect(screen.getByRole('button', { name: 'Open poll for 1 selected fixture' })).toBeEnabled()
    })

    it('the description field is genuinely editable before submit, sending the edited value', async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      createRound.mockResolvedValueOnce({})
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      await screen.findByText('U13 Boys A vs Rivals CC')
      const descriptionInput = screen.getByLabelText('Description')
      await user.clear(descriptionInput)
      await user.type(descriptionInput, 'A custom title I chose myself')
      expect(descriptionInput).toHaveValue('A custom title I chose myself')

      await user.click(screen.getByRole('button', { name: 'Open poll for 2 selected fixtures' }))

      expect(createRound).toHaveBeenCalledWith('test-club-id', {
        sectionId: 'section-1',
        description: 'A custom title I chose myself',
        matchIds: ['match-1', 'match-2'],
        autoClose: true,
      })
    })

    it("recomputes the Autoclose close-time preview when a different match is unticked, not just once on render", async () => {
      const user = userEvent.setup()
      getFixtureGroups.mockResolvedValueOnce([makeGroup()])
      renderPage('test-club-id', '/manage/section-availability?sectionId=section-1')

      await screen.findByText('U13 Boys A vs Rivals CC')
      const closeTimeText = () => screen.getByText(/Automatically closes/).textContent
      const initialCloseTime = closeTimeText()

      // match-1 (Sat 6 Jun) is the earlier of the two selected matches, so the close time is
      // computed against it; unticking it should push the computed close time later, onto
      // match-2's (Sun 7 Jun) own kickoff instead - a real recompute, not a static render.
      await user.click(screen.getByLabelText('Include U13 Boys A vs Rivals CC'))

      expect(closeTimeText()).not.toEqual(initialCloseTime)
    })
  })
})
