import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import UpcomingMatches from './UpcomingMatches'

vi.mock('../../api/matchApi', () => ({
  fetchUpcomingMatches: () => Promise.resolve([]),
}))

describe('UpcomingMatches', () => {
  it('renders the page heading', () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <UpcomingMatches />
      </QueryClientProvider>,
    )
    expect(screen.getByText('Upcoming Matches')).toBeInTheDocument()
  })
})
