import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamList from './TeamList'
import type { Team } from '../../api/teamApi'
import type { Section } from '../../api/sectionApi'

const listTeamsForSection = vi.fn()
const deactivateTeam = vi.fn()
const reactivateTeam = vi.fn()
const listSections = vi.fn()

// Mirrors SponsorContactList.test.tsx's mock-every-export-individually pattern.
vi.mock('../../api/teamApi', () => ({
  listTeamsForSection: (clubId: string, sectionId: string) => listTeamsForSection(clubId, sectionId),
  deactivateTeam: (clubId: string, sectionId: string, teamId: string) => deactivateTeam(clubId, sectionId, teamId),
  reactivateTeam: (clubId: string, sectionId: string, teamId: string) => reactivateTeam(clubId, sectionId, teamId),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([])
})

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'test-club-id',
    sectionId: 'test-section-id',
    name: '1st XI',
    logoUrl: null,
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

    expect(await screen.findByText('Teams — Men')).toBeInTheDocument()
  })

  it('renders the full section-ancestry breadcrumb in the page header, not just the immediate section name', async () => {
    listTeamsForSection.mockResolvedValueOnce([])
    listSections.mockResolvedValueOnce([
      makeSection({ id: 'juniors', parentSectionId: null, name: 'Juniors' }),
      makeSection({ id: 'boys', parentSectionId: 'juniors', name: 'Boys' }),
      makeSection({ id: 'test-section-id', parentSectionId: 'boys', name: 'O/15' }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('Teams — Juniors › Boys › O/15')).toBeInTheDocument()
  })

  it('renders a card per team with a muted Inactive badge for a deactivated team', async () => {
    listTeamsForSection.mockResolvedValueOnce([
      makeTeam({ id: 'team-1', name: '1st XI' }),
      makeTeam({ id: 'team-2', name: '2nd XI', active: false }),
    ])

    renderList('test-club-id')

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('2nd XI')).toBeInTheDocument()
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

  it('clicking Add Team navigates to the section-scoped create route', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([])

    renderList('test-club-id')

    await screen.findByText('No teams yet')
    await user.click(screen.getByRole('button', { name: 'Add Team' }))

    expect(await screen.findByText('Add Team Page')).toBeInTheDocument()
  })

  it('clicking Deactivate on an active team calls deactivateTeam and reflects a pending state', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([makeTeam({ active: true })])
    let resolveDeactivate: (value: Team) => void = () => {}
    deactivateTeam.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDeactivate = resolve
      }),
    )
    // onSuccess invalidates the list query while this card is still mounted, triggering a
    // refetch that also needs a value to resolve to — same gotcha as ClubContactList.test.tsx.
    listTeamsForSection.mockResolvedValueOnce([makeTeam({ active: false })])

    renderList('test-club-id')

    await screen.findByText('1st XI')
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(deactivateTeam).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1')
    expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

    resolveDeactivate(makeTeam({ active: false }))

    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('clicking Reactivate on an inactive team calls reactivateTeam', async () => {
    const user = userEvent.setup()
    listTeamsForSection.mockResolvedValueOnce([makeTeam({ active: false })])
    reactivateTeam.mockResolvedValueOnce(makeTeam({ active: true }))
    listTeamsForSection.mockResolvedValueOnce([makeTeam({ active: true })])

    renderList('test-club-id')

    await screen.findByText('1st XI')
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))

    expect(reactivateTeam).toHaveBeenCalledWith('test-club-id', 'test-section-id', 'team-1')
  })

  it('the back link targets Club Structure', async () => {
    listTeamsForSection.mockResolvedValueOnce([])

    renderList('test-club-id')

    const backLink = await screen.findByRole('link', { name: /Back to Club Structure/ })
    expect(backLink).toHaveAttribute('href', '/manage/sections')
  })
})
