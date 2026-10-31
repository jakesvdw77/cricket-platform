import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MANAGE_BUTTON_WIDTH } from '../../../components/ManageMenu'
import { clearViewport, setPhone } from '../../../test/accountTestUtils'
import {
  emptyPage,
  makeAffiliation,
  makeContact,
  makeLeague,
  makeLeagueTeam,
  makeSeason,
  makeTeam,
  renderLeagueView,
} from './leagueViewTestUtils'

// The first render in this file pays the one-off cost of mounting the whole routed page (MUI, emotion,
// the schedule generators), which can exceed Testing Library's default 1s findBy wait on a busy
// machine; widen the wait for this file only. Assertions are unchanged, no sleeps.
configure({ asyncUtilTimeout: 5000 })

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
  getLeagueAgeReference: vi.fn(),
}))

vi.mock('../../../api/leagueApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueApi')>()),
  listLeagues: (clubId: string, params?: unknown) => mocks.listLeagues(clubId, params),
  getLeagueAgeReference: (...args: unknown[]) => mocks.getLeagueAgeReference(...args),
}))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: (clubId: string) => mocks.listSeasons(clubId) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: (clubId: string) => mocks.listTeamsForClub(clubId) }))
vi.mock('../../../api/leagueAffiliationApi', () => ({
  listLeagueAffiliations: (clubId: string, leagueId: string) => mocks.listLeagueAffiliations(clubId, leagueId),
}))
vi.mock('../../../api/leagueContactApi', () => ({
  listLeagueContacts: (clubId: string, leagueId: string) => mocks.listLeagueContacts(clubId, leagueId),
}))
vi.mock('../../../api/leagueTeamApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueTeamApi')>()),
  listLeagueTeams: (...args: unknown[]) => mocks.listLeagueTeams(...args),
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
  mocks.getLeagueAgeReference.mockRejectedValue(new Error('no reference'))
})

const LEAGUE_PATH = '/manage/fixtures/leagues/league-1'

afterEach(() => clearViewport())

// docs/specs/127-return-navigation.md: the origin and label carried in an href.
function returnOf(href: string | null) {
  const params = new URLSearchParams((href ?? '').split('?')[1])
  return { to: params.get('returnTo'), label: params.get('returnLabel') }
}

async function openManage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Manage League' }))
}

