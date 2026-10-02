import { render, screen } from '@testing-library/react'
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

  it('renders the team name, section chip, and player/match count pills', () => {
    renderCard({ playerCount: 5, matchCount: 3 })

    expect(screen.getByRole('heading', { name: '1st XI' })).toBeInTheDocument()
    expect(screen.getByText('Men')).toBeInTheDocument()
    expect(screen.getByText('5 players')).toBeInTheDocument()
    expect(screen.getByText('3 matches')).toBeInTheDocument()
  })

  it('renders an abbreviation chip only when set', () => {
    renderCard({ team: makeTeam({ abbreviation: 'ICL' }) })
    expect(screen.getByText('ICL')).toBeInTheDocument()
  })

  it('renders no abbreviation chip when abbreviation is not set', () => {
    renderCard({ team: makeTeam() })
    expect(screen.queryByText('ICL')).not.toBeInTheDocument()
  })

  it('omits Ground/Captain/Manager/Coach rows entirely when their data is absent', () => {
    renderCard()

    expect(screen.queryByText(/Ground:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Captain:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Manager:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Coach:/)).not.toBeInTheDocument()
  })

  it('renders Ground/Captain/Manager/Coach rows when their data is present', () => {
    renderCard({
      team: makeTeam({ groundName: 'Irene Country Club' }),
      captainName: 'Jane Smith',
      managerName: 'Bob Jones',
      coachName: 'Alex Lee',
    })

    expect(screen.getByText(/Irene Country Club/)).toBeInTheDocument()
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
    expect(screen.getByText(/Bob Jones/)).toBeInTheDocument()
    expect(screen.getByText(/Alex Lee/)).toBeInTheDocument()
  })

  it('renders a badge when supplied', () => {
    renderCard({ badge: { label: 'Inactive', tone: 'muted' } })

    expect(screen.getByText('Inactive')).toBeInTheDocument()
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

  it('renders the title as a link to viewTo and Edit as a link to editTo, with no separate View link', () => {
    renderCard({
      viewTo: '/manage/sections/section-1/teams/team-1',
      editTo: '/manage/sections/section-1/teams/team-1/edit',
    })

    expect(screen.getByRole('link', { name: '1st XI' })).toHaveAttribute('href', '/manage/sections/section-1/teams/team-1')
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/manage/sections/section-1/teams/team-1/edit',
    )
    expect(screen.queryByRole('link', { name: 'View' })).not.toBeInTheDocument()
  })

  // docs/specs/059-record-card-click-to-view.md: the stretched-link overlay sits above every
  // plain, unpositioned sibling — a real bug caught in standards review, where this social-link
  // row initially had no position: relative and would have silently swallowed its own clicks.
  // Mirrors RecordCard.test.tsx's own "wires the stretched-link CSS" test.
  it('wires position: relative on the social links row so the stretched-link overlay does not swallow its clicks', () => {
    renderCard({ team: makeTeam({ socialLinks: [{ platform: 'facebook', url: 'https://facebook.com/team' }] }) })

    const facebookLink = screen.getByLabelText('Facebook')
    expect(facebookLink.closest('.MuiCard-root')).toHaveStyle({ position: 'relative' })
    expect(facebookLink.parentElement?.parentElement).toHaveStyle({ position: 'relative' })
  })
})
