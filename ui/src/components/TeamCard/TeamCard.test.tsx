import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TeamCard } from './TeamCard'
import type { Team } from '../../api/teamApi'
import type { Sponsor } from '../../api/sponsorApi'

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
  return render(
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
    </MemoryRouter>,
  )
}

describe('TeamCard', () => {
  it('renders the team name, section chip, and player/match count pills', () => {
    renderCard({ playerCount: 5, matchCount: 3 })

    expect(screen.getByRole('heading', { name: '1st XI' })).toBeInTheDocument()
    expect(screen.getByText('Men')).toBeInTheDocument()
    expect(screen.getByText('5 players')).toBeInTheDocument()
    expect(screen.getByText('3 matches')).toBeInTheDocument()
  })

  it('renders an abbreviation chip only when set', () => {
    const { rerender } = render(
      <MemoryRouter>
        <TeamCard
          team={makeTeam({ abbreviation: 'ICL' })}
          sectionName="Men"
          playerCount={0}
          matchCount={0}
          viewTo="/x"
          editTo="/x/edit"
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('ICL')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <TeamCard team={makeTeam()} sectionName="Men" playerCount={0} matchCount={0} viewTo="/x" editTo="/x/edit" />
      </MemoryRouter>,
    )
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
    const { rerender } = renderCard({ sponsors: [makeSponsor({ id: 'sponsor-1', name: 'Acme Bank' })] })
    expect(screen.getByTitle('Acme Bank')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <TeamCard team={makeTeam()} sectionName="Men" playerCount={0} matchCount={0} viewTo="/x" editTo="/x/edit" />
      </MemoryRouter>,
    )
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
