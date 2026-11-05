import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamList from './TeamList'
import type { Team } from '../../api/teamApi'
import type { Section } from '../../api/sectionApi'
import type { Page } from '../../api/productApi'
import type { Match } from '../../api/matchApi'

const listTeamsForSection = vi.fn()
const listSections = vi.fn()
const listTeamContacts = vi.fn()
const listTeamSponsors = vi.fn()
const listSquad = vi.fn()
const listSeasons = vi.fn()
const listMatches = vi.fn()

// Mirrors SponsorContactList.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/teamApi', () => ({
  listTeamsForSection: (clubId: string, sectionId: string) => listTeamsForSection(clubId, sectionId),
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
  listSections.mockResolvedValue([])
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
    sectionId: 'test-section-id',
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
    id: 'test-section-id',
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

// TeamList reads clubId via useOutletContext (normally threaded through by ManagerHome's own
// <Outlet context={{ clubId }} />) and sectionId via useParams — same wrapper-route shape as
// SponsorContactList.test.tsx, reproduced here without pulling ManagerHome in.
function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderList(clubId?: string, sectionId = 'test-section-id') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/manage/sections/${sectionId}/teams`]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="sections/:sectionId/teams" element={<TeamList />} />
            <Route path="sections/:sectionId/teams/new" element={<div>Add Team Page</div>} />
            <Route path="sections/:sectionId/teams/:teamId/edit" element={<div>Edit Team Page</div>} />
            <Route path="sections" element={<div>Club Structure Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TeamList', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderList(undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listTeamsForSection).not.toHaveBeenCalled()
  })

  it('renders nothing while the list is loading', () => {
    listTeamsForSection.mockReturnValueOnce(new Promise(() => {}))

    renderList('test-club-id')

    expect(screen.queryByText('No teams yet')).not.toBeInTheDocument()
    expect(screen.queryByText('Not authorized')).not.toBeInTheDocument()
  })

  it('renders an error state when the fetch fails', async () => {
    listTeamsForSection.mockRejectedValueOnce(new Error('network error'))

    renderList('test-club-id')

    expect(await screen.findByText("Couldn't load teams")).toBeInTheDocument()
  })

  it('renders the "No teams yet" empty state when the section has no teams', async () => {
    listTeamsForSection.mockResolvedValueOnce([])

    renderList('test-club-id')

    expect(await screen.findByText('No teams yet')).toBeInTheDocument()
  })

  it('renders the section name in the page header once sections load', async () => {
    listTeamsForSection.mockResolvedValueOnce([])
    listSections.mockResolvedValueOnce([makeSection()])

    renderList('test-club-id')

    expect(await screen.findByText('Men', { selector: '[data-testid="header-subtitle"]' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument()
  })

  it('renders the full section-ancestry breadcrumb in the page header, not just the immediate section name', async () => {
    listTeamsForSection.mockResolvedValueOnce([])
    listSections.mockResolvedValueOnce([
      makeSection({ id: 'juniors', parentSectionId: null, name: 'Juniors' }),
      makeSection({ id: 'boys', parentSectionId: 'juniors', name: 'Boys' }),
      makeSection({ id: 'test-section-id', parentSectionId: 'boys', name: 'O/15' }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('Juniors › Boys › O/15', { selector: '[data-testid="header-subtitle"]' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument()
  })

  it('hides a deactivated team until Show inactive is on, then shows it with a grey Inactive chip', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: '1st XI' }),
      makeTeam({ id: 'team-2', name: '2nd XI', active: false }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.queryByText('2nd XI')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show Inactive' }))

    expect(await screen.findByText('2nd XI')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('filters cards by the search term (matched against name)', async () => {
    listTeamsForSection.mockResolvedValueOnce([makeTeam({ id: 'team-1', name: '1st XI' }), makeTeam({ id: 'team-2', name: '2nd XI' })])

    renderList('test-club-id')

    await screen.findByText('1st XI')
    expect(screen.getByText('2nd XI')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '1st' } })

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.queryByText('2nd XI')).not.toBeInTheDocument()
  })

  it('clicking Add New Team navigates to the section-scoped create route', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([makeTeam()])

    renderList('test-club-id')

    await screen.findByText('1st XI')
    const title = screen.getAllByRole('button', { name: 'Add New Team' }).find((button) => button.getAttribute('data-testid') !== 'add-team-card') as HTMLElement
    await user.click(title)

    expect(await screen.findByText('Add Team Page')).toBeInTheDocument()
  })

  it('the dashed Add New Team card also opens the section-scoped create route', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([makeTeam()])

    renderList('test-club-id')

    await screen.findByText('1st XI')
    await user.click(screen.getByTestId('add-team-card'))

    expect(await screen.findByText('Add Team Page')).toBeInTheDocument()
  })

  // docs/specs/038-move-deactivate-to-edit-screen.md: Deactivate/Reactivate no longer renders on
  // the list card at all — active or inactive — it moved to TeamFormPage's own actions bar.
  it('never renders a Deactivate/Reactivate button on the card, active or inactive', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: '1st XI', active: true }),
      makeTeam({ id: 'team-2', name: '2nd XI', active: false }),
    ])

    renderList('test-club-id')

    await screen.findByText('1st XI')
    await user.click(screen.getByRole('button', { name: 'Show Inactive' }))
    expect(await screen.findByText('2nd XI')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actions for 2nd XI' }))
    expect(screen.queryByRole('menuitem', { name: /deactivate|reactivate/i })).not.toBeInTheDocument()
  })

  // docs/specs/043-list-toolbar-gold-standard.md: the Sort Select was replaced by a compact icon
  // toggle — this exercises the previously-dead `direction === 'desc'` branch for real, not just
  // visually. TeamList has no Section filter of its own (nested under a fixed section route), so
  // it needs only this sort-toggle coverage, no persistence test.
  it('clicking the sort icon reverses the card order, and flips its own accessible name', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: 'Alpha XI' }),
      makeTeam({ id: 'team-2', name: 'Zeta XI' }),
    ])

    renderList('test-club-id')

    await screen.findByText('Alpha XI')
    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual(['Alpha XI', 'Zeta XI'])

    await user.click(screen.getByRole('button', { name: /sort: name, a to z/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Name, Z to A' }))

    expect(screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent)).toEqual(['Zeta XI', 'Alpha XI'])
    expect(screen.getByRole('button', { name: /sort: name, z to a/i })).toBeInTheDocument()
  })

  // docs/specs/057: the section-scoped links keep the `?from=section` marker; docs/specs/142: they also carry returnTo, and
  // Open Team, Edit Team and View Stats live in the kebab.
  it('the title links to the team with ?from=section and returnTo, and the kebab Edit Team keeps ?from=section', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])

    renderList('test-club-id', 'test-section-id')

    await screen.findByText('1st XI')
    const href = screen.getByRole('link', { name: '1st XI' }).getAttribute('href') as string
    expect(href).toContain('/manage/sections/test-section-id/teams/team-1?from=section')
    expect(href).toContain('returnTo=')
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Actions for 1st XI' }))
    const edit = screen.getByRole('menuitem', { name: 'Edit Team' }).getAttribute('href') as string
    expect(edit).toContain('/manage/sections/test-section-id/teams/team-1/edit?from=section')
    expect(edit).toContain('returnTo=')
  })

  it('the back link targets Club Structure', async () => {
    listTeamsForSection.mockResolvedValueOnce([])

    renderList('test-club-id')

    const backLink = await screen.findByRole('link', { name: /Back to Club Structure/ })
    expect(backLink).toHaveAttribute('href', '/manage/sections')
  })
})
