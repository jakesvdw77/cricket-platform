import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamDetailPage from './TeamDetailPage'
import type { Team } from '../../api/teamApi'
import type { Section } from '../../api/sectionApi'
import type { TeamContact } from '../../api/teamContactApi'
import type { Sponsor } from '../../api/sponsorApi'
import type { Season } from '../../api/seasonApi'
import type { SquadMember } from '../../api/teamSquadApi'

const listTeamsForClub = vi.fn()
const listSections = vi.fn()
const listTeamContacts = vi.fn()
const listTeamSponsors = vi.fn()
const listSeasons = vi.fn()
const listSquad = vi.fn()

vi.mock('../../api/teamApi', () => ({
  listTeamsForClub: (clubId: string) => listTeamsForClub(clubId),
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

vi.mock('../../api/seasonApi', () => ({
  listSeasons: (clubId: string) => listSeasons(clubId),
}))

vi.mock('../../api/teamSquadApi', () => ({
  listSquad: (clubId: string, teamId: string, seasonId: string) => listSquad(clubId, teamId, seasonId),
}))

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

function makeTeamContact(overrides: Partial<TeamContact> = {}): TeamContact {
  return {
    id: 'team-contact-1',
    contact: {
      id: 'contact-1',
      clubId: 'test-club-id',
      contact: { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', phone: '+27 21 555 0100' },
      role: 'Treasurer',
      isPrimary: false,
      active: true,
      photoUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: null,
    },
    role: 'Manager',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeSponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'sponsor-1',
    clubId: 'test-club-id',
    name: 'Acme Bank',
    website: null,
    email: null,
    phone: null,
    logoUrl: null,
    bannerUrl: null,
    socialLinks: [],
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    clubId: 'test-club-id',
    label: '2026',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

function makeSquadMember(overrides: Partial<SquadMember> = {}): SquadMember {
  return {
    id: 'squad-1',
    personId: 'person-1',
    clubId: 'test-club-id',
    firstName: 'Sam',
    lastName: 'Lee',
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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    playerProfileId: 'player-1',
    squadJerseyNumber: 9,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listSections.mockResolvedValue([])
  listTeamContacts.mockResolvedValue([])
  listTeamSponsors.mockResolvedValue([])
  listSeasons.mockResolvedValue([])
  listSquad.mockResolvedValue([])
})

function OutletContextWrapper({ clubId }: { clubId?: string }) {
  return <Outlet context={{ clubId }} />
}

function renderPage(initialPath: string, clubId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId} />}>
            <Route path="sections/:sectionId/teams" element={<div>Team List Page</div>} />
            <Route path="sections/:sectionId/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="sections/:sectionId/teams/:teamId/edit" element={<div>Edit Team Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TeamDetailPage', () => {
  it('renders "Not authorized" and does not fetch when no clubId is in the Outlet context', () => {
    renderPage('/manage/sections/section-1/teams/team-1', undefined)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(listTeamsForClub).not.toHaveBeenCalled()
  })

  it('loads the matching team and renders the section breadcrumb and "N players" stat pill', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' }), makeTeam({ id: 'team-2' })])
    listSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'Men' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listSquad.mockResolvedValueOnce([makeSquadMember({ id: 'squad-1' }), makeSquadMember({ id: 'squad-2', playerProfileId: 'player-2' })])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: '1st XI' })).toBeInTheDocument()
    expect(listTeamsForClub).toHaveBeenCalledWith('test-club-id')
    expect(screen.getByText('Men')).toBeInTheDocument()
    expect(await screen.findByText('2 players')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /edit/i })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1/edit',
    )
  })

  it("renders this team's own linked Contacts/Sponsors/Squad as viewTo cards, not edit links", async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])
    listTeamContacts.mockResolvedValueOnce([makeTeamContact()])
    listTeamSponsors.mockResolvedValueOnce([makeSponsor({ id: 'sponsor-1', name: 'Acme Bank' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listSquad.mockResolvedValueOnce([makeSquadMember({ playerProfileId: 'player-1' })])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    await screen.findByRole('heading', { name: '1st XI' })

    expect(await screen.findByText('Jane Smith')).toBeInTheDocument()

    const viewLinks = screen.getAllByRole('link', { name: 'View' }).map((link) => link.getAttribute('href'))
    expect(viewLinks).toContain('/manage/club-contacts/contact-1')
    expect(viewLinks).toContain('/manage/sponsors/sponsor-1')
    expect(viewLinks).toContain('/manage/players/player-1')

    expect(screen.getByText('Acme Bank')).toBeInTheDocument()
    expect(screen.getByText('Sam Lee')).toBeInTheDocument()
  })

  it('renders an error state when the matching team id is not in the fetched list', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'some-other-id' })])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this team")).toBeInTheDocument()
  })
})
