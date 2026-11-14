import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamAnalysisPage from './TeamAnalysisPage'
import type { SquadMember } from '../../../api/teamSquadApi'
import type { Team } from '../../../api/teamApi'

const listTeamsForClub = vi.fn()
const listSeasons = vi.fn()
const listSquad = vi.fn()
const getManagedClubProfile = vi.fn()

vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: (clubId: string) => listTeamsForClub(clubId) }))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: (clubId: string) => listSeasons(clubId) }))
vi.mock('../../../api/teamSquadApi', () => ({ listSquad: (clubId: string, teamId: string, seasonId: string) => listSquad(clubId, teamId, seasonId) }))
vi.mock('../../../api/clubApi', () => ({ getManagedClubProfile: (clubId: string) => getManagedClubProfile(clubId) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: vi.fn(async () => []) }))
vi.mock('../../../api/shareSettingsApi', () => ({
  getShareSettings: vi.fn(async () => ({ initialsOnlyDefault: false, disabledFormats: {} })),
  updateShareSettings: vi.fn(),
  shareSettingsKey: (clubId: string) => ['managed-club', clubId, 'share-settings'],
}))

const team = { id: 'team-1', clubId: 'club-1', sectionId: 'section-1', name: 'Irene Villagers 1', logoUrl: null, abbreviation: null, groundName: null, socialLinks: [], active: true } as unknown as Team
const season = { id: 'season-1', clubId: 'club-1', label: '2026/2027', startDate: '2026-09-01', endDate: '2027-04-30', active: true }

let counter = 0
function member(overrides: Partial<SquadMember> = {}): SquadMember {
  counter += 1
  return {
    id: `m${counter}`,
    playerProfileId: `pp${counter}`,
    personId: `pe${counter}`,
    clubId: 'club-1',
    firstName: `First${counter}`,
    lastName: `Last${counter}`,
    dateOfBirth: '1985-06-15',
    gender: null,
    photoUrl: null,
    clubMembershipNumber: null,
    medicalAidProvider: null,
    medicalAidMemberNumber: null,
    phone: null,
    email: null,
    altContactName: null,
    altContactPhone: null,
    battingStance: 'RIGHT_HANDED',
    bowlingArm: null,
    bowlingType: null,
    isWicketKeeper: false,
    battingPosition: null,
    isPartTimeBowler: false,
    active: true,
    sectionIds: [],
    jerseyNumber: null,
    squadJerseyNumber: null,
    isCaptain: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    verificationStatus: 'VERIFIED',
    gamesThisSeason: 0,
    gamesOverall: 0,
    ...overrides,
  } as SquadMember
}

function renderPage(path = '/manage/teams/team-1/analysis') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="teams/:teamId/analysis" element={<TeamAnalysisPage />} />
            <Route path="sections/:sectionId/teams/:teamId" element={<div>Team Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  counter = 0
  listTeamsForClub.mockResolvedValue([team])
  listSeasons.mockResolvedValue([season])
  getManagedClubProfile.mockResolvedValue({ name: 'Irene Villagers' })
})

describe('TeamAnalysisPage', () => {
  it('shows the counters, the things to check and the batting order for the squad of the season', async () => {
    listSquad.mockResolvedValue([
      member({ firstName: 'Dewald', lastName: 'Botha', bowlingType: 'FAST', bowlingArm: 'RIGHT_ARM', battingPosition: 'OPENER' }),
      member({ firstName: 'Andre', lastName: 'Louw', isWicketKeeper: true, battingPosition: 'TOP_ORDER' }),
      member({ firstName: 'Kobus', lastName: 'Naude', bowlingType: 'MEDIUM', isPartTimeBowler: true, battingPosition: 'MIDDLE_ORDER' }),
    ])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Irene Villagers 1 Squad Analysis' })).toBeInTheDocument()
    expect(listSquad).toHaveBeenCalledWith('club-1', 'team-1', 'season-1')
    expect(await screen.findByTestId('analysis-players')).toHaveTextContent('3')
    expect(screen.getByTestId('analysis-main-bowlers')).toHaveTextContent('1')
    expect(screen.getByTestId('analysis-part-time')).toHaveTextContent('1')
    expect(screen.getByTestId('analysis-all-rounders')).toHaveTextContent('1')
    expect(screen.getByTestId('analysis-keepers')).toHaveTextContent('1')
    expect(within(screen.getByTestId('order-OPENER')).getByText('Dewald Botha')).toBeInTheDocument()
    expect(within(screen.getByTestId('order-TOP_ORDER')).getByText('Andre Louw')).toBeInTheDocument()
    expect(within(screen.getByTestId('order-LOWER_ORDER')).getByText('Nobody')).toBeInTheDocument()
    expect(screen.getByTestId('gap-keeper')).toHaveTextContent('Only 1 wicketkeeper')
    expect(screen.getByTestId('gap-size')).toHaveTextContent('fewer than the 11 needed')
  })

  it('lists the players with missing information instead of dropping them', async () => {
    listSquad.mockResolvedValue([member({ firstName: 'No', lastName: 'Position', battingPosition: null })])

    renderPage()

    const missing = await screen.findByTestId('analysis-missing')
    expect(await within(missing).findByText('No Position: batting position')).toBeInTheDocument()
    expect(screen.getByTestId('order-not-set')).toHaveTextContent('Not set: No Position')
  })

  it('says so, with a link to the squad, when the squad has no players', async () => {
    listSquad.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('No players in this squad yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go To The Squad' })).toHaveAttribute('href', expect.stringContaining('/manage/sections/section-1/teams/team-1'))
    expect(screen.queryByTestId('analysis-share')).not.toBeInTheDocument()
  })

  it('offers Share only when the squad has players, and opens the share dialog from it', async () => {
    listSquad.mockResolvedValue([member({ battingPosition: 'OPENER' })])

    renderPage()
    await userEvent.click(await screen.findByTestId('analysis-share'))

    expect(await screen.findByRole('dialog', { name: 'Share Squad Analysis' })).toBeInTheDocument()
  })

  it('asks for the season in the address and keeps the Back link to the team page', async () => {
    listSquad.mockResolvedValue([member()])

    renderPage('/manage/teams/team-1/analysis?seasonId=season-1')

    await screen.findByTestId('analysis-players')
    expect(screen.getByRole('link', { name: /Back/ })).toHaveAttribute('href', '/manage/sections/section-1/teams/team-1?seasonId=season-1')
  })

  it('explains a team it cannot find', async () => {
    listTeamsForClub.mockResolvedValue([])
    listSquad.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText("Couldn't load this team")).toBeInTheDocument()
  })
})
