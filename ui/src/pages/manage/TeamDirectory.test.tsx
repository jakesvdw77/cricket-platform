import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamDirectory from './TeamDirectory'
import type { Team } from '../../api/teamApi'
import type { Section } from '../../api/sectionApi'
import type { Page } from '../../api/productApi'
import type { Match } from '../../api/matchApi'

const listTeamsForClub = vi.fn()
const listSections = vi.fn()
const listTeamContacts = vi.fn()
const listTeamSponsors = vi.fn()
const listSquad = vi.fn()
const listSeasons = vi.fn()
const listMatches = vi.fn()

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string, params: unknown) => listTeamsForClub(clubId, params),
  deactivateTeam: vi.fn(),
  reactivateTeam: vi.fn(),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

vi.mock('../../api/teamContactApi', () => ({
  listTeamContacts: (clubId: string, sectionId: string, teamId: string) => listTeamContacts(clubId, sectionId, teamId),
}))

vi.mock('../../api/teamSponsorApi', () => ({
  listTeamSponsors: (clubId: string, sectionId: string, teamId: string) => listTeamSponsors(clubId, sectionId, teamId),
}))

vi.mock('../../api/teamSquadApi', () => ({
  listSquad: (clubId: string, teamId: string, seasonId: string) => listSquad(clubId, teamId, seasonId),
}))

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

vi.mock('../../api/matchApi', () => ({
  listMatches: (clubId: string, params: unknown) => listMatches(clubId, params),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // docs/specs/043-list-toolbar-gold-standard.md: TeamDirectory's Section filter now persists via
  // usePersistedListFilters — clear the real jsdom localStorage so a selection made in one test
  // never leaks into the next.
  localStorage.clear()
  listTeamContacts.mockResolvedValue([])
  listTeamSponsors.mockResolvedValue([])
  listSquad.mockResolvedValue([])
  listSeasons.mockResolvedValue([])
  listMatches.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 } as Page<Match>)
})

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'test-club-id',
    sectionId: 'section-1',
    name: '1st XI',
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

function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: 'section-1',
    clubId: 'test-club-id',
    parentSectionId: null,
    name: 'Men',
    minAge: null,
    maxAge: null,
    gender: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

// TeamDirectory reads clubId only via useOutletContext, no route param — same wrapper-route
// shape as ClubContactList.test.tsx.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="address">{location.pathname + location.search}</div>
}

