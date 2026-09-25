import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamDetailPage from './TeamDetailPage'
import type { Team } from '../../api/teamApi'
import type { Section } from '../../api/sectionApi'
import type { TeamContact } from '../../api/teamContactApi'
import type { Sponsor } from '../../api/sponsorApi'
import type { Season } from '../../api/seasonApi'
import type { SquadMember } from '../../api/teamSquadApi'
import type { Page } from '../../api/productApi'
import type { Match } from '../../api/matchApi'

const listTeamsForClub = vi.fn()
const listSections = vi.fn()
const listTeamContacts = vi.fn()
const listTeamSponsors = vi.fn()
const listSeasons = vi.fn()
const listSquad = vi.fn()
const listMatches = vi.fn()

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

vi.mock('../../api/matchApi', () => ({
  listMatches: (clubId: string, params: unknown) => listMatches(clubId, params),
}))

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
    isCaptain: false,
    ...overrides,
  }
}

function makeMatchesPage(matches: Match[]): Page<Match> {
  return { content: matches, totalElements: matches.length, totalPages: 1, number: 0, size: 200 }
}

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'test-club-id',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: 'team-9',
    awayTeamName: null,
    leagueId: null,
    seasonId: 'season-1',
    matchDate: '2026-02-01',
    venue: null,
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
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
  listMatches.mockResolvedValue(makeMatchesPage([]))
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
            <Route path="teams" element={<div>Team Directory Page</div>} />
            <Route path="sections/:sectionId/teams" element={<div>Team List Page</div>} />
            <Route path="sections/:sectionId/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="sections/:sectionId/teams/:teamId/edit" element={<div>Edit Team Page</div>} />
            <Route path="club-contacts/:id/edit" element={<div>Edit Contact Page</div>} />
            <Route path="sponsors/:id/edit" element={<div>Edit Sponsor Page</div>} />
            <Route path="players/:playerId/edit" element={<div>Edit Player Page</div>} />
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

  it('renders an error state when the matching team id is not in the fetched list', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'some-other-id' })])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    expect(await screen.findByText("Couldn't load this team")).toBeInTheDocument()
  })

  it('renders the header chips: section, ground, captain, player/match counts, and no "Details" heading', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', groundName: 'Irene Country Club' })])
    listSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'Men' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listSquad.mockResolvedValueOnce([
      makeSquadMember({ id: 'squad-1', playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith', isCaptain: true }),
      makeSquadMember({ id: 'squad-2', playerProfileId: 'player-2', firstName: 'Sam', lastName: 'Lee', isCaptain: false }),
    ])
    listMatches.mockResolvedValueOnce(
      makeMatchesPage([makeMatch({ homeTeamId: 'team-1' }), makeMatch({ id: 'match-2', homeTeamId: 'other', awayTeamId: 'team-9' })]),
    )

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    expect(await screen.findByRole('heading', { name: '1st XI' })).toBeInTheDocument()
    expect(screen.getByText('Men')).toBeInTheDocument()
    expect(screen.getByText('Irene Country Club')).toBeInTheDocument()
    expect(await screen.findByText('Captain: Jane Smith')).toBeInTheDocument()
    expect(await screen.findByText('2 players')).toBeInTheDocument()
    expect(await screen.findByText('1 matches')).toBeInTheDocument()
    expect(screen.queryByText('Details')).not.toBeInTheDocument()
  })

  it('renders an Inactive badge chip for a deactivated team', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1', active: false })])
    listSections.mockResolvedValueOnce([makeSection({ id: 'section-1', name: 'Men' })])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    await screen.findByRole('heading', { name: '1st XI' })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('opens the Contacts quick-view dialog with Role/Email/Phone fields, edit route intact', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])
    listTeamContacts.mockResolvedValueOnce([makeTeamContact()])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    await screen.findByRole('heading', { name: '1st XI' })
    await user.click(screen.getByRole('button', { name: 'Jane Smith — Manager' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument()
    expect(screen.getByText('+27 21 555 0100')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/club-contacts/contact-1/edit')
  })

  it('opens the Sponsors quick-view dialog with Website/Email fields, edit route intact', async () => {
    const user = userEvent.setup()
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])
    listTeamSponsors.mockResolvedValueOnce([makeSponsor({ id: 'sponsor-1', name: 'Acme Bank', website: 'https://acme.example.com' })])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    await screen.findByRole('heading', { name: '1st XI' })
    await user.click(screen.getByRole('button', { name: 'Acme Bank — Sponsor' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('https://acme.example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/manage/sponsors/sponsor-1/edit')
  })

  it('renders the Squad grid with the captain tile visually distinguished by a "Captain" label', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])
    listSeasons.mockResolvedValueOnce([makeSeason({ id: 'season-1' })])
    listSquad.mockResolvedValueOnce([
      makeSquadMember({ id: 'squad-1', playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith', isCaptain: true }),
      makeSquadMember({ id: 'squad-2', playerProfileId: 'player-2', firstName: 'Sam', lastName: 'Lee', isCaptain: false }),
    ])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    await screen.findByText('Jane Smith')
    expect(screen.getByText('Sam Lee')).toBeInTheDocument()
    expect(screen.getByText('Captain')).toBeInTheDocument()

    const viewLinks = screen.getAllByRole('link', { name: 'View' }).map((link) => link.getAttribute('href'))
    expect(viewLinks).toContain('/manage/players/player-1')
    const editLinks = screen.getAllByRole('link', { name: 'Edit' }).map((link) => link.getAttribute('href'))
    expect(editLinks).toContain('/manage/players/player-1/edit')
  })

  it('the back link targets the club-wide directory when ?from=section is absent (the default)', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    const backLink = await screen.findByRole('link', { name: /Back to Teams/ })
    expect(backLink).toHaveAttribute('href', '/manage/teams')
  })

  it('the back link targets the section-scoped Teams list when ?from=section is present', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])

    renderPage('/manage/sections/section-1/teams/team-1?from=section', 'test-club-id')

    const backLink = await screen.findByRole('link', { name: /Back to Teams/ })
    expect(backLink).toHaveAttribute('href', '/manage/sections/section-1/teams')
  })

  it('the header "Edit team" and Squad "Add player" actions both target the edit route', async () => {
    listTeamsForClub.mockResolvedValueOnce([makeTeam({ id: 'team-1' })])

    renderPage('/manage/sections/section-1/teams/team-1', 'test-club-id')

    await screen.findByRole('heading', { name: '1st XI' })
    expect(screen.getByRole('link', { name: /Edit team/ })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1/edit',
    )
    expect(screen.getByRole('link', { name: 'Add player' })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1/edit',
    )
  })
})
