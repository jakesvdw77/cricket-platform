import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamDirectory from './TeamDirectory'
import type { Team } from '../../api/teamApi'
import type { Section } from '../../api/sectionApi'

const listTeamsForClub = vi.fn()
const deactivateTeam = vi.fn()
const reactivateTeam = vi.fn()
const listSections = vi.fn()

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
  deactivateTeam: (clubId: string, sectionId: string, teamId: string) => deactivateTeam(clubId, sectionId, teamId),
  reactivateTeam: (clubId: string, sectionId: string, teamId: string) => reactivateTeam(clubId, sectionId, teamId),
}))

vi.mock('../../api/sectionApi', () => ({
  listSections: (clubId: string) => listSections(clubId),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 'team-1',
    clubId: 'test-club-id',
    sectionId: 'section-1',
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

function renderDirectory(clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/manage/teams']}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="teams" element={<TeamDirectory />} />
            <Route path="teams/new" element={<div>Add Team Page</div>} />
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

  it('renders every team with its joined section name from more than one section', async () => {
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

  it('renders the full section-ancestry breadcrumb chain, not just the immediate section name', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', name: 'O/15 A', sectionId: 'o15' })])
    listSections.mockResolvedValueOnce([
      makeSection({ id: 'juniors', parentSectionId: null, name: 'Juniors' }),
      makeSection({ id: 'boys', parentSectionId: 'juniors', name: 'Boys' }),
      makeSection({ id: 'o15', parentSectionId: 'boys', name: 'O/15' }),
    ])

    renderDirectory('test-club-id')

    expect(await screen.findByText('Juniors › Boys › O/15')).toBeInTheDocument()
  })

  it('renders a muted Inactive badge for a deactivated team', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ active: false })])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    expect(await screen.findByText('1st XI')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
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

  it('clicking Add Team navigates to the club-wide create route', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([])
    listSections.mockResolvedValueOnce([])

    renderDirectory('test-club-id')

    await screen.findByText('No teams yet')
    await user.click(screen.getByRole('button', { name: 'Add Team' }))

    expect(await screen.findByText('Add Team Page')).toBeInTheDocument()
  })

  it('clicking Deactivate calls deactivateTeam directly with the team\'s own sectionId', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ active: true, sectionId: 'section-1' })])
    listSections.mockResolvedValueOnce([makeSection()])
    let resolveDeactivate: (value: Team) => void = () => {}
    deactivateTeam.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDeactivate = resolve
      }),
    )
    // onSuccess invalidates the list query while this card is still mounted, triggering a
    // refetch that also needs a value to resolve to.
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ active: false, sectionId: 'section-1' })])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(deactivateTeam).toHaveBeenCalledWith('test-club-id', 'section-1', 'team-1')
    expect(await screen.findByRole('button', { name: 'Deactivating…' })).toBeInTheDocument()

    resolveDeactivate(makeTeam({ active: false }))

    expect(await screen.findByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  })

  it('clicking Reactivate calls reactivateTeam directly with the team\'s own sectionId', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ active: false, sectionId: 'section-1' })])
    listSections.mockResolvedValueOnce([makeSection()])
    reactivateTeam.mockResolvedValueOnce(makeTeam({ active: true }))
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ active: true, sectionId: 'section-1' })])

    renderDirectory('test-club-id')

    await screen.findByText('1st XI')
    await user.click(screen.getByRole('button', { name: 'Reactivate' }))

    expect(reactivateTeam).toHaveBeenCalledWith('test-club-id', 'section-1', 'team-1')
  })

  it('the edit link on a team card targets the section-scoped edit route', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', sectionId: 'section-1' })])
    listSections.mockResolvedValueOnce([makeSection()])

    renderDirectory('test-club-id')

    const editLink = await screen.findByRole('link', { name: 'Edit' })
    expect(editLink).toHaveAttribute('href', '/manage/sections/section-1/teams/team-1/edit')
  })
})
