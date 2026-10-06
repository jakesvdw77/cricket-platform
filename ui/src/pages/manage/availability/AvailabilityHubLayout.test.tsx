import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation, useOutletContext } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AvailabilityHubLayout from './AvailabilityHubLayout'
import PlayerAvailabilityRedirect from './PlayerAvailabilityRedirect'
import SectionAvailabilityRedirect from '../SectionAvailabilityRedirect'

function View({ name }: { name: string }) {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { pathname, search } = useLocation()
  return <div>{`${name} view for ${clubId} at ${pathname}${search}`}</div>
}

function Page({ name }: { name: string }) {
  const { pathname } = useLocation()
  return <div>{`${name} page at ${pathname}`}</div>
}

// Mirrors the route table in App.tsx (docs/specs/073 section 1) under a ManagerHome-like Outlet context.
function renderAt(path: string, clubId: string | null = 'club-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/manage" element={<Outlet context={{ clubId: clubId ?? undefined }} />}>
          <Route path="availability" element={<AvailabilityHubLayout />}>
            <Route index element={<View name="Polls" />} />
            <Route path="players" element={<View name="Players" />} />
            <Route path="coverage" element={<View name="Coverage" />} />
          </Route>
          <Route path="availability/new" element={<Page name="New poll" />} />
          <Route path="availability/group/:roundId" element={<Page name="Group responses" />} />
          <Route path="availability/squad/:matchId/:pollId" element={<Page name="Squad responses" />} />
          <Route path="player-availability" element={<PlayerAvailabilityRedirect />} />
          <Route path="section-availability" element={<SectionAvailabilityRedirect />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AvailabilityHubLayout (docs/specs/073)', () => {
  it('titles the page Availability with no back link (079) and a switch of exactly Polls, Players and Coverage links', () => {
    renderAt('/manage/availability')

    expect(screen.getByRole('heading', { level: 1, name: 'Availability' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Availability views' })
    const links = nav.querySelectorAll('a')
    expect(Array.from(links).map((link) => link.textContent)).toEqual(['Polls', 'Players', 'Coverage'])
    expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('href', '/manage/availability')
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('href', '/manage/availability/players')
    expect(screen.getByRole('link', { name: 'Coverage' })).toHaveAttribute('href', '/manage/availability/coverage')
  })

  it('marks Polls as the current view on /manage/availability, with or without a trailing slash and ?showClosed=true', () => {
    for (const path of ['/manage/availability', '/manage/availability/', '/manage/availability?showClosed=true']) {
      const { unmount } = renderAt(path)
      expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Polls' })).toHaveClass('Mui-selected')
      expect(screen.getByRole('link', { name: 'Players' })).not.toHaveAttribute('aria-current')
      expect(screen.getByText(/^Polls view for club-1/)).toBeInTheDocument()
      unmount()
    }
  })

  it('marks Players as current on /manage/availability/players and renders the Players view', () => {
    renderAt('/manage/availability/players')

    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Players' })).toHaveClass('Mui-selected')
    expect(screen.getByRole('link', { name: 'Polls' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Players view for club-1 at /manage/availability/players')).toBeInTheDocument()
  })

  it('marks Coverage as current on /manage/availability/coverage (with or without a trailing slash) and renders the Coverage view', () => {
    for (const path of ['/manage/availability/coverage', '/manage/availability/coverage/']) {
      const { unmount } = renderAt(path)
      expect(screen.getByRole('link', { name: 'Coverage' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Coverage' })).toHaveClass('Mui-selected')
      expect(screen.getByRole('link', { name: 'Polls' })).not.toHaveAttribute('aria-current')
      expect(screen.getByRole('link', { name: 'Players' })).not.toHaveAttribute('aria-current')
      expect(screen.getByText(/^Coverage view for club-1 at \/manage\/availability\/coverage/)).toBeInTheDocument()
      unmount()
    }
  })

  it('has three switch links and hides New poll on Coverage', () => {
    renderAt('/manage/availability/coverage')

    const links = screen.getByRole('navigation', { name: 'Availability views' }).querySelectorAll('a')
    expect(links).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'New poll' })).not.toBeInTheDocument()
  })

  it('switching is real navigation without a query string, in both directions', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability?showClosed=true')

    await user.click(screen.getByRole('link', { name: 'Players' }))
    expect(screen.getByText('Players view for club-1 at /manage/availability/players')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Coverage' }))
    expect(screen.getByText('Coverage view for club-1 at /manage/availability/coverage')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Polls' }))
    expect(screen.getByText('Polls view for club-1 at /manage/availability')).toBeInTheDocument()
  })

  it('shows New poll only on Polls, and it opens the New poll page', async () => {
    const user = userEvent.setup()
    renderAt('/manage/availability/players')
    expect(screen.queryByRole('button', { name: 'New poll' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Polls' }))
    await user.click(screen.getByRole('button', { name: 'New poll' }))

    expect(screen.getByText('New poll page at /manage/availability/new')).toBeInTheDocument()
  })

  it('renders Not authorized and no switch without a club', () => {
    renderAt('/manage/availability', null)

    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Availability views' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('forwards clubId to both views through its Outlet context', () => {
    const { unmount } = renderAt('/manage/availability')
    expect(screen.getByText(/^Polls view for club-1/)).toBeInTheDocument()
    unmount()
    renderAt('/manage/availability/players')
    expect(screen.getByText(/^Players view for club-1/)).toBeInTheDocument()
  })
})

describe('Availability routes (docs/specs/073 section 1)', () => {
  it('the sub-flow routes resolve to their own pages with no switch', () => {
    for (const [path, text] of [
      ['/manage/availability/new', 'New poll page at /manage/availability/new'],
      ['/manage/availability/group/r1', 'Group responses page at /manage/availability/group/r1'],
      ['/manage/availability/squad/m1/p1', 'Squad responses page at /manage/availability/squad/m1/p1'],
    ]) {
      const { unmount } = renderAt(path)
      expect(screen.getByText(text)).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Availability views' })).not.toBeInTheDocument()
      unmount()
    }
  })

  it('/manage/player-availability?x=1 replaces itself with /manage/availability/players?x=1 under the hub', () => {
    renderAt('/manage/player-availability?x=1')

    expect(screen.getByText('Players view for club-1 at /manage/availability/players?x=1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page')
  })

  it('/manage/section-availability still redirects to the New poll group branch', () => {
    renderAt('/manage/section-availability?sectionId=s1')

    expect(screen.getByText('New poll page at /manage/availability/new')).toBeInTheDocument()
  })
})
