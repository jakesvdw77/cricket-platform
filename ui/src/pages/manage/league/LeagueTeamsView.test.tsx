import { screen, waitFor, within } from '@testing-library/react'
import { AxiosError } from 'axios'
import type { AxiosResponse } from 'axios'
import userEvent from '@testing-library/user-event'
import { TOOLBAR_CONTROL_HEIGHT, TOOLBAR_CONTROL_RADIUS } from '../../../components/ToolbarCard/toolbarControlSx'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  emptyPage,
  makeAffiliation,
  makeLeague,
  makeLeagueTeam,
  makeSeason,
  makeTeam,
  renderLeagueView,
} from './leagueViewTestUtils'

// The API modules are mocked at module level; matchApi stays real so listAllMatches' paging is
// genuinely exercised, with only the HTTP layer stubbed (page requests go to mocks.listMatches).
const mocks = vi.hoisted(() => ({
  listLeagues: vi.fn(),
  listSeasons: vi.fn(),
  listTeamsForClub: vi.fn(),
  listLeagueAffiliations: vi.fn(),
  listLeagueContacts: vi.fn(),
  listLeagueTeams: vi.fn(),
  getPlayingConditions: vi.fn(),
  listMatches: vi.fn(),
  createLeagueAffiliation: vi.fn(),
  createLeagueTeam: vi.fn(),
  unaffiliateLeagueTeam: vi.fn(),
  deactivateLeagueTeam: vi.fn(),
  removeLeagueTeam: vi.fn(),
}))

