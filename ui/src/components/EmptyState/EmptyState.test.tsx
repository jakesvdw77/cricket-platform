import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders the title and optional description', () => {
    render(<EmptyState title="No matches scheduled yet" description="Add a fixture to get started." />)

    expect(screen.getByText('No matches scheduled yet')).toBeInTheDocument()
    expect(screen.getByText('Add a fixture to get started.')).toBeInTheDocument()
  })

  it('renders an action when provided', () => {
    render(<EmptyState title="No matches scheduled yet" action={<button>Add match</button>} />)

    expect(screen.getByRole('button', { name: 'Add match' })).toBeInTheDocument()
  })
})
