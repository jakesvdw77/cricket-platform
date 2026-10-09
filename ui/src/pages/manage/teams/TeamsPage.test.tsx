import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamsPage } from './TeamsPage'
import type { TeamsScope } from './TeamsPage'
import type { Team } from '../../../api/teamApi'

const listTeamsForClub = vi.fn()
const listTeamsForSection = vi.fn()
const listSections = vi.fn()
const listSeasons = vi.fn()
const listTeamContacts = vi.fn()
const listTeamSponsors = vi.fn()
const listSquad = vi.fn()
const listMatches = vi.fn()

vi.mock('../../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string, params: unknown) => listTeamsForClub(clubId, params),
  listTeamsForSection: (clubId: string, sectionId: string) => listTeamsForSection(clubId, sectionId),
}))
vi.mock('../../../api/sectionApi', () => ({ listSections: (clubId: string) => listSections(clubId) }))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: (clubId: string) => listSeasons(clubId) }))
vi.mock('../../../api/teamContactApi', () => ({
  listTeamContacts: (clubId: string, sectionId: string, teamId: string) => listTeamContacts(clubId, sectionId, teamId),
}))
vi.mock('../../../api/teamSponsorApi', () => ({
  listTeamSponsors: (clubId: string, sectionId: string, teamId: string) => listTeamSponsors(clubId, sectionId, teamId),
}))
vi.mock('../../../api/teamSquadApi', () => ({
  listSquad: (clubId: string, teamId: string, seasonId: string) => listSquad(clubId, teamId, seasonId),
}))
vi.mock('../../../api/matchApi', () => ({ listMatches: (clubId: string, params: unknown) => listMatches(clubId, params) }))

const SEASONS = [
  { id: 'season-2025', clubId: 'club-1', label: '2025', startDate: '2025-01-01', endDate: '2025-12-31', active: true, createdAt: '2025-01-01', updatedAt: '', updatedBy: null },
  { id: 'season-2026', clubId: 'club-1', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '2026-01-01', updatedAt: '', updatedBy: null },
]

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'club-1',
    sectionId: 'section-1',
    name: '1st XI',
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active: true,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

const member = (isCaptain: boolean, n = 1) => ({ id: `m${n}`, firstName: 'Jane', lastName: `S${n}`, isCaptain })

// 1st XI: 2 players with a captain; 2nd XI: 1 player, no captain; Colts: empty squad; Veterans: inactive, empty squad.
const TEAMS = [
  makeTeam({ id: 'a', name: '1st XI' }),
  makeTeam({ id: 'b', name: '2nd XI' }),
  makeTeam({ id: 'c', name: 'Colts' }),
  makeTeam({ id: 'd', name: 'Veterans', active: false }),
]
const SQUADS: Record<string, unknown[]> = { a: [member(true, 1), member(false, 2)], b: [member(false, 3)], c: [], d: [] }

function renderPage(scope: TeamsScope = { kind: 'club' }, clubId: string | undefined = 'club-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeamsPage clubId={clubId} scope={scope} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const counterValue = (id: string) => within(screen.getByTestId(`page-counter-${id}`)).getByTestId('page-counter-value')
const names = () => screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)

