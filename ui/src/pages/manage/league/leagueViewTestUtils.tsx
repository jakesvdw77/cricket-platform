import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import type { Team } from '../../../api/teamApi'
import type { Match } from '../../../api/matchApi'
import type { LeagueAffiliation } from '../../../api/leagueAffiliationApi'
import type { LeagueTeam } from '../../../api/leagueTeamApi'
import type { LeaguePlayingConditions } from '../../../api/leaguePlayingConditionsApi'
import type { LeagueContact } from '../../../api/leagueContactApi'
import { LocationProbe, OutletContextWrapper } from './LeagueViewTestHarness'
import LeagueViewLayout from './LeagueViewLayout'
import LeagueIndexRedirect from './LeagueIndexRedirect'
import LeagueScheduleView from './LeagueScheduleView'
import LeagueTeamsView from './LeagueTeamsView'
import LeagueConditionsView from './LeagueConditionsView'

// Shared fixtures and the route tree for the league view tests (docs/specs/072-league-view-pages.md).
// Each test file declares its own vi.mock block (hoisting is per file); this helper has no mocks.

export function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: 'league-1',
    clubId: 'test-club-id',
    name: 'Internal League',
    source: 'INTERNAL',
    maxPlayingXiSize: 11,
    minAge: null,
    maxAge: null,
    ageCutoffDate: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    currentSeasonTeamCount: 1,
    currentSeasonLabel: '2026',
    currentSeasonPlayingConditionsUrl: null,
    format: null,
    logoUrl: null,
    phone: null,
    website: null,
    email: null,
    socialLinks: [],
    ...overrides,
  }
}

export function makeSeason(overrides: Partial<Season> = {}): Season {
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

export function makeTeam(overrides: Partial<Team> = {}): Team {
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

export function makeAffiliation(overrides: Partial<LeagueAffiliation> = {}): LeagueAffiliation {
  return {
    id: 'affiliation-1',
    leagueId: 'league-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: null,
    ...overrides,
  }
}

export function makeLeagueTeam(overrides: Partial<LeagueTeam> = {}): LeagueTeam {
  return {
    id: 'league-team-1',
    leagueId: 'league-1',
    seasonId: 'season-1',
    name: 'Riverside Occasionals',
    abbreviation: null,
    logoUrl: null,
    active: true,
    referencedByMatchCount: 0,
    ...overrides,
  }
}

export function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'test-club-id',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Riverside Occasionals',
    leagueId: 'league-1',
    seasonId: 'season-1',
    matchDate: '2026-06-01T14:30:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homePickedCount: null,
    awayPickedCount: null,
    playingXiSize: null,
    polls: [],
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

export function makePlayingConditions(overrides: Partial<LeaguePlayingConditions> = {}): LeaguePlayingConditions {
  return {
    id: 'playing-conditions-1',
    leagueId: 'league-1',
    seasonId: 'season-1',
    documentUrl: null,
    uploadedAt: null,
    uploadedBy: null,
    maxOversPerInnings: 20,
    powerplayOvers: 6,
    maxOversPerBowler: 4,
    fieldingRestrictionsNotes: null,
    allowSubstitutions: false,
    pointsForWin: 2,
    pointsForLoss: 0,
    pointsForDraw: 1,
    pointsForNoResult: 1,
    pointsForForfeitWin: 2,
    bonusPointsEnabled: false,
    bonusBattingOversThreshold: null,
    bonusBowlingRestrictionPercentage: null,
    additionalNotes: null,
    ...overrides,
  }
}

export function makeContact(overrides: Partial<LeagueContact> = {}): LeagueContact {
  return {
    id: 'contact-1',
    leagueId: 'league-1',
    contact: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phone: '+27 21 555 0100',
    },
    role: 'League Administrator',
    isPrimary: false,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

export function emptyPage() {
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 200 }
}

// clubId: omit for the default test club, pass null for "no club in the Outlet context".
export function renderLeagueView(entries: string | string[], clubId: string | null = 'test-club-id') {
  const initialEntries = Array.isArray(entries) ? entries : [entries]
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
        <LocationProbe />
        <Routes>
          <Route path="/manage" element={<OutletContextWrapper clubId={clubId ?? undefined} />}>
            <Route path="fixtures/leagues" element={<div>League List Page</div>} />
            <Route path="fixtures/leagues/:leagueId" element={<LeagueViewLayout />}>
              <Route index element={<LeagueIndexRedirect />} />
              <Route path="schedule" element={<LeagueScheduleView />} />
              <Route path="teams" element={<LeagueTeamsView />} />
              <Route path="conditions" element={<LeagueConditionsView />} />
            </Route>
            <Route path="fixtures/leagues/:leagueId/edit" element={<div>Edit League Page</div>} />
            <Route
              path="fixtures/leagues/:leagueId/contacts/:contactId/edit"
              element={<div>Edit League Contact Page</div>}
            />
            <Route path="sections/:sectionId/teams/:teamId" element={<div>Team Detail Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
