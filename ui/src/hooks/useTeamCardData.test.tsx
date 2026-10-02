import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTeamCardData } from './useTeamCardData'
import type { Team } from '../api/teamApi'
import type { Page } from '../api/productApi'
import type { Match } from '../api/matchApi'
import type { SquadMember } from '../api/teamSquadApi'
import type { TeamContact } from '../api/teamContactApi'
import type { Sponsor } from '../api/sponsorApi'

const listTeamContacts = vi.fn()
const listTeamSponsors = vi.fn()
const listSquad = vi.fn()
const listMatches = vi.fn()

vi.mock('../api/teamContactApi', () => ({
  listTeamContacts: (clubId: string, sectionId: string, teamId: string) => listTeamContacts(clubId, sectionId, teamId),
}))

vi.mock('../api/teamSponsorApi', () => ({
  listTeamSponsors: (clubId: string, sectionId: string, teamId: string) => listTeamSponsors(clubId, sectionId, teamId),
}))

vi.mock('../api/teamSquadApi', () => ({
  listSquad: (clubId: string, teamId: string, seasonId: string) => listSquad(clubId, teamId, seasonId),
}))

vi.mock('../api/matchApi', () => ({
  listMatches: (clubId: string, params: unknown) => listMatches(clubId, params),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listTeamContacts.mockResolvedValue([])
  listTeamSponsors.mockResolvedValue([])
  listSquad.mockResolvedValue([])
  listMatches.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 } as Page<Match>)
})

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
    clubId: 'club-1',
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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    playerProfileId: 'player-1',
    squadJerseyNumber: null,
    isCaptain: false,
    ...overrides,
  }
}

function makeTeamContact(overrides: Partial<TeamContact> = {}): TeamContact {
  return {
    id: 'tc-1',
    contact: {
      id: 'contact-1',
      clubId: 'club-1',
      contact: { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', phone: '+27 21 555 0100' },
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
    clubId: 'club-1',
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

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useTeamCardData', () => {
  it('resolves captain/manager/coach/playerCount/matchCount/sponsors per team', async () => {
    const team = makeTeam({ id: 'team-1', sectionId: 'section-1' })
    listSquad.mockResolvedValue([
      makeSquadMember({ playerProfileId: 'player-1', firstName: 'Jane', lastName: 'Smith', isCaptain: true }),
      makeSquadMember({ playerProfileId: 'player-2', firstName: 'Sam', lastName: 'Lee', isCaptain: false }),
    ])
    listTeamContacts.mockResolvedValue([
      makeTeamContact({ role: 'Manager' }),
      makeTeamContact({
        id: 'tc-2',
        role: 'coach',
        contact: {
          id: 'contact-2',
          clubId: 'club-1',
          contact: { firstName: 'Alex', lastName: 'Lee', email: 'a@example.com', phone: '+27' },
          role: 'Coach',
          isPrimary: false,
          active: true,
          photoUrl: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          updatedBy: null,
        },
      }),
    ])
    listTeamSponsors.mockResolvedValue([makeSponsor()])
    listMatches.mockResolvedValue({
      content: [
        { id: 'm1', clubId: 'club-1', homeTeamId: 'team-1', homeTeamName: null, awayTeamId: 'team-2', awayTeamName: null, leagueId: null, seasonId: 'season-1', matchDate: '2026-02-01', venue: null, active: true, homeSideAnnounced: false, awaySideAnnounced: false, homeTeamLogoUrl: null, awayTeamLogoUrl: null, createdAt: '', updatedAt: '', updatedBy: null },
        { id: 'm2', clubId: 'club-1', homeTeamId: 'team-3', homeTeamName: null, awayTeamId: 'team-4', awayTeamName: null, leagueId: null, seasonId: 'season-1', matchDate: '2026-02-02', venue: null, active: true, homeSideAnnounced: false, awaySideAnnounced: false, homeTeamLogoUrl: null, awayTeamLogoUrl: null, createdAt: '', updatedAt: '', updatedBy: null },
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 200,
    } as Page<Match>)

    const { result } = renderHook(() => useTeamCardData('club-1', [team], 'season-1'), { wrapper })

    await waitFor(() => expect(result.current['team-1']?.playerCount).toBe(2))

    expect(result.current['team-1']).toEqual({
      captainName: 'Jane Smith',
      managerName: 'Bob Jones',
      coachName: 'Alex Lee',
      playerCount: 2,
      matchCount: 1,
      sponsors: [makeSponsor()],
    })
  })

  it('returns null captain/manager/coach and zero counts when no data is linked', async () => {
    const team = makeTeam({ id: 'team-1' })

    const { result } = renderHook(() => useTeamCardData('club-1', [team], 'season-1'), { wrapper })

    await waitFor(() => expect(result.current['team-1']).toBeDefined())

    expect(result.current['team-1']).toEqual({
      captainName: null,
      managerName: null,
      coachName: null,
      playerCount: 0,
      matchCount: 0,
      sponsors: [],
    })
  })
})