describe('TeamsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    listTeamsForClub.mockResolvedValue(TEAMS)
    listTeamsForSection.mockResolvedValue(TEAMS)
    listSections.mockResolvedValue([{ id: 'section-1', clubId: 'club-1', parentSectionId: null, name: 'Men', minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null }])
    listSeasons.mockResolvedValue(SEASONS)
    listTeamContacts.mockResolvedValue([])
    listTeamSponsors.mockResolvedValue([])
    listSquad.mockImplementation((_club: string, teamId: string) => Promise.resolve(SQUADS[teamId] ?? []))
    listMatches.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 200 })
  })

  describe('counters', () => {
    it('shows Active teams, Players in squads, Matches this week, No captain and Empty squads for the shown (active) teams', async () => {
      renderPage()

      await screen.findByText('1st XI')
      await waitFor(() => expect(counterValue('players')).toHaveTextContent('3'))
      expect(counterValue('active')).toHaveTextContent('3')
      expect(counterValue('this-week')).toHaveTextContent('0')
      expect(counterValue('no-captain')).toHaveTextContent('2')
      expect(counterValue('empty')).toHaveTextContent('1')
    })

    it('shows a dash for the figures that depend on the squads until they have loaded', async () => {
      listSquad.mockReturnValue(new Promise(() => {}))
      renderPage()

      await screen.findByText('1st XI')
      expect(counterValue('active')).toHaveTextContent('3')
      expect(counterValue('players')).toHaveTextContent('–')
      expect(counterValue('no-captain')).toHaveTextContent('–')
      expect(counterValue('empty')).toHaveTextContent('–')
    })

    it('filters the list to No captain, then Empty squads, and a second click clears the filter', async () => {
      const user = userEvent.setup()
      renderPage()

      await screen.findByText('1st XI')
      await waitFor(() => expect(counterValue('no-captain')).toHaveTextContent('2'))

      await user.click(screen.getByTestId('page-counter-no-captain'))
      expect(names()).toEqual(['2nd XI', 'Colts'])
      expect(screen.getByText(/Showing 2 teams · No captain/)).toBeInTheDocument()

      await user.click(screen.getByTestId('page-counter-empty'))
      expect(names()).toEqual(['Colts'])

      await user.click(screen.getByTestId('page-counter-empty'))
      expect(names()).toEqual(['1st XI', '2nd XI', 'Colts'])
    })

    it('counts inactive teams as active-only for attention and includes them in the figures once Show inactive is on', async () => {
      const user = userEvent.setup()
      renderPage()

      await screen.findByText('1st XI')
      await waitFor(() => expect(counterValue('players')).toHaveTextContent('3'))
      await user.click(screen.getByRole('checkbox', { name: /show inactive/i }))

      expect(await screen.findByText('Veterans')).toBeInTheDocument()
      expect(counterValue('active')).toHaveTextContent('3')
      expect(counterValue('empty')).toHaveTextContent('1')
    })

    it('names the quick filter in the empty state when the search leaves nothing', async () => {
      const user = userEvent.setup()
      renderPage()

      await screen.findByText('1st XI')
      await waitFor(() => expect(counterValue('empty')).toHaveTextContent('1'))
      await user.click(screen.getByTestId('page-counter-empty'))
      await user.type(screen.getByLabelText('Search'), 'zzz')

      expect(await screen.findByText('No matching teams')).toBeInTheDocument()
      expect(screen.getByText('No teams match "zzz". Try a different search.')).toBeInTheDocument()
    })
  })

  describe('season', () => {
    it('defaults to the season containing today, and the pill re-reads the squads for the chosen season and remembers it', async () => {
      const user = userEvent.setup()
      renderPage()

      await screen.findByText('1st XI')
      await waitFor(() => expect(listSquad).toHaveBeenCalled())
      const pill = screen.getByRole('button', { name: 'Season' })
      expect(pill).toHaveTextContent('2026')
      expect(screen.queryByRole('option', { name: 'All seasons' })).not.toBeInTheDocument()

      await user.click(pill)
      await user.click(await screen.findByRole('option', { name: '2025' }))

      await waitFor(() => expect(listSquad).toHaveBeenCalledWith('club-1', 'a', 'season-2025'))
      expect(JSON.parse(localStorage.getItem('teamList:filters:club-1') as string)).toEqual({ sectionId: null, seasonId: 'season-2025' })
    })

    it('carries the chosen season to the team page links', async () => {
      renderPage()

      expect(await screen.findByRole('link', { name: '1st XI' })).toHaveAttribute('href', '/manage/sections/section-1/teams/a?seasonId=season-2026')
    })
  })

  describe('list view', () => {
    it('shows cards by default, switches to the table, shows its rows and remembers the choice', async () => {
      const user = userEvent.setup()
      const { unmount } = renderPage()

      await screen.findByText('1st XI')
      expect(screen.queryByRole('table', { name: 'Teams' })).not.toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: 'List' })[0])
      const table = await screen.findByRole('table', { name: 'Teams' })
      expect(within(table).getAllByTestId('team-row')).toHaveLength(3)
      expect(localStorage.getItem('teamList:view')).toBe('list')
      unmount()

      renderPage()
      expect(await screen.findByRole('table', { name: 'Teams' })).toBeInTheDocument()
    })
  })

  describe('scope', () => {
    it('club-wide: offers the Section filter and requests the club teams, not one section', async () => {
      renderPage({ kind: 'club' })

      await screen.findByText('1st XI')
      expect(screen.getByLabelText('Section')).toBeInTheDocument()
      expect(listTeamsForClub).toHaveBeenCalledWith('club-1', { sectionId: undefined })
      expect(listTeamsForSection).not.toHaveBeenCalled()
    })

    it('section-scoped: no Section filter, requests that section, keeps the title, back link and ?from=section links', async () => {
      localStorage.setItem('teamList:filters:club-1', JSON.stringify({ sectionId: 'other', seasonId: '' }))
      renderPage({ kind: 'section', sectionId: 'section-1' })

      expect(await screen.findByText('Teams — Men')).toBeInTheDocument()
      await screen.findByText('1st XI')
      expect(screen.queryByLabelText('Section')).not.toBeInTheDocument()
      expect(listTeamsForSection).toHaveBeenCalledWith('club-1', 'section-1')
      expect(listTeamsForClub).not.toHaveBeenCalled()
      expect(screen.getByRole('link', { name: /Back to Club Structure/ })).toHaveAttribute('href', '/manage/sections')
      expect(screen.getByRole('link', { name: '1st XI' })).toHaveAttribute('href', expect.stringContaining('?from=section'))
      expect(screen.getAllByRole('link', { name: 'Edit' })[0]).toHaveAttribute('href', '/manage/sections/section-1/teams/a/edit?from=section')
    })
  })

  describe('states', () => {
    it('says every team is inactive when only inactive teams exist and Show inactive is off', async () => {
      listTeamsForClub.mockResolvedValue([makeTeam({ active: false })])
      renderPage()

      expect(await screen.findByText('No matching teams')).toBeInTheDocument()
      expect(screen.getByText(/Turn on Show inactive/)).toBeInTheDocument()
    })

    it('shows the first-team empty state for a section with none', async () => {
      listTeamsForSection.mockResolvedValue([])
      renderPage({ kind: 'section', sectionId: 'section-1' })

      expect(await screen.findByText('No teams yet')).toBeInTheDocument()
      expect(screen.getByText("Add this section's first team to get started.")).toBeInTheDocument()
    })
  })
})
