import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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

function renderCard(props: Partial<Parameters<typeof TeamCard>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TeamCard
          team={makeTeam()}
          sectionName="Men"
          playerCount={0}
          matchCount={0}
          viewTo="/manage/sections/section-1/teams/team-1"
          editTo="/manage/sections/section-1/teams/team-1/edit"
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

  it('renders the team name, the section and Active chips and the Players and Matches figure tiles', () => {
    renderCard({ playerCount: 5, matchCount: 3 })

    expect(screen.getByRole('heading', { name: '1st XI' })).toBeInTheDocument()
    expect(screen.getByText('Men')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByTestId('team-players-value')).toHaveTextContent('5')
    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByTestId('team-matches-value')).toHaveTextContent('3')
    expect(within(screen.getByTestId('team-matches')).getByText('Matches')).toBeInTheDocument()
  })

  it('shows no abbreviation chip, whether or not the team has one', () => {
    renderCard({ team: makeTeam({ abbreviation: 'ICL' }) })
    expect(screen.queryByText('ICL')).not.toBeInTheDocument()
  })

  it('always renders the Captain, Manager and Coach rows, with a muted dash when the data is absent', () => {
    renderCard()

    const rows = screen.getAllByTestId('team-detail-row')
    expect(rows.map((row) => row.textContent)).toEqual(['Captain–', 'Manager–', 'Coach–'])
  })

  it('renders the Captain, Manager and Coach names when present', () => {
    renderCard({ captainName: 'Jane Smith', managerName: 'Bob Jones', coachName: 'Alex Lee' })

    const rows = screen.getAllByTestId('team-detail-row')
    expect(rows.map((row) => row.textContent)).toEqual(['CaptainJane Smith', 'ManagerBob Jones', 'CoachAlex Lee'])
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

  it('renders the title as a link to viewTo and the footer Squad, Matches and Edit links, with no separate View link', () => {
    renderCard({
      viewTo: '/manage/sections/section-1/teams/team-1',
      editTo: '/manage/sections/section-1/teams/team-1/edit',
    })

    expect(screen.getByRole('link', { name: '1st XI' })).toHaveAttribute('href', '/manage/sections/section-1/teams/team-1')
    expect(screen.getByRole('link', { name: 'Squad' })).toHaveAttribute('href', '/manage/sections/section-1/teams/team-1')
    expect(screen.getByRole('link', { name: 'Matches' })).toHaveAttribute('href', '/manage/sections/section-1/teams/team-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1/edit',
    )
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
  })

  it('points Squad and Matches at squadTo and matchesTo when given', () => {
    renderCard({ squadTo: '/squad', matchesTo: '/matches' })

    expect(screen.getByRole('link', { name: 'Squad' })).toHaveAttribute('href', '/squad')
    expect(screen.getByRole('link', { name: 'Matches' })).toHaveAttribute('href', '/matches')
  })

  // docs/specs/059-record-card-click-to-view.md: the stretched-link overlay sits above every
  // plain, unpositioned sibling — a real bug caught in standards review, where this social-link
  // row initially had no position: relative and would have silently swallowed its own clicks.
  // Mirrors RecordCard.test.tsx's own "wires the stretched-link CSS" test.
  it('wires position: relative on the social links row so the stretched-link overlay does not swallow its clicks', () => {
    renderCard({ team: makeTeam({ socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/team' }] }) })

    const facebookLink = screen.getByLabelText('Facebook')
    expect(facebookLink.closest('.MuiCard-root')).toHaveStyle({ position: 'relative' })
    expect(screen.getByTestId('team-social-links')).toHaveStyle({ position: 'relative' })
  })
})
