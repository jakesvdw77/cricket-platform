import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function Boom(): never {
  throw new Error('crash')
}

describe('AppErrorBoundary', () => {
  it('renders its children when nothing fails', () => {
    render(<AppErrorBoundary><p>All fine</p></AppErrorBoundary>)
    expect(screen.getByText('All fine')).toBeInTheDocument()
  })

  it('shows the error screen instead of an empty page when a child crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Dropped catch' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
