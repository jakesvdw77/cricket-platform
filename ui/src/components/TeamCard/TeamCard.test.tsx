import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamCard } from './TeamCard'
import type { Team } from '../../api/teamApi'
import type { Sponsor } from '../../api/sponsorApi'

const listSponsorContacts = vi.fn()

vi.mock('../../api/sponsorContactApi', () => ({
  listSponsorContacts: (clubId: string, sponsorId: string) => listSponsorContacts(clubId, sponsorId),
}))

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

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderCard(props: Partial<Parameters<typeof TeamCard>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LocationProbe />
        <TeamCard
          team={makeTeam()}
          sectionName="Men"
          playerCount={0}
          matchCount={0}
          viewTo="/manage/sections/section-1/teams/team-1"
          statsTo="/manage/teams/team-1/stats"
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TeamCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listSponsorContacts.mockResolvedValue([])
  })

  it('renders the team name, the section and Active chips and five icon-less rows in a fixed order', () => {
    renderCard({ playerCount: 5, matchCount: 3 })

    expect(screen.getByRole('heading', { name: '1st XI' })).toBeInTheDocument()
    expect(screen.getByText('Men')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getAllByTestId('team-detail-row').map((row) => row.textContent)).toEqual(['Players5', 'Matches3', 'Captain–', 'Manager–', 'Coach–'])
  })

  it('shows a zero count as 0, not as the not-on-file dash', () => {
    renderCard({ playerCount: 0, matchCount: 0 })
    expect(screen.getAllByTestId('team-detail-row').slice(0, 2).map((row) => row.textContent)).toEqual(['Players0', 'Matches0'])
  })

  it('shows no abbreviation chip, whether or not the team has one', () => {
    renderCard({ team: makeTeam({ abbreviation: 'ICL' }) })
    expect(screen.queryByText('ICL')).not.toBeInTheDocument()
  })

  it('always renders the Captain, Manager and Coach rows, with a muted dash when the data is absent', () => {
    renderCard()

    const rows = screen.getAllByTestId('team-detail-row')
    expect(rows.slice(2).map((row) => row.textContent)).toEqual(['Captain–', 'Manager–', 'Coach–'])
  })

  it('renders the Captain, Manager and Coach names when present', () => {
    renderCard({ captainName: 'Jane Smith', managerName: 'Bob Jones', coachName: 'Alex Lee' })

    const rows = screen.getAllByTestId('team-detail-row')
    expect(rows.slice(2).map((row) => row.textContent)).toEqual(['CaptainJane Smith', 'ManagerBob Jones', 'CoachAlex Lee'])
  })

  it('renders a grey Inactive chip instead of Active for a deactivated team', () => {
    renderCard({ team: makeTeam({ active: false }) })

    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('shows "No sponsors" when the team has none', () => {
    renderCard()
    expect(screen.getByText('No sponsors')).toBeInTheDocument()
  })

  it('renders sponsor icons only when sponsors are supplied', () => {
    renderCard({ sponsors: [makeSponsor({ id: 'sponsor-1', name: 'Acme Bank' })] })
    expect(screen.getByTitle('Acme Bank')).toBeInTheDocument()
  })

  it('renders no sponsor icons when no sponsors are supplied', () => {
    renderCard({ sponsors: [] })
    expect(screen.queryByTitle('Acme Bank')).not.toBeInTheDocument()
  })

  // Real user feedback: sponsor logos looked static — clicking one now opens the same quick-view
  // dialog (Website/Email/Sponsor Contacts) TeamDetailPage.tsx's own Sponsors grid opens.
  it('opens a sponsor quick-view dialog on click, listing the sponsor\'s own named contacts', async () => {
    const user = userEvent.setup()
    listSponsorContacts.mockResolvedValueOnce([
      { id: 'sc-1', sponsorId: 'sponsor-1', contact: { firstName: 'Priya', lastName: 'Naidoo', email: '', phone: '' }, role: 'Account Manager', isPrimary: true, active: true, createdAt: '', updatedAt: '', updatedBy: null },
    ])
    renderCard({
      sponsors: [makeSponsor({ id: 'sponsor-1', name: 'Acme Bank', website: 'https://acme.example.com' })],
    })

    await user.click(screen.getByRole('button', { name: 'Acme Bank — Sponsor' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('https://acme.example.com')).toBeInTheDocument()
    expect(await screen.findByText('Priya Naidoo')).toBeInTheDocument()
    expect(screen.getByText('Account Manager')).toBeInTheDocument()
    expect(listSponsorContacts).toHaveBeenCalledWith('club-1', 'sponsor-1')
  })

  it('renders a social link icon row only when the team has social links', () => {
    renderCard({ team: makeTeam({ socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/team' }] }) })

    expect(screen.getByLabelText('Facebook')).toBeInTheDocument()
  })

  it('renders the title as a link to viewTo, with no footer bar of Squad, Matches, Edit or Stats links', () => {
    renderCard()

    expect(screen.getByRole('link', { name: '1st XI' })).toHaveAttribute('href', '/manage/sections/section-1/teams/team-1')
    for (const name of ['Squad', 'Matches', 'Edit', 'Stats', 'View']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
  })

  it('shows an outlined View Stats button that opens statsTo without opening the team', async () => {
    renderCard({ statsTo: '/stats?returnTo=%2Fmanage%2Fteams' })
    expect(screen.getByTestId('team-card-stats')).toHaveTextContent('View Stats')
    await userEvent.click(screen.getByTestId('team-card-stats'))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/stats?returnTo=%2Fmanage%2Fteams'))
  })

  it('renders the supplied kebab menu in the header', () => {
    renderCard({ menu: <button type="button">Actions for 1st XI</button> })
    expect(screen.getByRole('button', { name: 'Actions for 1st XI' })).toBeInTheDocument()
  })

  // docs/specs/059-record-card-click-to-view.md: the stretched-link overlay sits above every
  // plain, unpositioned sibling — a real bug caught in standards review, where this social-link
  // row initially had no position: relative and would have silently swallowed its own clicks.
  // Mirrors RecordCard.test.tsx's own "wires the stretched-link CSS" test.
  it('wires position: relative on the social links row so the stretched-link overlay does not swallow its clicks', () => {
    renderCard({ team: makeTeam({ socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/team' }] }) })

    const facebookLink = screen.getByLabelText('Facebook')
    expect(facebookLink.closest('.MuiCard-root')).toHaveStyle({ position: 'relative' })
    expect(screen.getByTestId('team-social-links').parentElement).toHaveStyle({ position: 'relative' })
  })
})
