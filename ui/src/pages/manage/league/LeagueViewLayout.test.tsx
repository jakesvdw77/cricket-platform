import { configure, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
}))

vi.mock('../../../api/leagueApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/leagueApi')>()),
  listLeagues: (clubId: string) => mocks.listLeagues(clubId),
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
})

const LEAGUE_PATH = '/manage/fixtures/leagues/league-1'

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

  describe('routes', () => {
    beforeEach(() => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listSeasons.mockResolvedValue([makeSeason()])
    })

    it('redirects the bare league URL to the Schedule', async () => {
      renderLeagueView(LEAGUE_PATH)

      expect(await screen.findByRole('heading', { name: 'Fixtures' })).toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent(`${LEAGUE_PATH}/schedule`)
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/schedule`)
    })

    it('keeps ?seasonId= through the redirect', async () => {
      mocks.listSeasons.mockResolvedValue([makeSeason(), makeSeason({ id: 'season-2', label: '2027' })])

      renderLeagueView(`${LEAGUE_PATH}?seasonId=season-2`)

      expect(await screen.findByRole('heading', { name: 'Fixtures' })).toBeInTheDocument()
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/schedule?seasonId=season-2`)
    })

    it('replaces the bare URL in history rather than pushing the redirect', async () => {
      renderLeagueView(['/manage/fixtures/leagues', LEAGUE_PATH])
      await screen.findByRole('heading', { name: 'Fixtures' })

      await userEvent.setup().click(screen.getByRole('button', { name: 'Go back' }))

      expect(await screen.findByText('League List Page')).toBeInTheDocument()
    })

    it('renders only the Schedule section on /schedule', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      expect(await screen.findByRole('heading', { name: 'Fixtures' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /^Teams in/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Playing conditions' })).not.toBeInTheDocument()
    })

    it('renders only the Teams section on /teams', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams`)

      expect(await screen.findByRole('heading', { name: 'Teams in 2026' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Fixtures' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Playing conditions' })).not.toBeInTheDocument()
    })

    it('renders only the Conditions section on /conditions', async () => {
      renderLeagueView(`${LEAGUE_PATH}/conditions`)

      expect(await screen.findByRole('heading', { name: 'Playing conditions' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Fixtures' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /^Teams in/ })).not.toBeInTheDocument()
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

    it('lays the rows out in order: Back, badges and Season; logo/name and Edit; divider; people; links', async () => {
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
      const badges = within(topRow).getByLabelText('League badges')
      const season = within(topRow).getByRole('combobox', { name: 'Season' })
      const edit = within(titleRow).getByRole('link', { name: 'Edit' })
      const people = screen.getByTestId('league-header-contact-people')
      const links = screen.getByTestId('league-header-links-row')

      expect(following(back, badges)).toBe(true)
      expect(following(badges, season)).toBe(true)
      expect(following(topRow, titleRow)).toBe(true)
      expect(within(titleRow).getByRole('heading', { name: 'Internal League' })).toBe(heading)
      expect(following(heading, edit)).toBe(true)
      expect(following(titleRow, screen.getByRole('separator'))).toBe(true)
      expect(following(screen.getByRole('separator'), people)).toBe(true)
      expect(following(people, links)).toBe(true)
    })

    it('keeps Edit on the title row (no wrap, not shrinking) and lets the name wrap', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const heading = await screen.findByRole('heading', { name: 'Internal League' })
      const titleRow = screen.getByTestId('league-header-title-row')
      const edit = within(titleRow).getByRole('link', { name: 'Edit' })

      expect(getComputedStyle(titleRow).flexWrap).toBe('nowrap')
      expect(getComputedStyle(titleRow).justifyContent).toBe('space-between')
      expect(getComputedStyle(edit).flex).toMatch(/^(none|0 0 auto)$/)
      expect(getComputedStyle(heading).overflowWrap).toBe('anywhere')
      expect(getComputedStyle(heading).textOverflow).not.toBe('ellipsis')
      expect(getComputedStyle(heading.parentElement as HTMLElement).minWidth).toMatch(/^0(px)?$/)
    })

    it('shares the top row between Back (left) and the badges and Season (right)', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByRole('heading', { name: 'Internal League' })
      const topRow = screen.getByTestId('league-header-top-row')

      expect(getComputedStyle(topRow).justifyContent).toBe('space-between')
      expect(getComputedStyle(topRow).flexWrap).toBe('wrap')
      expect(within(topRow).getByLabelText('League badges')).toBeInTheDocument()
      expect(within(topRow).getByRole('combobox', { name: 'Season' })).toBeInTheDocument()
      expect(within(topRow).queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
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

    it('points Edit at the league edit route', async () => {
      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute('href', `${LEAGUE_PATH}/edit`)
    })

    it('renders the format badge only when the league has a format', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ format: 'ONE_DAY' })])
      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/schedule`)
      expect(await within(await screen.findByLabelText('League badges')).findByText('1 Day')).toBeInTheDocument()
      unmount()

      mocks.listLeagues.mockResolvedValue([makeLeague({ format: null })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)
      const badges = await screen.findByLabelText('League badges')
      expect(within(badges).getAllByText(/./).map((node) => node.textContent)).toEqual(['0 teams', 'Active'])
    })

    it('counts the selected season\'s affiliated teams plus its active league teams, not league.currentSeasonTeamCount', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague({ currentSeasonTeamCount: 99 })])
      mocks.listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1' }), makeTeam({ id: 'team-2', name: '2nd XI' })])
      mocks.listLeagueAffiliations.mockResolvedValue([
        makeAffiliation({ id: 'a1', teamId: 'team-1' }),
        makeAffiliation({ id: 'a2', teamId: 'team-2' }),
        makeAffiliation({ id: 'a3', teamId: 'team-2', seasonId: 'other-season' }),
      ])
      mocks.listLeagueTeams.mockResolvedValue([makeLeagueTeam({ id: 'lt1' })])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      expect(await within(await screen.findByLabelText('League badges')).findByText('3 teams')).toBeInTheDocument()
      expect(screen.queryByText(/99/)).not.toBeInTheDocument()
      expect(mocks.listLeagueTeams).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', { activeOnly: true })
    })

    it('uses the singular for one team and shows Active or Inactive', async () => {
      mocks.listTeamsForClub.mockResolvedValue([makeTeam()])
      mocks.listLeagueAffiliations.mockResolvedValue([makeAffiliation()])
      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/schedule`)
      const badges = await screen.findByLabelText('League badges')
      expect(await within(badges).findByText('1 team')).toBeInTheDocument()
      expect(within(badges).getByText('Active')).toBeInTheDocument()
      unmount()

      mocks.listLeagues.mockResolvedValue([makeLeague({ active: false })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)
      expect(within(await screen.findByLabelText('League badges')).getByText('Inactive')).toBeInTheDocument()
    })

    it('hides the Season select when the club has no seasons', async () => {
      mocks.listSeasons.mockResolvedValue([])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument()
    })
  })

  describe('contact section', () => {
    it('shows only the set phone, email and website as tel:, mailto: and external links, then the social icons in their own slot', async () => {
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

      const social = within(row).getByTestId('league-header-social')
      expect(within(social).getByRole('link', { name: 'Facebook' })).toHaveAttribute(
        'href',
        'https://facebook.com/riverside-premier',
      )
      expect(following(website, social)).toBe(true)
      // Links sit left and the social slot right when they share a line; the row wraps so the social
      // icons drop under the links, left-aligned, when it is too narrow.
      expect(getComputedStyle(row).justifyContent).toBe('space-between')
      expect(getComputedStyle(row).flexWrap).toBe('wrap')
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

    it('omits the whole contact section, divider included, when there is nothing to show', async () => {
      mocks.listLeagues.mockResolvedValue([makeLeague()])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      await screen.findByRole('heading', { name: 'Internal League' })
      expect(screen.queryByRole('separator')).not.toBeInTheDocument()
      expect(screen.queryByTestId('league-header-contact-people')).not.toBeInTheDocument()
      expect(screen.queryByTestId('league-header-links-row')).not.toBeInTheDocument()
      expect(screen.queryByText('No contacts yet for this league.')).not.toBeInTheDocument()
    })

    it('renders contact people avatars first, then opens a quick view with Role/Email/Phone and the edit route', async () => {
      const user = userEvent.setup()
      mocks.listLeagues.mockResolvedValue([makeLeague({ phone: '+27 21 555 0199' })])
      mocks.listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1' })])

      renderLeagueView(`${LEAGUE_PATH}/schedule`)

      const people = await screen.findByTestId('league-header-contact-people')
      expect(following(people, screen.getByTestId('league-header-links-row'))).toBe(true)
      expect(within(people).getByText('League contacts')).toBeInTheDocument()
      expect(mocks.listLeagueContacts).toHaveBeenCalledWith('test-club-id', 'league-1')

      await user.click(within(people).getByRole('button', { name: 'Jane Smith — League Administrator' }))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
      expect(screen.getByText('+27 21 555 0100')).toBeInTheDocument()
      // The dialog hides the page behind it from the accessibility tree, so this is its own Edit link.
      expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        `${LEAGUE_PATH}/contacts/contact-1/edit`,
      )
    })

    it('shows a Status field for the primary contact and none for a non-primary one', async () => {
      const user = userEvent.setup()
      mocks.listLeagues.mockResolvedValue([makeLeague()])
      mocks.listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1', isPrimary: true })])

      const { unmount } = renderLeagueView(`${LEAGUE_PATH}/schedule`)
      await user.click(await screen.findByRole('button', { name: 'Jane Smith — League Administrator' }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Primary')).toBeInTheDocument()
      unmount()

      mocks.listLeagueContacts.mockResolvedValue([makeContact({ id: 'contact-1', isPrimary: false, active: true })])
      renderLeagueView(`${LEAGUE_PATH}/schedule`)
      await user.click(await screen.findByRole('button', { name: 'Jane Smith — League Administrator' }))
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

      expect(await screen.findByRole('heading', { name: 'Teams in 2021' })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Season' })).toHaveTextContent('2021')
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/teams`)
    })

    it('honours a valid ?seasonId=', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams?seasonId=season-1`)

      expect(await screen.findByRole('heading', { name: 'Teams in 2020' })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Season' })).toHaveTextContent('2020')
      expect(mocks.listLeagueTeams).toHaveBeenCalledWith('test-club-id', 'league-1', 'season-1', { activeOnly: true })
    })

    it('silently falls back to the default for an invalid ?seasonId=', async () => {
      renderLeagueView(`${LEAGUE_PATH}/teams?seasonId=not-a-season`)

      expect(await screen.findByRole('heading', { name: 'Teams in 2021' })).toBeInTheDocument()
      expect(screen.getByTestId('location').textContent).toBe(`${LEAGUE_PATH}/teams?seasonId=not-a-season`)
    })

    it('writes a user change to ?seasonId= with replace and re-scopes the view', async () => {
      const user = userEvent.setup()
      renderLeagueView(['/manage/fixtures/leagues', `${LEAGUE_PATH}/teams`])
      await screen.findByRole('heading', { name: 'Teams in 2021' })

      await user.click(screen.getByRole('combobox', { name: 'Season' }))
      await user.click(await screen.findByRole('option', { name: '2020' }))

      expect(await screen.findByRole('heading', { name: 'Teams in 2020' })).toBeInTheDocument()
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

      await screen.findByRole('heading', { name: 'Fixtures' })
      expect(screen.getByRole('tab', { name: 'Schedule' })).toHaveAttribute('href', `${LEAGUE_PATH}/schedule?seasonId=season-2`)
      expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('href', `${LEAGUE_PATH}/teams?seasonId=season-2`)
      expect(screen.getByRole('tab', { name: 'Conditions' })).toHaveAttribute('href', `${LEAGUE_PATH}/conditions?seasonId=season-2`)
    })

    it.each([
      ['schedule', 'Schedule'],
      ['teams', 'Teams'],
      ['conditions', 'Conditions'],
    ])('marks only %s as the active view', async (view, name) => {
      renderLeagueView(`${LEAGUE_PATH}/${view}`)

      await screen.findByRole('heading', { name: 'Internal League' })
      const tabs = screen.getAllByRole('tab')
      expect(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').map((tab) => tab.textContent)).toEqual([name])
    })

    it('switches views without leaving the header, keeping the season', async () => {
      const user = userEvent.setup()
      renderLeagueView(`${LEAGUE_PATH}/schedule?seasonId=season-2`)
      await screen.findByRole('heading', { name: 'Fixtures' })

      await user.click(screen.getByRole('tab', { name: 'Teams' }))

      expect(await screen.findByRole('heading', { name: 'Teams in 2027' })).toBeInTheDocument()
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

      await screen.findByRole('heading', { name: 'Fixtures' })
      expect(document.querySelector('.MuiTabs-scroller')).toHaveStyle({ overflowX: 'auto' })
    })
  })
})