vi.mock('../../../api/leagueApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueApi')>()),
  listLeagues: (clubId: string, params?: unknown) => mocks.listLeagues(clubId, params),
}))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: (clubId: string) => mocks.listSeasons(clubId) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: (clubId: string) => mocks.listTeamsForClub(clubId) }))
vi.mock('../../../api/leagueAffiliationApi', () => ({
  listLeagueAffiliations: (clubId: string, leagueId: string) => mocks.listLeagueAffiliations(clubId, leagueId),
  createLeagueAffiliation: (...args: unknown[]) => mocks.createLeagueAffiliation(...args),
  unaffiliateLeagueTeam: (...args: unknown[]) => mocks.unaffiliateLeagueTeam(...args),
}))
vi.mock('../../../api/leagueContactApi', () => ({
  listLeagueContacts: (clubId: string, leagueId: string) => mocks.listLeagueContacts(clubId, leagueId),
}))
vi.mock('../../../api/leagueTeamApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueTeamApi')>()),
  listLeagueTeams: (...args: unknown[]) => mocks.listLeagueTeams(...args),
  createLeagueTeam: (...args: unknown[]) => mocks.createLeagueTeam(...args),
  deactivateLeagueTeam: (...args: unknown[]) => mocks.deactivateLeagueTeam(...args),
  removeLeagueTeam: (...args: unknown[]) => mocks.removeLeagueTeam(...args),
}))
vi.mock('../../../api/leaguePlayingConditionsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leaguePlayingConditionsApi')>()),
  getPlayingConditions: (clubId: string, leagueId: string, seasonId: string) =>
    mocks.getPlayingConditions(clubId, leagueId, seasonId),
}))
vi.mock('../../../api/axiosConfig', () => ({
  default: {
    get: async (url: string, config: { params: unknown }) => ({
      data: await mocks.listMatches(url.split('/')[3], config.params),
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listSeasons.mockResolvedValue([])
  mocks.listTeamsForClub.mockResolvedValue([])
  mocks.listLeagueAffiliations.mockResolvedValue([])
  mocks.listLeagueContacts.mockResolvedValue([])
  mocks.listLeagueTeams.mockResolvedValue([])
  mocks.getPlayingConditions.mockResolvedValue(null)
  mocks.listMatches.mockResolvedValue(emptyPage())
})

const TEAMS_PATH = '/manage/fixtures/leagues/league-1/teams'

// docs/specs/127-return-navigation.md: the origin and label carried in an href.
function returnOf(href: string | null) {
  const params = new URLSearchParams((href ?? '').split('?')[1])
  return { to: params.get('returnTo'), label: params.get('returnLabel') }
}

describe('LeagueTeamsView', () => {
  beforeEach(() => {
    mocks.listLeagues.mockResolvedValue([makeLeague()])
    mocks.listSeasons.mockResolvedValue([makeSeason()])
    // Honour activeOnly the way the endpoint does, so a test can prove inactive teams never show.
    mocks.listLeagueTeams.mockImplementation(
      async (_clubId: string, _leagueId: string, _seasonId: string, options?: { activeOnly?: boolean }) =>
        [
          makeLeagueTeam({ id: 'lt-active', name: 'Riverside Occasionals' }),
          makeLeagueTeam({ id: 'lt-inactive', name: 'Dormant CC', active: false }),
        ].filter((team) => !options?.activeOnly || team.active),
    )
  })

  it('puts the search and the scope toggle in a standalone toolbar card above the two panels', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    renderLeagueView(TEAMS_PATH)

    const own = await screen.findByTestId('league-teams-own')
    const toolbar = screen.getByTestId('toolbar-card')
    expect(toolbar).toContainElement(screen.getByLabelText('Search'))
    expect(toolbar).toContainElement(screen.getByRole('group', { name: 'Teams to show' }))
    expect(toolbar.compareDocumentPosition(own) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the toolbar controls (search and the scope toggle) share the 36 px toolbar helper', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])
    renderLeagueView(TEAMS_PATH)
    await screen.findByTestId('league-teams-own')

    const toolbar = screen.getByTestId('toolbar-card')
    const fields = Array.from(toolbar.querySelectorAll('.MuiOutlinedInput-root'))
    expect(fields.length).toBeGreaterThan(0)
    for (const field of fields) expect(getComputedStyle(field).height).toBe(`${TOOLBAR_CONTROL_HEIGHT}px`)
    const controls = [...Array.from(toolbar.querySelectorAll('[role="group"]')), ...Array.from(toolbar.querySelectorAll('button[aria-haspopup="menu"], button[aria-pressed]:not(.MuiToggleButton-root)'))]
    expect(controls.length).toBeGreaterThan(0)
    for (const control of controls) {
      const style = getComputedStyle(control)
      expect(style.height).toBe(`${TOOLBAR_CONTROL_HEIGHT}px`)
      expect(style.borderRadius).toBe(TOOLBAR_CONTROL_RADIUS)
    }
  })

  it('keeps the same standalone toolbar (and the search focus) when the panels empty out', async () => {
    const user = userEvent.setup()
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])
    renderLeagueView(TEAMS_PATH)
    await screen.findByTestId('league-teams-own')

    const input = screen.getByLabelText('Search')
    const toolbar = screen.getByTestId('toolbar-card')
    await user.type(input, 'zzz')

    expect(await screen.findAllByText('No teams match your search.')).not.toHaveLength(0)
    expect(screen.getByTestId('toolbar-card')).toBe(toolbar)
    expect(screen.getByLabelText('Search')).toBe(input)
    expect(document.activeElement).toBe(input)
  })

  it('lists the season\'s own teams under "Our teams", each linking to the team\'s detail page', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByRole('heading', { name: 'Our teams · 1' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '1st XI' })).toHaveAttribute(
      'href',
      expect.stringContaining('/manage/sections/section-1/teams/team-1'),
    )
  })

  it('lists active league teams under "League teams" with no link, and never an inactive one', async () => {
    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByRole('heading', { name: 'League teams · 1' })).toBeInTheDocument()
    expect(await screen.findByText('Riverside Occasionals')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Riverside Occasionals' })).not.toBeInTheDocument()
    expect(screen.queryByText('Dormant CC')).not.toBeInTheDocument()
    expect(mocks.listLeagueTeams).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', { activeOnly: true })
  })

  it('renders both cards, own teams first and equal height, with a note in the one that has no entries', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    const { unmount } = renderLeagueView(TEAMS_PATH)
    const own = await screen.findByTestId('league-teams-own')
    const league = await screen.findByTestId('league-teams-league')
    expect(own.compareDocumentPosition(league) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The two cards fill their grid row, so they are the same height.
    expect(getComputedStyle(own.parentElement as HTMLElement).alignItems).toBe('stretch')
    expect(getComputedStyle(own).height).toBe('100%')
    expect(getComputedStyle(league).height).toBe('100%')
    unmount()

    // Only league teams: the own card says so.
    mocks.listLeagueAffiliations.mockResolvedValue([])
    const second = renderLeagueView(TEAMS_PATH)
    expect(await within(await screen.findByTestId('league-teams-own')).findByText('None of your teams are entered this season. Use Add Team.')).toBeInTheDocument()
    second.unmount()

    // Only own teams: the league card says so.
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])
    mocks.listLeagueTeams.mockResolvedValue([])
    renderLeagueView(TEAMS_PATH)
    expect(await within(await screen.findByTestId('league-teams-league')).findByText('No league teams registered this season. Use Add Team.')).toBeInTheDocument()
  })

  it('the All | Our teams | League teams switch shows one card or both, with counts in its labels and no Showing line', async () => {
    const user = userEvent.setup()
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    renderLeagueView(TEAMS_PATH)
    await screen.findByTestId('league-teams-own')
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Our teams' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'League teams' })).toBeInTheDocument()
    // The switch is in the same bar as the Search field.
    const switchGroup = screen.getByRole('group', { name: 'Teams to show' })
    const searchRow = screen.getByLabelText('Search').closest('div[class*="MuiBox"]')?.parentElement as HTMLElement
    expect(searchRow).toContainElement(switchGroup)

    await user.click(screen.getByRole('button', { name: 'Our teams' }))
    expect(screen.getByTestId('league-teams-own')).toBeInTheDocument()
    expect(screen.queryByTestId('league-teams-league')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'League teams' }))
    expect(screen.queryByTestId('league-teams-own')).not.toBeInTheDocument()
    expect(screen.getByTestId('league-teams-league')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByTestId('league-teams-own')).toBeInTheDocument()
  })

  it('searches team names in both cards', async () => {
    const user = userEvent.setup()
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    renderLeagueView(TEAMS_PATH)
    await screen.findByRole('link', { name: '1st XI' })

    await user.type(screen.getByLabelText('Search'), 'occasionals')
    expect(screen.queryByRole('link', { name: '1st XI' })).not.toBeInTheDocument()
    expect(screen.getByText('Riverside Occasionals')).toBeInTheDocument()
    expect(screen.getByText('No teams match your search.')).toBeInTheDocument()
  })

  it('uses a logo-less avatar with the abbreviation, falling back to initials from the name', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: 'Irene Villagers', abbreviation: 'IV1' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])
    mocks.listLeagueTeams.mockResolvedValue([makeLeagueTeam({ name: 'Centurion Brits', abbreviation: null })])

    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByText('IV1')).toBeInTheDocument()
    expect(await screen.findByText('CB')).toBeInTheDocument()
  })

  it('shows a centred empty state with a filled Add Team button when the season has neither own nor league teams', async () => {
    const user = userEvent.setup()
    mocks.listLeagueTeams.mockResolvedValue([])

    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByText('No teams in this league yet for 2026.')).toBeInTheDocument()
    expect(screen.queryByTestId('league-teams-own')).not.toBeInTheDocument()
    const addTeam = screen.getByRole('button', { name: 'Add Team' })
    expect(addTeam).toHaveClass('MuiButton-contained')
    // The tab row still carries the Manage Teams menu (its Add Team is a menu item, not a button).
    expect(within(screen.getByTestId('league-tab-actions')).getByRole('button', { name: 'Manage Teams' })).toBeInTheDocument()
    await user.click(addTeam)
    expect(await screen.findByRole('dialog', { name: 'Add a team' })).toBeInTheDocument()
  })

  it('does not show the empty copy while the teams are still loading', async () => {
    mocks.listLeagueTeams.mockReturnValue(new Promise(() => undefined))

    renderLeagueView(TEAMS_PATH)

    expect(await screen.findByLabelText('Loading teams')).toBeInTheDocument()
    expect(screen.queryByText(/No teams in this league yet/)).not.toBeInTheDocument()
  })

  it('shows the no-seasons copy when the club has no seasons', async () => {
    mocks.listSeasons.mockResolvedValue([])

    renderLeagueView(TEAMS_PATH)

    expect(
      await screen.findByText('No seasons yet — teams are affiliated to a league for a specific season.'),
    ).toBeInTheDocument()
    expect(mocks.listLeagueTeams).not.toHaveBeenCalled()
  })

  it('has no Edit action on any tile and no Edit League button (it is a Manage League option)', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ teamId: 'team-1' })])

    renderLeagueView(TEAMS_PATH)

    await screen.findByRole('link', { name: '1st XI' })
    expect(screen.queryByRole('link', { name: 'Edit League' })).not.toBeInTheDocument()
    expect(within(screen.getAllByTestId('league-team-tile')[0]).queryByText('Edit')).not.toBeInTheDocument()
  })

  describe('add actions', () => {
    // The tab row's Manage Teams menu, then one of its items.
    async function openManageTeams(user: ReturnType<typeof userEvent.setup>, item: string) {
      await user.click(await screen.findByRole('button', { name: 'Manage Teams' }))
      await user.click(await screen.findByRole('menuitem', { name: new RegExp(item) }))
    }

    function axiosFailure(status: number, detail: string) {
      return new AxiosError('failed', undefined, undefined, undefined, { status, data: { detail } } as AxiosResponse)
    }

    it('puts one white Manage Teams menu in the tab actions (Add Team, Copy Teams, Share Teams), and no buttons in the panel headers', async () => {
      const user = userEvent.setup()
      renderLeagueView(TEAMS_PATH)

      const own = await screen.findByTestId('league-teams-own')
      const league = await screen.findByTestId('league-teams-league')
      // The only buttons in the panels are the tiles' Actions kebabs (page-anatomy section 6).
      for (const panel of [own, league]) {
        for (const button of within(panel).queryAllByRole('button')) expect(button).toHaveAccessibleName(/^Actions for /)
      }
      expect(screen.queryByRole('button', { name: 'Add League Team' })).not.toBeInTheDocument()
      const actions = screen.getByTestId('league-tab-actions')
      const trigger = within(actions).getByRole('button', { name: 'Manage Teams' })
      expect(trigger).toHaveClass('MuiButton-outlined')
      expect(within(actions).getAllByRole('button')).toHaveLength(1)
      await user.click(trigger)
      const items = (await screen.findAllByRole('menuitem')).map((item) => item.querySelector('span')?.textContent)
      expect(items).toEqual(['Add Team', 'Copy Teams', 'Share Teams'])
    })

    it('Copy Teams opens the Copy league teams dialog directly', async () => {
      const user = userEvent.setup()
      renderLeagueView(TEAMS_PATH)
      await openManageTeams(user, 'Copy Teams')
      expect(await screen.findByText('Copy league teams')).toBeInTheDocument()
    })

    it('Add Team opens the chooser; Cancel closes it', async () => {
      const user = userEvent.setup()
      renderLeagueView(TEAMS_PATH)
      await openManageTeams(user, 'Add Team')
      expect(await screen.findByRole('dialog', { name: 'Add a team' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a team' })).not.toBeInTheDocument())
    })

    it('shows no loose Unaffiliate, Edit, Deactivate or Remove buttons: they live in each tile\'s Actions menu', async () => {
      renderLeagueView(TEAMS_PATH)

      await screen.findByText('Riverside Occasionals')
      for (const name of ['Unaffiliate', 'Deactivate', 'Remove']) {
        expect(screen.queryByRole('button', { name: new RegExp(name) })).not.toBeInTheDocument()
      }
    })

    it('lists only the club teams not yet affiliated this season and affiliates the chosen one, then refreshes', async () => {
      const user = userEvent.setup()
      const first = makeTeam({ id: 'team-1', name: '1st XI' })
      const second = makeTeam({ id: 'team-2', name: '2nd XI' })
      const retired = makeTeam({ id: 'team-3', name: 'Old XI', active: false })
      mocks.listTeamsForClub.mockResolvedValue([first, second, retired])
      mocks.listLeagueAffiliations.mockResolvedValueOnce([makeAffiliation({ teamId: 'team-1' })])
      mocks.createLeagueAffiliation.mockResolvedValue(makeAffiliation({ id: 'affiliation-2', teamId: 'team-2' }))

      renderLeagueView(TEAMS_PATH)
      await screen.findByRole('link', { name: '1st XI' })
      mocks.listLeagueAffiliations.mockResolvedValue([
        makeAffiliation({ teamId: 'team-1' }),
        makeAffiliation({ id: 'affiliation-2', teamId: 'team-2' }),
      ])

      await openManageTeams(user, 'Add Team')
      await user.click(await screen.findByRole('button', { name: /Our Team/ }))
      await user.click(await screen.findByRole('combobox', { name: 'Search teams' }))
      expect(await screen.findByRole('option', { name: '2nd XI' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: '1st XI' })).not.toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'Old XI' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('option', { name: '2nd XI' }))

      expect(mocks.createLeagueAffiliation).toHaveBeenCalledWith('test-club-id', 'league-1', 'team-2', 'season-1')
      expect(await screen.findByRole('link', { name: '2nd XI' })).toBeInTheDocument()
      expect(await screen.findByText('2nd XI was added to this season.')).toBeInTheDocument()
    })

    it('creates a league team through the form, refreshes the list and shows the outcome', async () => {
      const user = userEvent.setup()
      mocks.createLeagueTeam.mockResolvedValue(makeLeagueTeam({ id: 'lt-new', name: 'Police' }))

      renderLeagueView(TEAMS_PATH)
      await screen.findByText('Riverside Occasionals')
      mocks.listLeagueTeams.mockImplementation(async () => [
        makeLeagueTeam({ id: 'lt-active', name: 'Riverside Occasionals' }),
        makeLeagueTeam({ id: 'lt-new', name: 'Police' }),
      ])

      await openManageTeams(user, 'Add Team')
      await user.click(await screen.findByRole('button', { name: /Opponent Team/ }))
      await user.type(await screen.findByLabelText(/Team name/), 'Police')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() =>
        expect(mocks.createLeagueTeam).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', expect.objectContaining({ name: 'Police' })),
      )
      expect(await screen.findByText('Police was added.')).toBeInTheDocument()
      expect(await screen.findByRole('heading', { name: 'League teams · 2' })).toBeInTheDocument()
    })

    it('shows a 409 duplicate name against the Name field', async () => {
      const user = userEvent.setup()
      mocks.createLeagueTeam.mockRejectedValue(axiosFailure(409, 'Police is already registered for this season.'))

      renderLeagueView(TEAMS_PATH)
      await openManageTeams(user, 'Add Team')
      await user.click(await screen.findByRole('button', { name: /Opponent Team/ }))
      await user.type(await screen.findByLabelText(/Team name/), 'Police')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Police is already registered for this season.')).toBeInTheDocument()
      expect(screen.getByLabelText(/Team name/)).toHaveAttribute('aria-invalid', 'true')
    })

    it('opens the Copy league teams dialog from the Copy teams tile of the chooser', async () => {
      const user = userEvent.setup()

      renderLeagueView(TEAMS_PATH)
      await openManageTeams(user, 'Add Team')
      await user.click(await screen.findByRole('button', { name: /Copy Teams/ }))

      expect(await screen.findByText('Copy league teams')).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'Add a team' })).not.toBeInTheDocument()
    })
  })

  describe('tile Actions menus', () => {
    beforeEach(() => {
      mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
      mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ id: 'aff-1', teamId: 'team-1' })])
    })

    it('our team tile: Open Team (a link) and Remove from League', async () => {
      const user = userEvent.setup()
      renderLeagueView(TEAMS_PATH)
      await user.click(await screen.findByRole('button', { name: 'Actions for 1st XI' }))
      const menu = screen.getByRole('menu')
      expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open Team', 'Remove from League'])
      expect(within(menu).getByRole('menuitem', { name: 'Open Team' })).toHaveAttribute('href', expect.stringContaining('/manage/sections/section-1/teams/team-1'))
    })

    it('Remove from League asks first, then unaffiliates', async () => {
      const user = userEvent.setup()
      mocks.unaffiliateLeagueTeam.mockResolvedValue(undefined)
      renderLeagueView(TEAMS_PATH)
      await user.click(await screen.findByRole('button', { name: 'Actions for 1st XI' }))
      await user.click(screen.getByRole('menuitem', { name: 'Remove from League' }))
      const dialog = await screen.findByRole('dialog', { name: 'Unaffiliate 1st XI from this season?' })
      expect(mocks.unaffiliateLeagueTeam).not.toHaveBeenCalled()
      await user.click(within(dialog).getByRole('button', { name: 'Unaffiliate' }))
      await waitFor(() => expect(mocks.unaffiliateLeagueTeam).toHaveBeenCalledWith('test-club-id', 'league-1', 'aff-1'))
    })

    it('league team tile: Edit League Team, Deactivate and Remove', async () => {
      const user = userEvent.setup()
      renderLeagueView(TEAMS_PATH)
      await user.click(await screen.findByRole('button', { name: 'Actions for Riverside Occasionals' }))
      expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Edit League Team', 'Deactivate', 'Remove'])
    })

    it('Edit League Team opens the form; Deactivate runs the existing mutation', async () => {
      const user = userEvent.setup()
      mocks.deactivateLeagueTeam.mockResolvedValue(undefined)
      renderLeagueView(TEAMS_PATH)
      await user.click(await screen.findByRole('button', { name: 'Actions for Riverside Occasionals' }))
      await user.click(screen.getByRole('menuitem', { name: 'Deactivate' }))
      await waitFor(() => expect(mocks.deactivateLeagueTeam).toHaveBeenCalled())

      await user.click(await screen.findByRole('button', { name: 'Actions for Riverside Occasionals' }))
      await user.click(screen.getByRole('menuitem', { name: 'Edit League Team' }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
    })
  })

  // docs/specs/127-return-navigation.md
  it('Open Team (tile link and menu item) carries the Teams tab as its origin', async () => {
    mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation({ id: 'aff-1', teamId: 'team-1' })])
    const user = userEvent.setup()
    renderLeagueView(TEAMS_PATH)

    const origin = { to: TEAMS_PATH, label: 'Internal League teams' }
    expect(returnOf((await screen.findByRole('link', { name: '1st XI' })).getAttribute('href'))).toEqual(origin)
    await user.click(screen.getByRole('button', { name: 'Actions for 1st XI' }))
    expect(returnOf(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Open Team' }).getAttribute('href'))).toEqual(origin)
  })
})
