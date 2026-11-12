import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatsFaceBoundary } from './StatsFaceBoundary'

function Boom(): never {
  throw new Error('a payload block is absent')
}

// docs/specs/147: one broken face shows the quiet missing text and never takes the page down.
describe('StatsFaceBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(<StatsFaceBoundary text="Not recorded yet."><p>fine</p></StatsFaceBoundary>)
    expect(screen.getByText('fine')).toBeInTheDocument()
    expect(screen.queryByText('Not recorded yet.')).not.toBeInTheDocument()
  })

  it('shows the quiet text for a throwing child and leaves its sibling alone', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <>
        <StatsFaceBoundary text="Not recorded yet."><Boom /></StatsFaceBoundary>
        <StatsFaceBoundary text="other"><p>sibling</p></StatsFaceBoundary>
      </>,
    )
    expect(screen.getByText('Not recorded yet.')).toBeInTheDocument()
    expect(screen.getByText('sibling')).toBeInTheDocument()
    quiet.mockRestore()
  })
})