function following(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('LeagueViewLayout', () => {
  describe('guards', () => {
    it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`, null)

      expect(screen.getByText('Not authorized')).toBeInTheDocument()
      expect(mocks.listLeagues).not.toHaveBeenCalled()
    })

    it('renders an error state when the matching league id is not in the fetched list', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ id: 'some-other-id' })])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      expect(await screen.findByText("Couldn't load this league")).toBeInTheDocument()
    })

    it('renders an error state when loading the leagues fails', async () => {
      mocks.listLeagues.mockRejectedValue(new Error('boom'))

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      expect(await screen.findByText("Couldn't load this league")).toBeInTheDocument()
    })
  })

  // docs/specs/110: the date ages are judged on, from the server, for a league that has an age limit.
  describe('age reference line', () => {
    beforeEach(() => {
      mocks.listSeasons.mockResolvedValue([makeSeason()])
    })

    it('puts the cut-off date in the Playing XI info tooltip for a league with an age limit', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ maxAge: 15, ageCutoffMonth: 12, ageCutoffDay: 31 })])
      mocks.getLeagueAgeReference.mockResolvedValue({
        referenceDate: '2026-12-31',
        source: 'CUTOFF',
        leagueStart: '2026-09-05',
        leagueStartSource: 'FIRST_MATCH',
      })

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const info = await screen.findByTestId('league-figure-xi-info')
      expect(screen.getByTestId('league-figure-xi')).toContainElement(info)
      expect(screen.queryByText(/Ages judged on/)).not.toBeInTheDocument()
      expect(screen.getByTestId('league-figure-xi-info')).toHaveAttribute('aria-label', 'Ages are judged on 31 Dec 2026 (the cut-off)')
      expect(mocks.getLeagueAgeReference).toHaveBeenCalledWith('test-club-id', 'league-1', expect.any(String))
    })

    it('puts the league start day in the info tooltip when the league has no cut-off', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ minAge: 12 })])
      mocks.getLeagueAgeReference.mockResolvedValue({
        referenceDate: '2027-07-14',
        source: 'LEAGUE_START',
        leagueStart: '2027-07-14',
        leagueStartSource: 'FIRST_MATCH',
      })

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      expect(await screen.findByTestId('league-figure-xi-info')).toHaveAttribute('aria-label', 'Ages are judged on 14 Jul 2027 (the day the league starts)')
    })

    it('shows no info icon, and makes no lookup, for a league with no age limit', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByTestId('league-key-figures')
      expect(screen.queryByTestId('league-figure-xi-info')).not.toBeInTheDocument()
      expect(mocks.getLeagueAgeReference).not.toHaveBeenCalled()
    })

    it('shows no info icon when the lookup fails', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ maxAge: 15 })])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByTestId('league-key-figures')
      await waitFor(() => expect(mocks.getLeagueAgeReference).toHaveBeenCalled())
      expect(screen.queryByTestId('league-figure-xi-info')).not.toBeInTheDocument()
    })
  })

  describe('routes', () => {
    beforeEach(() => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listSeasons.mockResolvedValue([makeSeason()])
    })

    it('redirects the bare league URL to the Schedule', async () => {
      renderLeagueView(LEAGUE_PATH)

      expect(await screen.findByText('No fixtures yet')).toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent(`${LEAGUE_PATH}/schedule`)
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/schedule`)
    })

    it('keeps ?seasonId= through the redirect', async () => {
      mocks.listSeasons.mockResolvedValue([makeSeason(), makeSeason({ id: 'season-2', label: '2027' })])

      renderLeagueView(`${LEAGUE_PATH}?seasonId=season-2`)

      expect(await screen.findByText('No fixtures yet')).toBeInTheDocument()
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/schedule?seasonId=season-2`)
    })

    it('replaces the bare URL in history rather than pushing the redirect', async () => {
      renderLeagueView(['/manage/fixtures/leagues', LEAGUE_PATH])
      await screen.findByText('No fixtures yet')

      await userEvent.setup().click(screen.getByRole('button', { name: 'Go back' }))

      expect(await screen.findByText('League List Page')).toBeInTheDocument()
    })

    it('renders only the Schedule section on /schedule', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      expect(await screen.findByText('No fixtures yet')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Search teams')).not.toBeInTheDocument()
      expect(screen.queryByText(/^Playing conditions for/)).not.toBeInTheDocument()
    })

    it('renders only the Teams section on /teams', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams`)

      expect(await screen.findByPlaceholderText('Search teams')).toBeInTheDocument()
      expect(screen.queryByText('No fixtures yet')).not.toBeInTheDocument()
      expect(screen.queryByText(/^Playing conditions for/)).not.toBeInTheDocument()
    })

    it('renders only the Conditions section on /conditions', async () => {
      renderLeagueView(`${LEAGUE_PATH}/conditions`)

      expect(await screen.findByText('Playing conditions for 2026')).toBeInTheDocument()
      expect(screen.queryByText('No fixtures yet')).not.toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Search teams')).not.toBeInTheDocument()
    })

    it('still resolves /:id/edit and /:id/contacts/:contactId/edit to their own pages', async () => {
      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/edit`)
      expect(await screen.findByText('Edit League Page')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Internal League' })).not.toBeInTheDocument()
      unmount()

      renderLeagueView(`${LEAGUE_PATH}/contacts/contact-1/edit`)
      expect(await screen.findByText('Edit League Contact Page')).toBeInTheDocument()
    })
  })

  describe('header', () => {
    beforeEach(() => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listSeasons.mockResolvedValue([makeSeason()])
    })

    it('lays the rows out in order: Back; logo, name with badges, the Season pill and Manage League on the title row, the contacts line under the name; the strip', async () => {
      mocks.listLeagues.mockResolvedValue([
        makeLeague({
          format: 'T20',
          phone: '+27 21 555 0199',
          socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-premier' }],
        }),
      ])
      mocks.listLeagueContacts.mockResolvedValue([makeContact()])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const heading = await screen.findByRole('heading', { name: 'Internal League' })
      const topRow = screen.getByTestId('league-header-top-row')
      const titleRow = screen.getByTestId('league-header-title-row')
      const back = within(topRow).getByRole('link', { name: 'Back to Leagues' })
      const season = within(titleRow).getByRole('button', { name: 'Season' })
      const manage = within(titleRow).getByRole('button', { name: 'Manage League' })
      const people = screen.getByTestId('league-header-contact-people')
      const links = screen.getByTestId('league-header-links-row')
      const strip = screen.getByTestId('league-key-figures')

      expect(following(back, heading)).toBe(true)
      expect(following(heading, manage)).toBe(true)
      // The top row holds only Back; Manage League is the one button on the title row, right-aligned after the badges and Season pill.
      expect(within(topRow).queryAllByRole('button')).toHaveLength(0)
      expect(screen.queryByRole('link', { name: 'Edit League' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument()
      expect(getComputedStyle(screen.getByTestId('league-header-actions')).marginLeft).toBe('auto')
      expect(within(topRow).queryByRole('button', { name: 'Season' })).not.toBeInTheDocument()
      expect(following(within(titleRow).getByLabelText('League badges'), season)).toBe(true)
      expect(following(topRow, titleRow)).toBe(true)
      expect(within(titleRow).getByRole('heading', { name: 'Internal League' })).toBe(heading)
      expect(within(titleRow).getByLabelText('League badges')).toBeInTheDocument()
      // The contacts line sits inside the title block, directly under the name and badges, with the social icon inline at its end.
      const contactsLine = screen.getByTestId('league-header-contacts-line')
      expect(titleRow).toContainElement(contactsLine)
      expect(following(heading, contactsLine)).toBe(true)
      expect(following(people, links)).toBe(true)
      expect(following(links, screen.getByTestId('league-header-social'))).toBe(true)
      expect(contactsLine).toContainElement(screen.getByTestId('league-header-social'))
      expect(following(titleRow, strip)).toBe(true)
    })

    it('shows Manage League as the filled (contained) button with a caret and no leading icon, and lets the name wrap', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const heading = await screen.findByRole('heading', { name: 'Internal League' })
      const manage = within(screen.getByTestId('league-header-title-row')).getByRole('button', { name: 'Manage League' })

      expect(manage.className).toContain('MuiButton-contained')
      expect(manage.querySelector('.MuiButton-startIcon')).toBeNull()
      expect(manage.querySelector('svg[data-testid="ArrowDropDownIcon"]')).not.toBeNull()
      expect(getComputedStyle(heading).overflowWrap).toBe('anywhere')
      expect(getComputedStyle(heading).textOverflow).not.toBe('ellipsis')
    })

    it('styles the league name in the display face at the list title size but keeps its capitals', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const heading = await screen.findByRole('heading', { name: 'Internal League' })
      const style = getComputedStyle(heading)
      expect(style.textTransform).toBe('none')
      expect(style.fontWeight).toBe('700')
      expect(style.fontFamily).toContain('Barlow Condensed')
    })

    it('keeps only Back on the top row, with the Season pill and Manage League on the title row', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByRole('heading', { name: 'Internal League' })
      const topRow = screen.getByTestId('league-header-top-row')

      expect(within(topRow).getByRole('link', { name: 'Back to Leagues' })).toBeInTheDocument()
      expect(within(topRow).queryByRole('button', { name: 'Season' })).not.toBeInTheDocument()
      expect(within(screen.getByTestId('league-header-title-row')).getByRole('button', { name: 'Season' })).toBeInTheDocument()
      expect(within(screen.getByTestId('league-header-title-row')).getByRole('button', { name: 'Manage League' })).toBeInTheDocument()
      expect(screen.queryByLabelText('League badges', { selector: '[data-testid="league-header-top-row"] *' })).not.toBeInTheDocument()
    })

    it('puts the badges on the title line, in the same row as the name', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ format: 'T20' })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const heading = await screen.findByRole('heading', { name: 'Internal League' })
      const badges = screen.getByLabelText('League badges')
      expect(heading.parentElement).toContainElement(badges)
      expect(getComputedStyle(heading.parentElement as HTMLElement).flexWrap).toBe('wrap')
    })

    it.each(['schedule', 'teams', 'conditions'])(
      'points "Back to Leagues" at the leagues list on the %s view, not rewritten by ?seasonId=',
      async (view) => {
        mocks.listSeasons.mockResolvedValue([makeSeason(), makeSeason({ id: 'season-2', label: '2027' })])

        renderLeagueView(`${LEAGUE_PATH}/${view}?seasonId=season-2`)

        const back = await screen.findByRole('link', { name: 'Back to Leagues' })
        expect(back).toHaveAttribute('href', '/manage/fixtures/leagues')
      },
    )

    it('points Edit League Details at the league edit route, carrying the selected season', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await openManage(user)
      expect(screen.getByRole('menuitem', { name: /Edit League Details/ })).toHaveAttribute('href', expect.stringContaining(`${LEAGUE_PATH}/edit?seasonId=season-1`))
    })

    it.each([
      ['schedule', ''],
      ['teams', ''],
      ['conditions', 'tab=conditions&'],
    ])('opens the edit tab for the %s view (Details unless Playing Conditions)', async (view, tab) => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/${view}`)

      await openManage(user)
      expect(screen.getByRole('menuitem', { name: /Edit League Details/ })).toHaveAttribute('href', expect.stringContaining(`${LEAGUE_PATH}/edit?${tab}seasonId=season-1`))
    })

    it('no longer has Create match, Share, Duplicate League, Edit League or Actions as page buttons (they are Manage League options)', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByRole('heading', { name: 'Internal League' })
      for (const name of ['Create match', 'Share', 'Duplicate League', 'Actions', 'Add Match']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
      expect(screen.queryByRole('link', { name: 'Edit League' })).not.toBeInTheDocument()
    })

    it('shows only a white Manage Teams menu button in the tab actions area on the Teams tab when the season has teams', async () => {
      mocks.listLeagueTeams.mockResolvedValue([makeLeagueTeam()])
      renderLeagueView(`${LEAGUE_PATH}/teams`)

      const actions = await screen.findByTestId('league-tab-actions')
      await waitFor(() => expect(actions).not.toBeEmptyDOMElement())
      expect(within(actions).getAllByRole('button')).toHaveLength(1)
      expect(within(actions).getByRole('button', { name: 'Manage Teams' }).className).toContain('MuiButton-outlined')
      expect(screen.queryByRole('link', { name: 'Add match' })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Edit conditions' })).not.toBeInTheDocument()
    })

    it.each([
      ['schedule', 'Manage Schedule', ['Add Match', 'Import Schedule', 'Share Schedule']],
      ['teams', 'Manage Teams', ['Add Team', 'Copy Teams', 'Share Teams']],
      ['conditions', 'Manage Playing Conditions', ['Edit Playing Conditions', 'Share Playing Conditions', 'View Document']],
    ])('the %s tab menu "%s" lists its items in order, Share never first', async (tab, label, expected) => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/${tab}`)

      await user.click(await screen.findByRole('button', { name: label }))
      const names = screen.getAllByRole('menuitem').map((item) => item.querySelector('span')?.textContent)
      expect(names).toEqual(expected)
    })

    it('gives Manage League and the tab-row Manage button the same fixed width, from one shared constant', async () => {
      renderLeagueView(`${LEAGUE_PATH}/conditions`)

      const league = await screen.findByRole('button', { name: 'Manage League' })
      const tab = await screen.findByRole('button', { name: 'Manage Playing Conditions' })
      expect(MANAGE_BUTTON_WIDTH).toBe(220)
      expect(getComputedStyle(league).width).toBe(`${MANAGE_BUTTON_WIDTH}px`)
      expect(getComputedStyle(tab).width).toBe(`${MANAGE_BUTTON_WIDTH}px`)
      expect(league.className).toContain('MuiButton-contained')
      expect(tab.className).toContain('MuiButton-outlined')
    })

    it('drops seasonId from the Edit League Details link when no season exists, keeping the tab', async () => {
      const user = userEvent.setup()
      mocks.listSeasons.mockResolvedValue([])

      renderLeagueView(`${LEAGUE_PATH}/teams`)

      await openManage(user)
      expect(screen.getByRole('menuitem', { name: /Edit League Details/ })).toHaveAttribute('href', expect.stringContaining(`${LEAGUE_PATH}/edit`))
    })

    it('carries a season chosen with ?seasonId= to the edit route', async () => {
      const user = userEvent.setup()
      mocks.listSeasons.mockResolvedValue([makeSeason(), makeSeason({ id: 'season-2', label: '2027' })])

      renderLeagueView(`${LEAGUE_PATH}/schedule?seasonId=season-2`)

      await openManage(user)
      expect(screen.getByRole('menuitem', { name: /Edit League Details/ })).toHaveAttribute('href', expect.stringContaining(`${LEAGUE_PATH}/edit?seasonId=season-2`))
    })

    it('renders the format badge only when the league has a format, and never a team count or season badge', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ format: 'ONE_DAY' })])
      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/schedule`)
      expect(await within(await screen.findByLabelText('League badges')).findByText('1 Day')).toBeInTheDocument()
      unmount()

      mocks.listLeagues.mockResolvedValue([makeLeague({ format: null })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)
      const badges = await screen.findByLabelText('League badges')
      expect(within(badges).getAllByText(/./).map((node) => node.textContent)).toEqual(['Active'])
    })

    it("counts the selected season's affiliated teams plus its active league teams in the Teams figure, not league.currentSeasonTeamCount", async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ currentSeasonTeamCount: 99 })])
      mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1' }), makeTeam({ id: 'team-2', name: '2nd XI' })])
      mocks.listLeagueAffiliations.mockResolvedValue([
        makeAffiliation({ id: 'a1', teamId: 'team-1' }),
        makeAffiliation({ id: 'a2', teamId: 'team-2' }),
        makeAffiliation({ id: 'a3', teamId: 'team-2', seasonId: 'other-season' }),
      ])
      mocks.listLeagueTeams.mockResolvedValue([makeLeagueTeam({ id: 'lt1' })])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await waitFor(() => expect(within(screen.getByTestId('league-figure-teams')).getByTestId('page-counter-value')).toHaveTextContent('3'))
      expect(screen.queryByText(/99/)).not.toBeInTheDocument()
      expect(mocks.listLeagueTeams).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', { activeOnly: true })
    })

    it('shows Active or Inactive', async () => {
      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/schedule`)
      expect(within(await screen.findByLabelText('League badges')).getByText('Active')).toBeInTheDocument()
      unmount()

      mocks.listLeagues.mockResolvedValue([makeLeague({ active: false })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)
      expect(within(await screen.findByLabelText('League badges')).getByText('Inactive')).toBeInTheDocument()
    })

    // docs/specs/091 (C): the league and its figures are requested for the selected season.
    it('asks for the league with the selected season, and shows the key figures from it', async () => {
      mocks.listLeagues.mockResolvedValue([
        makeLeague({ matchCount: 56, playedCount: 12, nextMatchDate: '2999-01-01T09:00:00Z', maxPlayingXiSize: 11, minAge: 40, maxAge: null }),
      ])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await waitFor(() => expect(within(screen.getByTestId('league-figure-played')).getByTestId('page-counter-value')).toHaveTextContent('12 of 56'))
      expect(mocks.listLeagues).toHaveBeenCalledWith('test-club-id', { seasonId: 'season-1' })
      expect(within(screen.getByTestId('league-figure-xi')).getByTestId('page-counter-value')).toHaveTextContent('11')
      expect(screen.getByText('Playing XI · age 40-any')).toBeInTheDocument()
    })

    it('the Manage League panel lists league-wide options only, Share last', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await openManage(user)

      const names = screen.getAllByRole('menuitem').map((item) => item.querySelector('span')?.textContent)
      expect(names).toEqual(['Edit League Details', 'Duplicate League', 'Import History', 'Share League'])
    })

    it('has no edit pencil in the Back row, and Manage League stays the only filled button of the header', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams?seasonId=season-1`)

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(screen.queryByTestId('league-edit-corner')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Edit league details' })).not.toBeInTheDocument()
      const headerFilled = (id: string) => Array.from(screen.getByTestId(id).querySelectorAll('.MuiButton-contained')).map((el) => el.textContent)
      expect(headerFilled('league-header-top-row')).toEqual([])
      expect(headerFilled('league-header-title-row')).toEqual(['Manage League'])
    })

    it('follows the badges directly with the Season pill in the title row', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams?seasonId=season-1`)

      const badges = await screen.findByLabelText('League badges')
      const pill = within(screen.getByTestId('league-header-title-row')).getByRole('button', { name: 'Season' })
      expect(following(badges, pill)).toBe(true)
    })

    it('drops the tile behind the league logo only once it has loaded, and keeps the soft green tint without one', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ logoUrl: '/media/logo.png' })])
      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/schedule`)
      const img = await screen.findByRole('img')
      const avatar = img.closest('.MuiAvatar-root') as HTMLElement
      expect(getComputedStyle(avatar).backgroundImage).toBe('none')
      expect(getComputedStyle(avatar).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
      fireEvent.load(img)
      expect(getComputedStyle(avatar).backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(getComputedStyle(avatar).backgroundImage).not.toContain('gradient')
      unmount()
      mocks.listLeagues.mockResolvedValue([makeLeague({ logoUrl: null })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)
      await screen.findByRole('heading', { name: 'Internal League' })
      const tile = getComputedStyle(document.querySelector('.MuiAvatar-root') as HTMLElement)
      expect(tile.backgroundImage).toBe('none')
      expect(tile.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    })

    it('links Add Match and Import Schedule (Manage Schedule) to the prefilled Match form and the import wizard, and Edit League Details to the edit page', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await user.click(await screen.findByRole('button', { name: 'Manage Schedule' }))

      expect(screen.getByRole('menuitem', { name: /Add Match/ })).toHaveAttribute('href', expect.stringContaining('/manage/fixtures/matches/new?leagueId=league-1&seasonId=season-1'))
      expect(screen.getByRole('menuitem', { name: /Import Schedule/ })).toHaveAttribute('href', expect.stringContaining(`${LEAGUE_PATH}/schedule/import?seasonId=season-1&from=view`))
    })

    it('disables Import Schedule for an inactive league, with the reason', async () => {
      const user = userEvent.setup()
      mocks.listLeagues.mockResolvedValue([makeLeague({ active: false })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await user.click(await screen.findByRole('button', { name: 'Manage Schedule' }))

      const item = screen.getByRole('menuitem', { name: /Import Schedule/ })
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).toHaveTextContent('League is inactive')
    })

    it('opens the Add Team chooser from Manage Teams', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/teams?seasonId=season-1`)

      await user.click(await screen.findByRole('button', { name: 'Manage Teams' }))
      await user.click(screen.getByRole('menuitem', { name: /Add Team/ }))

      expect(await screen.findByRole('dialog', { name: 'Add a team' })).toBeInTheDocument()
    })

    it('still opens the chooser once for a legacy ?add=team link, and removes the parameter', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams?seasonId=season-1&add=team`)

      expect(await screen.findByRole('dialog', { name: 'Add a team' })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByTestId('location').textContent).not.toContain('add='))
    })

    it('opens the season PDF from View Document only when it has one', async () => {
      const user = userEvent.setup()
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      mocks.getPlayingConditions.mockResolvedValue({ documentUrl: '/media/rules.pdf' })
      renderLeagueView(`${LEAGUE_PATH}/conditions`)

      await user.click(await screen.findByRole('button', { name: 'Manage Playing Conditions' }))
      await waitFor(() => expect(screen.getByRole('menuitem', { name: /View Document/ })).not.toHaveAttribute('aria-disabled', 'true'))
      await user.click(screen.getByRole('menuitem', { name: /View Document/ }))

      await waitFor(() => expect(openSpy).toHaveBeenCalledWith('/media/rules.pdf', '_blank', 'noopener'))
      openSpy.mockRestore()
    })

    it.each(['schedule', 'teams', 'conditions'])('opens the Share League dialog from Manage League on the %s tab, and returns focus to the button', async (tab) => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/${tab}`)

      await openManage(user)
      await user.click(screen.getByRole('menuitem', { name: /Share League/ }))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(screen.getByRole('button', { name: 'Manage League' })).toHaveFocus())
    })

    // docs/specs/096-duplicate-league.md: the action works from every tab (in the Manage League panel, docs/specs/126).
    it.each(['schedule', 'teams', 'conditions'])('opens the Duplicate league dialog from Manage League on the %s tab', async (tab) => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/${tab}`)

      await openManage(user)
      await user.click(screen.getByRole('menuitem', { name: /Duplicate League/ }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByRole('heading', { name: 'Duplicate league' })).toBeInTheDocument()
      expect(within(dialog).getByLabelText(/New league name/)).toHaveValue('Internal League (copy)')
      expect(within(dialog).getByRole('checkbox', { name: '2026' })).toBeChecked()

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('opens the import history panel from Manage League', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/teams`)

      await openManage(user)
      await user.click(screen.getByRole('menuitem', { name: /Import History/ }))

      expect(await screen.findByRole('button', { name: 'Close import history' })).toBeInTheDocument()
    })

    it('disables the season options with "Create a season first" while the league has no season', async () => {
      const user = userEvent.setup()
      mocks.listSeasons.mockResolvedValue([])
      renderLeagueView(`${LEAGUE_PATH}/teams`)

      await openManage(user)

      const item = screen.getByRole('menuitem', { name: /Import History/ })
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(item).toHaveTextContent('Create a season first')
    })

    it('on a phone: a full-width Manage League button under the title opens a bottom sheet, the Season pill on the title row', async () => {
      const user = userEvent.setup()
      setPhone(true)
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByRole('heading', { name: 'Internal League' })
      const topRow = screen.getByTestId('league-header-top-row')
      const titleRow = screen.getByTestId('league-header-title-row')
      const manage = screen.getByRole('button', { name: 'Manage League' })
      expect(topRow).not.toContainElement(manage)
      expect(within(titleRow).getByRole('button', { name: 'Season' })).toBeInTheDocument()
      expect(following(titleRow, manage)).toBe(true)
      expect(getComputedStyle(manage).width).toBe('100%')
      await user.click(manage)
      expect(document.querySelector('.MuiDrawer-paper')).toHaveAttribute('aria-label', 'Manage League')
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(2)
    })

    it('hides the Season select when the club has no seasons', async () => {
      mocks.listSeasons.mockResolvedValue([])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(screen.queryByRole('button', { name: 'Season' })).not.toBeInTheDocument()
    })
  })

  describe('contact section', () => {
    it('shows only the set phone, email and website as tel:, mailto: and external links, then the social icons inline at the end of the same line', async () => {
      mocks.listLeagues.mockResolvedValue([
        makeLeague({
          phone: '+27 21 555 0199',
          email: 'info@riverside-premier.example',
          website: 'https://riverside-premier.example',
          socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/riverside-premier' }],
        }),
      ])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const row = await screen.findByTestId('league-header-links-row')
      expect(within(row).getByRole('link', { name: '+27 21 555 0199' })).toHaveAttribute('href', 'tel:+27 21 555 0199')
      expect(within(row).getByRole('link', { name: 'info@riverside-premier.example' })).toHaveAttribute(
        'href',
        'mailto:info@riverside-premier.example',
      )
      const website = within(row).getByRole('link', { name: 'https://riverside-premier.example' })
      expect(website).toHaveAttribute('href', 'https://riverside-premier.example')
      expect(website).toHaveAttribute('target', '_blank')
      expect(website).toHaveAttribute('rel', 'noopener')

      const social = screen.getByTestId('league-header-social')
      expect(within(social).getByRole('link', { name: 'Facebook' })).toHaveAttribute(
        'href',
        'https://facebook.com/riverside-premier',
      )
      expect(following(website, social)).toBe(true)
      // The links and the social icons share one wrapping line (docs/specs/091).
      expect(screen.getByTestId('league-header-contacts-line')).toContainElement(social)
      // The social link is an inline text item like the others, not a round button.
      expect(within(social).getByRole('link', { name: 'Facebook' })).toHaveTextContent('Facebook')
      expect(getComputedStyle(screen.getByTestId('league-header-contacts-line')).flexWrap).toBe('wrap')
    })

    it('omits each row that has nothing to show', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ phone: '+27 21 555 0199' })])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const row = await screen.findByTestId('league-header-links-row')
      expect(within(row).getByRole('link', { name: '+27 21 555 0199' })).toBeInTheDocument()
      expect(within(row).getAllByRole('link')).toHaveLength(1)
      expect(screen.queryByTestId('league-header-social')).not.toBeInTheDocument()
      expect(screen.queryByTestId('league-header-contact-people')).not.toBeInTheDocument()
    })

    it('omits the whole contacts line when there is nothing to show', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(screen.queryByTestId('league-header-contacts-line')).not.toBeInTheDocument()
      expect(screen.queryByTestId('league-header-contact-people')).not.toBeInTheDocument()
      expect(screen.queryByTestId('league-header-links-row')).not.toBeInTheDocument()
      expect(screen.queryByText('No contacts yet for this league.')).not.toBeInTheDocument()
    })

    it('renders the full name of the contact with a person icon before the links, then opens a quick view with Role/Email/Phone and the edit route', async () => {
      const user = userEvent.setup()
      mocks.listLeagues.mockResolvedValue([makeLeague({ phone: '+27 21 555 0199' })])
      mocks.listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1' })])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const people = await screen.findByTestId('league-header-contact-people')
      expect(following(people, screen.getByTestId('league-header-links-row'))).toBe(true)
      expect(within(people).queryByText('League contacts')).not.toBeInTheDocument()
      expect(within(people).getByText('Jane Smith')).toBeInTheDocument()
      expect(within(people).queryByText('JS')).not.toBeInTheDocument()
      expect(people.querySelector('[data-testid="PersonOutlineOutlinedIcon"]')).not.toBeNull()
      expect(mocks.listLeagueContacts).toHaveBeenCalledWith('test-club-id', 'league-1')

      await user.click(within(people).getByRole('button', { name: 'Jane Smith, League Administrator, open contact' }))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
      expect(screen.getByText('+27 21 555 0100')).toBeInTheDocument()
      // The dialog hides the page behind it from the accessibility tree, so this is its own Edit link.
      expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        `${LEAGUE_PATH}/contacts/contact-1/edit`,
      )
    })

    it('shows the primary contact first with +N listing the others, each opening the quick view', async () => {
      const user = userEvent.setup()
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listLeagueContacts.mockResolvedValue([
        makeContact({ id: 'c1', isPrimary: false, role: 'Treasurer', contact: { ...makeContact().contact, firstName: 'Tom', lastName: 'Brown' } }),
        makeContact({ id: 'c2', isPrimary: true, role: 'Chair', contact: { ...makeContact().contact, firstName: 'Ann', lastName: 'Lee' } }),
        makeContact({ id: 'c3', isPrimary: false, role: 'Secretary', contact: { ...makeContact().contact, firstName: 'Sam', lastName: 'Fox' } }),
      ])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const people = await screen.findByTestId('league-header-contact-people')
      expect(await within(people).findByRole('button', { name: 'Ann Lee, Chair, open contact' })).toBeInTheDocument()
      expect(within(people).queryByText('Tom Brown')).not.toBeInTheDocument()

      await user.click(within(people).getByRole('button', { name: 'Show 2 more league contacts' }))
      const menu = await screen.findByRole('menu')
      const items = within(menu).getAllByRole('menuitem')
      expect(items).toHaveLength(2)
      expect(items[0]).toHaveTextContent('Tom Brown')
      expect(items[0]).toHaveTextContent('Treasurer')
      await user.click(within(menu).getByRole('menuitem', { name: 'Sam Fox, Secretary, open contact' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Sam Fox')).toBeInTheDocument()
    })

    it('shows no +N for a single contact, and the links row still renders with no contacts', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ phone: '+27 21 555 0199' })])
      mocks.listLeagueContacts.mockResolvedValue([makeContact()])
      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/schedule`)
      await screen.findByRole('button', { name: 'Jane Smith, League Administrator, open contact' })
      expect(screen.queryByRole('button', { name: /more league contacts/ })).not.toBeInTheDocument()
      unmount()

      mocks.listLeagueContacts.mockResolvedValue([])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)
      expect(await screen.findByTestId('league-header-links-row')).toBeInTheDocument()
      expect(screen.queryByTestId('league-header-contact-people')).not.toBeInTheDocument()
    })

    it('shows a Status field for the primary contact and none for a non-primary one', async () => {
      const user = userEvent.setup()
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1', isPrimary: true })])

      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/schedule`)
      await user.click(await screen.findByRole('button', { name: 'Jane Smith, League Administrator, open contact' }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Primary')).toBeInTheDocument()
      unmount()

      mocks.listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1', isPrimary: false, active: true })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)
      await user.click(await screen.findByRole('button', { name: 'Jane Smith, League Administrator, open contact' }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByText('Status')).not.toBeInTheDocument()
    })
  })

  describe('season', () => {
    beforeEach(() => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      // Neither season contains today, so the default is the most recently created one.
      mocks.listSeasons.mockResolvedValue([
        makeSeason({ id: 'season-1', label: '2020', startDate: '2020-01-01', endDate: '2020-12-31', createdAt: '2020-01-01T00:00:00Z' }),
        makeSeason({ id: 'season-2', label: '2021', startDate: '2021-01-01', endDate: '2021-12-31', createdAt: '2021-01-01T00:00:00Z' }),
      ])
    })

    it('defaults to the season pickDefaultSeasonId chooses, without writing it to the URL', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams`)

      expect(await screen.findByPlaceholderText('Search teams')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2021')
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/teams`)
    })

    it('honours a valid ?seasonId=', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams?seasonId=season-1`)

      expect(await screen.findByPlaceholderText('Search teams')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Season' })).toHaveTextContent('2020')
      expect(mocks.listLeagueTeams).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', { activeOnly: true })
    })

    it('silently falls back to the default for an invalid ?seasonId=', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams?seasonId=not-a-season`)

      expect(await screen.findByPlaceholderText('Search teams')).toBeInTheDocument()
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/teams?seasonId=not-a-season`)
    })

    it('writes a user change to ?seasonId= with replace and re-scopes the view', async () => {
      const user = userEvent.setup()
      renderLeagueView(['/manage/fixtures/leagues', `${LEAGUE_PATH}/teams`])
      await screen.findByPlaceholderText('Search teams')

      await user.click(screen.getByRole('button', { name: 'Season' }))
      await user.click(await screen.findByRole('option', { name: '2020' }))

      expect(await screen.findByPlaceholderText('Search teams')).toBeInTheDocument()
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/teams?seasonId=season-1`)
      expect(mocks.listLeagueTeams).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', { activeOnly: true })

      // Replace, not push: going back leaves the league view entirely.
      await user.click(screen.getByRole('button', { name: 'Go back' }))
      expect(await screen.findByText('League List Page')).toBeInTheDocument()
    })
  })

  describe('view switcher', () => {
    beforeEach(() => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listSeasons.mockResolvedValue([makeSeason(), makeSeason({ id: 'season-2', label: '2027' })])
    })

    it('links each view and keeps the query string', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule?seasonId=season-2`)

      await screen.findByText('No fixtures yet')
      expect(screen.getByRole('tab', { name: 'Schedule' })).toHaveAttribute('href', `${LEAGUE_PATH}/schedule?seasonId=season-2`)
      expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('href', `${LEAGUE_PATH}/teams?seasonId=season-2`)
      expect(screen.getByRole('tab', { name: 'Playing Conditions' })).toHaveAttribute('href', `${LEAGUE_PATH}/conditions?seasonId=season-2`)
    })

    it.each([
      ['schedule', 'Schedule'],
      ['teams', 'Teams'],
      ['conditions', 'Playing Conditions'],
    ])('marks only %s as the active view', async (view, name) => {
      renderLeagueView(`${LEAGUE_PATH}/${view}`)

      await screen.findByRole('heading', { name: 'Internal League' })
      const tabs = screen.getAllByRole('tab')
      expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.textContent)).toEqual([name])
    })

    it('switches views without leaving the header, keeping the season', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/schedule?seasonId=season-2`)
      await screen.findByText('No fixtures yet')

      await user.click(screen.getByRole('tab', { name: 'Teams' }))

      expect(await screen.findByPlaceholderText('Search teams')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Internal League' })).toBeInTheDocument()
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/teams?seasonId=season-2`)
    })

    it('is a nav landmark and marks only the active link with aria-current="page"', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams`)

      const nav = await screen.findByRole('navigation', { name: 'League views' })
      const links = within(nav).getAllByRole('tab')
      expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent)).toEqual(['Teams'])
    })

    it('scrolls sideways inside its own strip on a phone', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByText('No fixtures yet')
      expect(document.querySelector('.MuiTabs-scroller')).toHaveStyle({ overflowX: 'auto' })
    })
  })

  // docs/specs/127-return-navigation.md
  describe('return navigation (127)', () => {
    beforeEach(() => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listSeasons.mockResolvedValue([makeSeason(), makeSeason({ id: 'season-2', label: '2027' })])
    })

    it.each(['schedule', 'teams', 'conditions'])(
      'the %s view: links that leave the page carry it (tab and season) as the origin, labelled by the tab',
      async (view) => {
        mocks.listSeasons.mockResolvedValue([makeSeason(), makeSeason({ id: 'season-2', label: '2027' })])
        const user = userEvent.setup()
        renderLeagueView(`${LEAGUE_PATH}/${view}?seasonId=season-2`)

        const origin = { to: `${LEAGUE_PATH}/${view}?seasonId=season-2`, label: `Internal League ${view}` }
        await openManage(user)
        expect(returnOf(screen.getByRole('menuitem', { name: /Edit League Details/ }).getAttribute('href'))).toEqual(origin)
        await user.keyboard('{Escape}')
        const tabLabel = { schedule: 'Manage Schedule', teams: 'Manage Teams', conditions: 'Manage Playing Conditions' }[view] as string
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
        await user.click(screen.getByRole('button', { name: tabLabel }))
        const linkNames = { schedule: [/Add Match/, /Import Schedule/], teams: [], conditions: [/Edit Playing Conditions/] }[view] as RegExp[]
        for (const name of linkNames) {
          const tabOrigin = view === 'conditions' ? { ...origin, label: 'Internal League playing conditions' } : origin
          expect(returnOf(screen.getByRole('menuitem', { name }).getAttribute('href'))).toEqual(tabOrigin)
        }
      },
    )

    it('Back reads "Back to {label}" and goes to the origin when the league page was opened with a returnTo, and the tabs keep it', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule?returnTo=${encodeURIComponent('/manage/fixtures/leagues')}&returnLabel=Leagues`)

      const back = await screen.findByRole('link', { name: 'Back to Leagues' })
      expect(back).toHaveAttribute('href', '/manage/fixtures/leagues')
      expect(screen.getByRole('tab', { name: 'Teams' }).getAttribute('href')).toContain('returnTo=')
    })

    it('does not copy its own returnTo forward to the pages it opens', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/schedule?seasonId=season-1&returnTo=${encodeURIComponent('/manage/fixtures/leagues')}&returnLabel=Leagues`)

      await user.click(await screen.findByRole('button', { name: 'Manage Schedule' }))
      const href = screen.getByRole('menuitem', { name: /Add Match/ }).getAttribute('href')
      expect(new URLSearchParams((href ?? '').split('?')[1]).getAll('returnTo')).toEqual([`${LEAGUE_PATH}/schedule?seasonId=season-1`])
    })
  })
})