function renderDirectory(clubId?: string, entry = '/manage/teams') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="teams" element={<TeamDirectory />} />
            <Route path="teams/new" element={<div>Add Team Page</div>} />
            <Route path="sections/:sectionId/teams/:teamId/edit" element={<div>Edit Team Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TeamDirectory', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderDirectory(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listTeamsForClub).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listTeamsForClub.mockReturnValueOnce(new Promise(() => {}))
    listSections.mockResolvedValueOnce([])

    renderDirectory('test-club-id')

    expect(screen.queryByText('No teams yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listTeamsForClub.mockRejectedValueOnce(new Error('network error'))
    listSections.mockResolvedValueOnce([])

    renderDirectory('test-club-id')

    expect(await screen.findByText("Couldn't load teams")).toBeInTheDocument()
  })

  it('renders the "No teams yet" empty state when the club has no teams', async () => {
    listTeamsForClub.mockResolvedValueOnce([])
    listSections.mockResolvedValueOnce([])

    renderDirectory('test-club-id')

    expect(await screen.findByText('No teams yet')).toBeInTheDocument()
  })

  it('renders every team with its own leaf section name chip from more than one section', async () => {
    listTeamsForClub.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: '1st XI', sectionId: 'section-1' }),
      makeTeam({ id: 'team-2', name: 'U13 A', sectionId: 'section-2' }),
    ])
    listSections.mockResolvedValueOnce([
      makeSection({ id: 'section-1', name: 'Men' }),
      makeSection({ id: 'section-2', name: 'Juniors — U13' }),
    ])

    renderDirectory('test-club-id')

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('Men')).toBeInTheDocument()
    expect(screen.getByText('U13 A')).toBeInTheDocument()
    expect(screen.getByText('Juniors — U13')).toBeInTheDocument()
  })

  // docs/specs/057-team-extended-profile.md's approved "Detailed" card only shows the leaf
  // section's own name as a chip (not the full ancestry breadcrumb TeamCard used to show as a
  // plain field) — a deliberate design decision, not a regression.
  it('renders only the leaf section name as a chip, not the full ancestry breadcrumb', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', name: 'O/15 A', sectionId: 'o15' })])
    listSections.mockResolvedValueOnce([
      makeSection({ id: 'juniors', parentSectionId: null, name: 'Juniors' }),
      makeSection({ id: 'boys', parentSectionId: 'juniors', name: 'Boys' }),
      makeSection({ id: 'o15', parentSectionId: 'boys', name: 'O/15' }),
    ])

    renderDirectory('test-club-id')

    expect(await screen.findByText('O/15')).toBeInTheDocument()
    expect(screen.queryByText('Juniors › Boys › O/15')).not.toBeInTheDocument()
  })

  it('hides a deactivated team until Show inactive is on, then shows it with a grey Inactive chip', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ active: false })])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    expect(await screen.findByText('No matching teams')).toBeInTheDocument()
    expect(screen.queryByText('1st XI')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show Inactive' }))

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByTestId('address')).toHaveTextContent('inactive=1')
  })

  it('filters cards by the search term (matched against name)', async () => {
    listTeamsForClub.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: '1st XI' }),
      makeTeam({ id: 'team-2', name: '2nd XI' }),
    ])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    expect(screen.getByText('2nd XI')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '1st' } })

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.queryByText('2nd XI')).not.toBeInTheDocument()
  })

  it('has one filled Add New Team button on the title row, and no count text', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam()])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add New Team' }).filter((button) => button.getAttribute('data-testid') !== 'add-team-card')).toHaveLength(1)
    expect(screen.queryByText(/Showing \d+/)).not.toBeInTheDocument()
  })

  it('clicking Add New Team on the title row navigates to the club-wide create route', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([makeTeam()])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    const title = screen.getAllByRole('button', { name: 'Add New Team' }).find((button) => button.getAttribute('data-testid') !== 'add-team-card') as HTMLElement
    await user.click(title)

    expect(await screen.findByText('Add Team Page')).toBeInTheDocument()
  })

  it('ends the card grid with a dashed Add New Team card that opens the same create route', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([makeTeam()])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    expect(within(screen.getByTestId('add-team-card')).getByText('Add New Team')).toBeInTheDocument()
    await user.click(screen.getByTestId('add-team-card'))

    expect(await screen.findByText('Add Team Page')).toBeInTheDocument()
  })

  it('the first-team empty state offers Add New Team and no dashed card', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([])
    listSections.mockResolvedValueOnce([])

    renderDirectory('test-club-id')

    await screen.findByText('No teams yet')
    expect(screen.queryByTestId('add-team-card')).not.toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'Add New Team' })
    expect(buttons).toHaveLength(2)
    await user.click(buttons[1])
    expect(await screen.findByText('Add Team Page')).toBeInTheDocument()
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the list card at all — active or inactive — it moved to TeamFormPage's own actions bar.
  it('never renders a Deactivate/Reactivate button on the card, active or inactive', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: '1st XI', active: true, sectionId: 'section-1' }),
      makeTeam({ id: 'team-2', name: '2nd XI', active: false, sectionId: 'section-1' }),
    ])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    await user.click(screen.getByRole('button', { name: 'Show Inactive' }))
    expect(await screen.findByText('2nd XI')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actions for 2nd XI' }))
    expect(screen.queryByRole('menuitem', { name: /deactivate|reactivate/i })).not.toBeInTheDocument()
  })

  // docs/specs/036-view-first-record-detail-screens.md: the card's primary click target is
  // "View" (into TeamDetailPage), not a direct Edit link — Edit lives on that view screen instead.
  // docs/specs/059-record-card-click-to-view.md: the title itself is now the "View" link (a
  // stretched-link covering the whole card) — there is no separately-labeled "View" link/button.
  // docs/specs/057-team-extended-profile.md: TeamDirectory's own links add no `?from=` marker (the
  // club-wide-origin default) — unlike TeamList.tsx's own `?from=section` links.
  it('the title link on a team card targets the section-scoped view route with no ?from= marker', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', sectionId: 'section-1', name: '1st XI' })])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    const viewLink = await screen.findByRole('link', { name: '1st XI' })
    const href = viewLink.getAttribute('href') as string
    expect(href.startsWith('/manage/sections/section-1/teams/team-1?')).toBe(true)
    expect(href).not.toContain('from=')
    expect(href).toContain('returnTo=')
    expect(href).toContain('returnLabel=Teams')
  })

  // docs/specs/142: the card has no footer bar; Open Team, Edit Team and View Stats live in the one kebab, each carrying returnTo.
  it('the kebab (TeamActionsMenu) lists Open Team, Edit Team, View Stats and View Squad, each carrying returnTo', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', sectionId: 'section-1' })])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id', '/manage/teams?sort=desc')

    await screen.findByText('1st XI')
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actions for 1st XI' }))
    const items = screen.getAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Open Team', 'Edit Team', 'View Stats', 'View Squad'])
    for (const item of items) {
      const href = item.getAttribute('href') as string
      expect(href).toContain('returnTo=')
      expect(decodeURIComponent(href)).toContain('sort=desc')
      expect(href).toContain('returnLabel=Teams')
    }
    expect(screen.getByRole('menuitem', { name: 'Edit Team' }).getAttribute('href')).toContain('/manage/sections/section-1/teams/team-1/edit?returnTo=')
  })

  it('selecting a section in the filter re-fetches with the sectionId param, clearing it removes it', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1' })])
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'Men' })])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    expect(listTeamsForClub).toHaveBeenCalledWith('test-club-id', { sectionId: undefined })

    await user.click(screen.getByLabelText('Section'))
    await user.click(within(screen.getByRole('treeitem', { name: 'Men' })).getByText('Men'))

    expect(await screen.findByLabelText('Section')).toHaveValue('Men')
    await waitFor(() => expect(listTeamsForClub).toHaveBeenCalledWith('test-club-id', { sectionId: 'section-1' }))

    await user.click(screen.getByLabelText('Section'))
    await user.click(screen.getByRole('button', { name: /all sections/i }))

    await waitFor(() =>
      expect(listTeamsForClub).toHaveBeenLastCalledWith('test-club-id', { sectionId: undefined }),
    )
  })

  // docs/specs/043-list-toolbar-gold-standard.md: the Sort Select was replaced by a compact icon
  // toggle — this exercises the previously-dead `direction === 'desc'` branch for real, not just
  // visually.
  it('clicking the sort icon reverses the card order, and flips its own accessible name', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: 'Alpha XI' }),
      makeTeam({ id: 'team-2', name: 'Zeta XI' }),
    ])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    await screen.findByText('Alpha XI')
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual(['Alpha XI', 'Zeta XI'])

    await user.click(screen.getByRole('button', { name: /sort: name, a to z/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Name, Z to A' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual(['Zeta XI', 'Alpha XI'])
    expect(screen.getByRole('button', { name: /sort: name, z to a/i })).toBeInTheDocument()
    expect(screen.getByTestId('address')).toHaveTextContent('sort=desc')
  })

  it('reads the sort, quick filter and Show Inactive from the address, so Back restores them', async () => {
    listTeamsForClub.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: 'Alpha XI' }),
      makeTeam({ id: 'team-2', name: 'Zeta XI' }),
      makeTeam({ id: 'team-3', name: 'Old XI', active: false }),
    ])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id', '/manage/teams?sort=desc&inactive=1&focus=empty')

    await screen.findByText('Zeta XI')
    expect(screen.getByRole('button', { name: /sort: name, z to a/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Inactive' })).toHaveAttribute('aria-pressed', 'true')
    // All squads are empty, so the Empty Squads quick filter keeps the active teams (the inactive one is not an attention case), Z to A.
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual(['Zeta XI', 'Alpha XI'])
    await waitFor(() => expect(screen.getByTestId('page-counter-empty')).toHaveAttribute('aria-pressed', 'true'))
  })

  it('orders the toolbar Show Inactive, Sort, then Cards | List last', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam()])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    const toggle = screen.getByRole('button', { name: 'Show Inactive' })
    const sort = screen.getByRole('button', { name: /sort: name, a to z/i })
    const cards = screen.getAllByRole('button', { name: 'Cards' })[0]
    expect(toggle.compareDocumentPosition(sort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sort.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: Section selection persists per club across
  // visits — Search stays a separate, non-persisted useState. Mirrors MatchList.test.tsx's own
  // persistence assertions.
  it('reapplies a persisted section filter on mount, and never persists the search text', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValue([makeTeam({ id: 'team-1', sectionId: 'section-1' })])
    listSections.mockResolvedValue([makeSection({ id: 'section-1', name: 'Men' })])
    localStorage.setItem('teamList:filters:test-club-id', JSON.stringify({ sectionId: 'section-1' }))

    renderDirectory('test-club-id')

    await waitFor(() => expect(listTeamsForClub).toHaveBeenCalledWith('test-club-id', { sectionId: 'section-1' }))
    expect(await screen.findByLabelText('Section')).toHaveValue('Men')

    await user.type(screen.getByLabelText('Search'), '1st')

    const persisted = JSON.parse(localStorage.getItem('teamList:filters:test-club-id') as string)
    expect(persisted).toEqual({ sectionId: 'section-1' })
    expect(persisted).not.toHaveProperty('search')
  })

  // docs/specs/057-team-extended-profile.md / 092: the card's captain/manager/coach rows and Players / Matches
  // figure tiles, resolved client-side.
  it('resolves and renders captain/manager/coach/player-count/match-count on the card', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', sectionId: 'section-1', groundName: 'Irene Country Club' })])
    listSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'Men' })])
    listSeasons.mockResolvedValueOnce([
      { id: 'season-1', clubId: 'test-club-id', label: '2026', startDate: '2026-01-01', endDate: '2026-12-31', active: true, createdAt: '', updatedAt: '', updatedBy: null },
    ])
    listSquad.mockResolvedValueOnce([
      {
        id: 'squad-1',
        personId: 'person-1',
        clubId: 'test-club-id',
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: null,
        gender: null,
        photoUrl: null,
        clubMembershipNumber: null,
        medicalAidProvider: null,
        medicalAidMemberNumber: null,
        phone: null,
        email: null,
        altContactName: null,
        altContactPhone: null,
        battingStance: null,
        bowlingArm: null,
        bowlingType: null,
        isWicketKeeper: false,
        active: true,
        sectionIds: [],
        jerseyNumber: null,
        createdAt: '',
        updatedAt: '',
        updatedBy: null,
        playerProfileId: 'player-1',
        squadJerseyNumber: null,
        isCaptain: true,
      },
    ])
    listTeamContacts.mockResolvedValueOnce([
      {
        id: 'tc-1',
        contact: {
          id: 'contact-1',
          clubId: 'test-club-id',
          contact: { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', phone: '+27' },
          role: 'Treasurer',
          isPrimary: false,
          active: true,
          photoUrl: null,
          createdAt: '',
          updatedAt: '',
          updatedBy: null,
        },
        role: 'Manager',
        createdAt: '',
      },
    ])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    const rows = () => screen.getAllByTestId('team-detail-row').map((row) => row.textContent)
    await waitFor(() => expect(rows()).toEqual(['Players1', 'Matches0', 'CaptainJane Smith', 'ManagerBob Jones', 'Coach–']))
  })
})
