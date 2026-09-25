import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ManagerDashboard from './ManagerDashboard'

// docs/specs/056-club-profile-overview.md: the "Club manager" group's 9-card order/destinations —
// Club Profile now leads to the new consolidated overview page (still at /manage/club-profile);
// Club Contacts/Club Sponsors/Club Structure/"Leagues and Fixtures" no longer have their own
// top-level cards (reached from the overview page or the dashboard directly instead); Leagues and
// Matches are promoted to their own direct cards; Gallery and Notifications are new placeholders.
describe('ManagerDashboard', () => {
  it('renders exactly the 9 "Club manager" cards, in order, with their real destinations', () => {
    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>,
    )

    const expected = [
      ['Club Profile', '/manage/club-profile'],
      ['Teams', '/manage/teams'],
      ['Players', '/manage/players'],
      ['Leagues', '/manage/fixtures/leagues'],
      ['Matches', '/manage/fixtures/matches'],
      ['Results', '/manage/results'],
      ['Team Managers & Permissions', '/manage/permissions'],
      ['Gallery', '/manage/gallery'],
      ['Notifications', '/manage/notifications'],
    ]

    expected.forEach(([title, href]) => {
      expect(screen.getByText(title).closest('a')).toHaveAttribute('href', href)
    })

    // Order: NavTile renders its title as an <h3> (docs/specs/025's own precedent, mirrored by
    // LeagueList.test.tsx's card-order assertions) — the "Club manager" group renders first, so
    // its 9 titles are the first 9 h3 headings in DOM order.
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(headings.slice(0, 9)).toEqual(expected.map(([title]) => title))
  })

  it('no longer renders separate Club Contacts/Club Sponsors/Club Structure/"Leagues and Fixtures" cards', () => {
    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Club Contacts')).not.toBeInTheDocument()
    expect(screen.queryByText('Club Sponsors')).not.toBeInTheDocument()
    expect(screen.queryByText('Club Structure')).not.toBeInTheDocument()
    expect(screen.queryByText('Leagues and Fixtures')).not.toBeInTheDocument()
  })

  it('Gallery and Notifications cards are clearly marked as new club-manager destinations', () => {
    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByText('Share photos and highlights from your club')).toBeInTheDocument()
    expect(screen.getByText('Announcements and reminders for your club')).toBeInTheDocument()
  })

  it('the "Team manager" group is untouched', () => {
    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByText('Squads').closest('a')).toHaveAttribute('href', '/manage/squads')
    expect(screen.getByText('Communication').closest('a')).toHaveAttribute('href', '/manage/communication')
    expect(screen.getByText('Availability Polls').closest('a')).toHaveAttribute('href', '/manage/availability')
  })
})
