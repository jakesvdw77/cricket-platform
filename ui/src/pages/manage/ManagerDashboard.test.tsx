import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ManagerDashboard from './ManagerDashboard'

// docs/specs/025-club-structure.md renames the existing "Sections & Age Groups" card to "Club
// Structure" and wires it to a real screen — route path unchanged. No test file existed for this
// page before this spec (only created now, not extended, per 024's own precedent note).
describe('ManagerDashboard', () => {
  it('renders a "Club Structure" card (not the old "Sections & Age Groups" copy) linking to /manage/sections', () => {
    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Sections & Age Groups')).not.toBeInTheDocument()
    expect(screen.queryByText('Set up age-group sections')).not.toBeInTheDocument()

    expect(screen.getByText('Club Structure')).toBeInTheDocument()
    expect(screen.getByText("Define your club's own section tree")).toBeInTheDocument()

    const link = screen.getByText('Club Structure').closest('a')
    expect(link).toHaveAttribute('href', '/manage/sections')
  })

  it('renders separate "Leagues and Fixtures" and "Results" cards (not the old combined "Fixtures & Results" copy)', () => {
    render(
      <MemoryRouter>
        <ManagerDashboard />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Fixtures & Results')).not.toBeInTheDocument()

    expect(screen.getByText('Leagues and Fixtures').closest('a')).toHaveAttribute('href', '/manage/fixtures')
    expect(screen.getByText('Results').closest('a')).toHaveAttribute('href', '/manage/results')
  })
})
